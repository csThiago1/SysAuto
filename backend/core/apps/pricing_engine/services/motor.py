"""
Paddock Solutions — Pricing Engine — MotorPrecificacaoService
Motor de Orçamentos (MO) — Sprint MO-6: Motor de Precificação

Fachada única do motor de preços. Nenhuma view ou outro service deve
montar preço ad-hoc — tudo flui por MotorPrecificacaoService.

Pipeline calcular_servico():
  1. Resolver enquadramento (segmento + tamanho + fator_responsabilidade)
  2. Resolver ficha técnica
  3. Aplicar multiplicadores de tamanho
  4. Calcular custo de mão de obra (CustoHoraService)
  5. Calcular custo de insumos (CustoInsumoService)
  6. Calcular rateio de despesas (RateioService)
  7. Custo total base = MO + insumos + rateio
  8. Margem ajustada = margem_base × (1 + fator_responsabilidade)
  9. Preço calculado = custo_total_base × (1 + margem_ajustada)
  10. Teto de benchmark (MO-8 stub — A7: teto, nunca alvo)
  11. Preço final = min(calculado, teto) se teto existe
  12. Persistir CalculoCustoSnapshot IMUTÁVEL

ARMADILHAS:
  A4: snapshot imutável — nunca edite, crie novo.
  A7: benchmark é TETO — min(calculado, teto), não o teto diretamente.
  A10: NUNCA chamar Claude API aqui — motor é determinístico.
  P8: custo zero não é default — raise se indisponível.
"""
import logging
from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from apps.pricing_catalog.models import MaterialCanonico, ServicoCanonico
from apps.pricing_engine.models.motor import CalculoCustoSnapshot
from apps.pricing_engine.services.benchmark import BenchmarkService
from apps.pricing_engine.services.custo_base import (
    CustoBaseIndisponivel,
    CustoInsumoService,
    CustoPecaService,
)
from apps.pricing_engine.services.custo_hora import CustoHoraService, CustoNaoDefinido
from apps.pricing_engine.services.margem import MargemNaoDefinida, MargemResolver
from apps.pricing_engine.services.rateio import ParametroRateioNaoDefinido, RateioService
from apps.pricing_profile.models import CategoriaTamanho, SegmentoVeicular
from apps.pricing_profile.services import EnquadramentoService
from apps.pricing_tech.services import FichaNaoEncontrada, FichaTecnicaService

logger = logging.getLogger(__name__)

D0 = Decimal("0")
D2 = Decimal("0.01")
D4 = Decimal("0.0001")


class ErroMotorPrecificacao(Exception):
    """Erro estruturado do motor — capturado na view para retornar 422."""

    def __init__(self, mensagem: str, recurso_faltante: str | None = None) -> None:
        super().__init__(mensagem)
        self.recurso_faltante = recurso_faltante


@dataclass
class ContextoCalculo:
    """Entrada do motor — descreve o veículo e condições do cálculo.

    empresa_id OBRIGATÓRIO (P9 — sem empresa não há margem resolvível).
    """

    empresa_id: str  # UUID como string (Empresa.id)
    veiculo_marca: str
    veiculo_modelo: str
    veiculo_ano: int
    veiculo_versao: str | None = None
    tipo_pintura_codigo: str | None = None
    quem_paga: str = "cliente"  # "cliente" | "seguradora"
    aplica_multiplicador_tamanho: bool = True


@dataclass
class ResultadoServico:
    """Resultado de calcular_servico() — referência ao snapshot criado."""

    snapshot_id: str
    preco_final: Decimal
    custo_total_base: Decimal
    margem_ajustada: Decimal
    teto_aplicado: bool
    decomposicao: dict


@dataclass
class ResultadoPeca:
    """Resultado de calcular_peca() — referência ao snapshot criado."""

    snapshot_id: str
    preco_final: Decimal
    custo_base: Decimal
    margem_ajustada: Decimal
    decomposicao: dict


@dataclass
class ResultadoIntervencao:
    """Resultado de calcular_intervencao() — intervenção (Peça × Ação)."""

    snapshot_id: str
    horas_mao_obra: Decimal
    valor_peca: Decimal
    valor_mao_obra: Decimal
    valor_insumos: Decimal
    preco_final: Decimal


class MotorPrecificacaoService:
    """Fachada única do motor de preços.

    Nenhuma view ou outro service deve calcular preço ad-hoc.
    Todos os cálculos geram CalculoCustoSnapshot imutável para auditoria.
    """

    @staticmethod
    def calcular_servico(
        ctx: ContextoCalculo,
        servico_canonico_id: str,
        origem: str = "orcamento_linha",
        user_id: str | None = None,
    ) -> ResultadoServico:
        """Calcula preço de um serviço e persiste snapshot imutável.

        Args:
            ctx: Contexto com dados do veículo e configurações.
            servico_canonico_id: UUID do ServicoCanonico.
            origem: "orcamento_linha" | "os_linha" | "simulacao".
            user_id: UUID do GlobalUser que solicitou (para auditoria).

        Returns:
            ResultadoServico com snapshot_id e valores finais.

        Raises:
            ErroMotorPrecificacao: se qualquer dependência de custo estiver
                indisponível (A10: zero não é default seguro — P8).
        """
        # ── 1. Resolver enquadramento ─────────────────────────────────────────
        try:
            enq = EnquadramentoService.resolver(
                marca=ctx.veiculo_marca,
                modelo=ctx.veiculo_modelo,
                ano=ctx.veiculo_ano,
            )
        except Exception as exc:
            raise ErroMotorPrecificacao(
                f"Falha ao resolver enquadramento veicular: {exc}",
                recurso_faltante="enquadramento",
            ) from exc

        # ── 2. Resolver ficha técnica ─────────────────────────────────────────
        try:
            ficha = FichaTecnicaService.resolver(
                servico_id=str(servico_canonico_id),
                tipo_pintura_codigo=ctx.tipo_pintura_codigo,
            )
        except FichaNaoEncontrada as exc:
            raise ErroMotorPrecificacao(
                f"Ficha técnica não encontrada para serviço {servico_canonico_id}: {exc}",
                recurso_faltante="ficha_tecnica",
            ) from exc

        # ── 3. Aplicar multiplicadores de tamanho ─────────────────────────────
        try:
            tamanho = CategoriaTamanho.objects.get(codigo=enq.tamanho_codigo)
        except CategoriaTamanho.DoesNotExist as exc:
            raise ErroMotorPrecificacao(
                f"CategoriaTamanho com codigo={enq.tamanho_codigo!r} não encontrada.",
                recurso_faltante="categoria_tamanho",
            ) from exc

        servico = ServicoCanonico.objects.get(id=servico_canonico_id)
        aplica_mult = ctx.aplica_multiplicador_tamanho and servico.aplica_multiplicador_tamanho

        ficha_aj = FichaTecnicaService.aplicar_multiplicadores(
            ficha,
            aplica_multiplicador_tamanho=aplica_mult,
            multiplicador_insumos=tamanho.multiplicador_insumos,
            multiplicador_horas=tamanho.multiplicador_horas,
        )

        # ── 4. Custo mão de obra ──────────────────────────────────────────────
        hoje = date.today()
        mo_detalhes: list[dict] = []
        custo_mo = D0
        horas_totais = D0

        for m in ficha_aj.maos_obra:
            try:
                ch = CustoHoraService.obter(
                    m["categoria_codigo"], hoje, ctx.empresa_id
                )
            except CustoNaoDefinido as exc:
                raise ErroMotorPrecificacao(
                    f"Custo/hora não definido para categoria {m['categoria_codigo']!r}: {exc}",
                    recurso_faltante=f"custo_hora:{m['categoria_codigo']}",
                ) from exc

            horas = Decimal(str(m["horas"]))
            subtotal = (horas * ch.valor).quantize(D2, ROUND_HALF_UP)
            custo_mo += subtotal
            horas_totais += horas
            mo_detalhes.append(
                {
                    "categoria": m["categoria_codigo"],
                    "horas": str(horas),
                    "custo_hora": str(ch.valor),
                    "fonte_custo": ch.origem,
                    "subtotal": str(subtotal),
                }
            )

        # ── 5. Custo insumos ──────────────────────────────────────────────────
        ins_detalhes: list[dict] = []
        custo_ins = D0

        for i in ficha_aj.insumos:
            try:
                mat = MaterialCanonico.objects.get(codigo=i["material_codigo"])
                cu = CustoInsumoService.custo_base(str(mat.id))
            except CustoBaseIndisponivel as exc:
                raise ErroMotorPrecificacao(
                    f"Custo de insumo não disponível para material {i['material_codigo']!r}: {exc}",
                    recurso_faltante=f"custo_insumo:{i['material_codigo']}",
                ) from exc
            except MaterialCanonico.DoesNotExist as exc:
                raise ErroMotorPrecificacao(
                    f"MaterialCanonico com codigo={i['material_codigo']!r} não encontrado.",
                    recurso_faltante=f"material:{i['material_codigo']}",
                ) from exc

            qtd = Decimal(str(i["quantidade"]))
            subtotal = (qtd * cu).quantize(D2, ROUND_HALF_UP)
            custo_ins += subtotal
            ins_detalhes.append(
                {
                    "material": i["material_codigo"],
                    "quantidade_base": str(qtd),
                    "custo_unit_base": str(cu),
                    "subtotal": str(subtotal),
                }
            )

        # ── 6. Rateio de despesas ─────────────────────────────────────────────
        try:
            rateio_valor_hora = RateioService.por_hora(hoje, ctx.empresa_id)
        except ParametroRateioNaoDefinido as exc:
            raise ErroMotorPrecificacao(
                f"Parâmetro de rateio não definido para empresa {ctx.empresa_id}: {exc}",
                recurso_faltante="parametro_rateio",
            ) from exc
        except ValueError as exc:
            raise ErroMotorPrecificacao(str(exc), recurso_faltante="parametro_rateio") from exc

        rateio = (rateio_valor_hora * horas_totais).quantize(D2, ROUND_HALF_UP)

        # ── 7. Custo total base ───────────────────────────────────────────────
        custo_total_base = custo_mo + custo_ins + rateio

        # ── 8. Margem ajustada ────────────────────────────────────────────────
        try:
            margem_base = MargemResolver.para_servico(ctx.empresa_id, enq.segmento_codigo)
        except MargemNaoDefinida as exc:
            raise ErroMotorPrecificacao(str(exc), recurso_faltante="margem") from exc

        segmento = SegmentoVeicular.objects.get(codigo=enq.segmento_codigo)
        fator_resp = segmento.fator_responsabilidade
        margem_ajustada = (
            margem_base * (Decimal("1") + fator_resp)
        ).quantize(D4, ROUND_HALF_UP)

        # ── 9. Preço calculado ────────────────────────────────────────────────
        preco_calc = (custo_total_base * (Decimal("1") + margem_ajustada)).quantize(
            D2, ROUND_HALF_UP
        )

        # ── 10. Teto de benchmark (A7 — é TETO, não alvo) ────────────────────
        teto = BenchmarkService.p90_servico(
            empresa_id=ctx.empresa_id,
            servico_id=str(servico_canonico_id),
            segmento_codigo=enq.segmento_codigo,
            tamanho_codigo=enq.tamanho_codigo,
        )
        preco_final = min(preco_calc, teto) if teto else preco_calc
        teto_aplicado = bool(teto and teto < preco_calc)

        # ── 11. Montar decomposição para snapshot ─────────────────────────────
        decomposicao: dict = {
            "ficha_id": ficha_aj.ficha_id,
            "ficha_versao": ficha_aj.versao,
            "mao_obra": mo_detalhes,
            "insumos": ins_detalhes,
            "rateio": {
                "valor_hora": str(rateio_valor_hora),
                "horas_servico": str(horas_totais),
                "total": str(rateio),
            },
            "benchmark": (
                {"p90": str(teto), "aplicado": teto_aplicado}
                if teto is not None
                else None
            ),
        }

        contexto_json: dict = {
            "veiculo": {
                "marca": ctx.veiculo_marca,
                "modelo": ctx.veiculo_modelo,
                "ano": ctx.veiculo_ano,
                "versao": ctx.veiculo_versao,
            },
            "segmento_codigo": enq.segmento_codigo,
            "tamanho_codigo": enq.tamanho_codigo,
            "tipo_pintura_codigo": ctx.tipo_pintura_codigo,
            "quem_paga": ctx.quem_paga,
            "aplica_multiplicador_tamanho": aplica_mult,
        }

        # ── 12. Persistir snapshot imutável (A4) ──────────────────────────────
        snap = CalculoCustoSnapshot.objects.create(
            empresa_id=ctx.empresa_id,
            servico_canonico_id=servico_canonico_id,
            peca_canonica=None,
            origem=origem,
            contexto=contexto_json,
            custo_mo=custo_mo,
            custo_insumos=custo_ins,
            rateio=rateio,
            custo_peca_base=D0,
            custo_total_base=custo_total_base,
            fator_responsabilidade=fator_resp,
            margem_base=margem_base,
            margem_ajustada=margem_ajustada,
            preco_calculado=preco_calc,
            preco_teto_benchmark=teto,
            preco_final=preco_final,
            decomposicao=decomposicao,
            calculado_por_id=user_id,
        )

        logger.info(
            "Motor: snapshot %s criado — servico=%s preco_final=%s teto_aplicado=%s",
            snap.id,
            servico_canonico_id,
            preco_final,
            teto_aplicado,
        )

        return ResultadoServico(
            snapshot_id=str(snap.id),
            preco_final=preco_final,
            custo_total_base=custo_total_base,
            margem_ajustada=margem_ajustada,
            teto_aplicado=teto_aplicado,
            decomposicao=decomposicao,
        )

    @staticmethod
    def calcular_peca(
        ctx: ContextoCalculo,
        peca_canonica_id: str,
        quantidade: int = 1,
        origem: str = "orcamento_linha",
        user_id: str | None = None,
    ) -> ResultadoPeca:
        """Calcula preço de uma peça e persiste snapshot imutável.

        Args:
            ctx: Contexto com dados do veículo e configurações.
            peca_canonica_id: UUID da PecaCanonica.
            quantidade: quantidade de peças (default 1).
            origem: "orcamento_linha" | "os_linha" | "simulacao".
            user_id: UUID do GlobalUser para auditoria.

        Returns:
            ResultadoPeca com snapshot_id e valores finais.

        Raises:
            ErroMotorPrecificacao: se custo ou margem indisponível.
        """
        # ── 1. Resolver enquadramento ─────────────────────────────────────────
        try:
            enq = EnquadramentoService.resolver(
                marca=ctx.veiculo_marca,
                modelo=ctx.veiculo_modelo,
                ano=ctx.veiculo_ano,
            )
        except Exception as exc:
            raise ErroMotorPrecificacao(
                f"Falha ao resolver enquadramento veicular: {exc}",
                recurso_faltante="enquadramento",
            ) from exc

        # ── 2. Custo base da peça (A2: inclui reservadas) ────────────────────
        try:
            custo_base = CustoPecaService.custo_base(peca_canonica_id)
            unidades_disp = CustoPecaService.unidades_disponiveis(peca_canonica_id)
        except CustoBaseIndisponivel as exc:
            raise ErroMotorPrecificacao(
                f"Custo de peça não disponível: {exc}",
                recurso_faltante=f"custo_peca:{peca_canonica_id}",
            ) from exc

        # ── 3. Margem ─────────────────────────────────────────────────────────
        try:
            margem_base = MargemResolver.para_peca(
                empresa_id=ctx.empresa_id,
                segmento_codigo=enq.segmento_codigo,
                peca_canonica_id=peca_canonica_id,
                custo_base=custo_base,
            )
        except MargemNaoDefinida as exc:
            raise ErroMotorPrecificacao(str(exc), recurso_faltante="margem") from exc

        segmento = SegmentoVeicular.objects.get(codigo=enq.segmento_codigo)
        fator_resp = segmento.fator_responsabilidade
        margem_ajustada = (
            margem_base * (Decimal("1") + fator_resp)
        ).quantize(D4, ROUND_HALF_UP)

        # ── 4. Preço unitário ─────────────────────────────────────────────────
        preco_unit = (custo_base * (Decimal("1") + margem_ajustada)).quantize(
            D2, ROUND_HALF_UP
        )

        # ── 5. Teto de benchmark (A7) ─────────────────────────────────────────
        teto_peca = BenchmarkService.p90_peca(
            empresa_id=ctx.empresa_id,
            peca_id=peca_canonica_id,
        )
        preco_final_unit = min(preco_unit, teto_peca) if teto_peca else preco_unit
        qtd = Decimal(str(quantidade))

        # ── 6. Decomposição ───────────────────────────────────────────────────
        decomposicao: dict = {
            "peca_id": peca_canonica_id,
            "custo_base": str(custo_base),
            "margem_base": str(margem_base),
            "fator_responsabilidade": str(fator_resp),
            "margem_ajustada": str(margem_ajustada),
            "preco_calculado_unit": str(preco_unit),
            "teto_benchmark": str(teto_peca) if teto_peca else None,
            "preco_final_unit": str(preco_final_unit),
            "quantidade": quantidade,
            "unidades_disponiveis": unidades_disp,
        }

        contexto_json: dict = {
            "veiculo": {
                "marca": ctx.veiculo_marca,
                "modelo": ctx.veiculo_modelo,
                "ano": ctx.veiculo_ano,
                "versao": ctx.veiculo_versao,
            },
            "segmento_codigo": enq.segmento_codigo,
            "tamanho_codigo": enq.tamanho_codigo,
            "quem_paga": ctx.quem_paga,
        }

        # ── 7. Persistir snapshot (A4) ────────────────────────────────────────
        custo_peca_total = (custo_base * qtd).quantize(D2, ROUND_HALF_UP)
        snap = CalculoCustoSnapshot.objects.create(
            empresa_id=ctx.empresa_id,
            servico_canonico=None,
            peca_canonica_id=peca_canonica_id,
            origem=origem,
            contexto=contexto_json,
            custo_mo=D0,
            custo_insumos=D0,
            rateio=D0,
            custo_peca_base=custo_peca_total,
            custo_total_base=custo_peca_total,
            fator_responsabilidade=fator_resp,
            margem_base=margem_base,
            margem_ajustada=margem_ajustada,
            preco_calculado=(preco_unit * qtd).quantize(D2, ROUND_HALF_UP),
            preco_teto_benchmark=(teto_peca * qtd).quantize(D2, ROUND_HALF_UP) if teto_peca else None,
            preco_final=(preco_final_unit * qtd).quantize(D2, ROUND_HALF_UP),
            decomposicao=decomposicao,
            calculado_por_id=user_id,
        )

        logger.info(
            "Motor: snapshot %s criado — peca=%s preco_final=%s",
            snap.id,
            peca_canonica_id,
            preco_final_unit * qtd,
        )

        return ResultadoPeca(
            snapshot_id=str(snap.id),
            preco_final=(preco_final_unit * qtd).quantize(D2, ROUND_HALF_UP),
            custo_base=custo_base,
            margem_ajustada=margem_ajustada,
            decomposicao=decomposicao,
        )

    @staticmethod
    def calcular_intervencao(
        ctx: "ContextoCalculo",
        peca_canonica_id: str,
        servico_canonico_id: str,
        ficha_id: str | None,
        quantidade: int = 1,
        acao: str = "trocar",
        fornecimento: str = "oficina",
        origem: str = "orcamento_linha",
        user_id: str | None = None,
    ) -> "ResultadoIntervencao":
        """Calcula preço de uma intervenção (Peça × Ação) e persiste snapshot.

        Pipeline:
          1. Calcular custo MO + insumos + rateio via ficha técnica do servico
          2. Se acao=TROCAR e fornecimento=OFICINA: obter custo_peca via CustoPecaService
          3. Criar UM CalculoCustoSnapshot cobrindo toda a intervenção
          4. Retornar ResultadoIntervencao com valores decompostos

        Args:
            ctx: Contexto veicular.
            peca_canonica_id: UUID da peça que sofre a intervenção.
            servico_canonico_id: UUID do ServicoCanonico (resolvido via MAPEAMENTO_ACAO_SERVICO).
            ficha_id: UUID da FichaTecnicaServico (None → motor levanta ErroMotorPrecificacao).
            quantidade: quantidade de peças (default 1).
            acao: valor de Acao (para decidir se inclui custo_peca).
            fornecimento: "oficina" | "seguradora" | "cliente".
            origem: para o snapshot.
            user_id: para auditoria.
        """
        # ── 1. Resolver enquadramento ─────────────────────────────────────────
        try:
            enq = EnquadramentoService.resolver(
                marca=ctx.veiculo_marca,
                modelo=ctx.veiculo_modelo,
                ano=ctx.veiculo_ano,
            )
        except Exception as exc:
            raise ErroMotorPrecificacao(
                f"Falha ao resolver enquadramento: {exc}", recurso_faltante="enquadramento"
            ) from exc

        # ── 2. Resolver ficha técnica ─────────────────────────────────────────
        if ficha_id:
            try:
                ficha_raw = FichaTecnicaService.resolver(
                    servico_id=servico_canonico_id,
                    tipo_pintura_codigo=ctx.tipo_pintura_codigo,
                )
            except FichaNaoEncontrada as exc:
                raise ErroMotorPrecificacao(
                    f"Ficha técnica não encontrada: {exc}", recurso_faltante="ficha_tecnica"
                ) from exc
        else:
            try:
                ficha_raw = FichaTecnicaService.resolver(
                    servico_id=servico_canonico_id,
                    tipo_pintura_codigo=ctx.tipo_pintura_codigo,
                )
            except FichaNaoEncontrada as exc:
                raise ErroMotorPrecificacao(
                    f"Ficha técnica não encontrada para servico={servico_canonico_id}: {exc}",
                    recurso_faltante="ficha_tecnica",
                ) from exc

        # ── 3. Multiplicadores de tamanho ─────────────────────────────────────
        try:
            tamanho = CategoriaTamanho.objects.get(codigo=enq.tamanho_codigo)
        except CategoriaTamanho.DoesNotExist as exc:
            raise ErroMotorPrecificacao(
                f"CategoriaTamanho={enq.tamanho_codigo!r} não encontrada.",
                recurso_faltante="categoria_tamanho",
            ) from exc

        servico = ServicoCanonico.objects.get(id=servico_canonico_id)
        aplica_mult = ctx.aplica_multiplicador_tamanho and servico.aplica_multiplicador_tamanho
        ficha_aj = FichaTecnicaService.aplicar_multiplicadores(
            ficha_raw,
            aplica_multiplicador_tamanho=aplica_mult,
            multiplicador_insumos=tamanho.multiplicador_insumos,
            multiplicador_horas=tamanho.multiplicador_horas,
        )

        # ── 4. Custo mão de obra ──────────────────────────────────────────────
        hoje = date.today()
        mo_detalhes: list[dict] = []
        custo_mo = D0
        horas_totais = D0

        for m in ficha_aj.maos_obra:
            try:
                ch = CustoHoraService.obter(m["categoria_codigo"], hoje, ctx.empresa_id)
            except CustoNaoDefinido as exc:
                raise ErroMotorPrecificacao(
                    f"Custo/hora indefinido para {m['categoria_codigo']!r}: {exc}",
                    recurso_faltante=f"custo_hora:{m['categoria_codigo']}",
                ) from exc
            horas = Decimal(str(m["horas"]))
            subtotal = (horas * ch.valor).quantize(D2, ROUND_HALF_UP)
            custo_mo += subtotal
            horas_totais += horas
            mo_detalhes.append({
                "categoria": m["categoria_codigo"],
                "horas": str(horas),
                "custo_hora": str(ch.valor),
                "fonte_custo": ch.origem,
                "subtotal": str(subtotal),
            })

        # ── 5. Custo insumos ──────────────────────────────────────────────────
        ins_detalhes: list[dict] = []
        custo_ins = D0
        for i in ficha_aj.insumos:
            try:
                mat = MaterialCanonico.objects.get(codigo=i["material_codigo"])
                cu = CustoInsumoService.custo_base(str(mat.id))
            except (CustoBaseIndisponivel, MaterialCanonico.DoesNotExist) as exc:
                raise ErroMotorPrecificacao(
                    f"Custo insumo indisponível para {i['material_codigo']!r}: {exc}",
                    recurso_faltante=f"custo_insumo:{i['material_codigo']}",
                ) from exc
            qtd = Decimal(str(i["quantidade"]))
            subtotal = (qtd * cu).quantize(D2, ROUND_HALF_UP)
            custo_ins += subtotal
            ins_detalhes.append({
                "material": i["material_codigo"],
                "quantidade_base": str(qtd),
                "custo_unit_base": str(cu),
                "subtotal": str(subtotal),
            })

        # ── 6. Rateio ─────────────────────────────────────────────────────────
        try:
            rateio_valor_hora = RateioService.por_hora(hoje, ctx.empresa_id)
        except (ParametroRateioNaoDefinido, ValueError) as exc:
            raise ErroMotorPrecificacao(str(exc), recurso_faltante="parametro_rateio") from exc
        rateio = (rateio_valor_hora * horas_totais).quantize(D2, ROUND_HALF_UP)

        # ── 7. Custo peça (só se acao=TROCAR e fornecimento=OFICINA) ──────────
        custo_peca_base = D0
        peca_detalhes: dict | None = None
        if acao == "trocar" and fornecimento == "oficina":
            try:
                custo_peca_base = CustoPecaService.custo_base(peca_canonica_id)
                peca_detalhes = {
                    "peca_canonica_id": peca_canonica_id,
                    "custo_base": str(custo_peca_base),
                    "quantidade": quantidade,
                }
            except CustoBaseIndisponivel:
                # Sem estoque no momento — usa 0, alerta no log (não bloqueia)
                logger.warning(
                    "Motor: custo_peca indisponível para %s — usando 0", peca_canonica_id
                )

        # ── 8. Custo total base + margem ──────────────────────────────────────
        custo_peca_total = (custo_peca_base * quantidade).quantize(D2, ROUND_HALF_UP)
        custo_servico = custo_mo + custo_ins + rateio
        custo_total_base = (custo_servico + custo_peca_total).quantize(D2, ROUND_HALF_UP)

        try:
            margem_base = MargemResolver.para_servico(ctx.empresa_id, enq.segmento_codigo)
        except MargemNaoDefinida as exc:
            raise ErroMotorPrecificacao(str(exc), recurso_faltante="margem") from exc

        segmento = SegmentoVeicular.objects.get(codigo=enq.segmento_codigo)
        fator_resp = segmento.fator_responsabilidade
        margem_ajustada = (margem_base * (Decimal("1") + fator_resp)).quantize(D4, ROUND_HALF_UP)
        preco_calc = (custo_total_base * (Decimal("1") + margem_ajustada)).quantize(D2, ROUND_HALF_UP)

        teto = BenchmarkService.p90_servico(
            empresa_id=ctx.empresa_id,
            servico_id=servico_canonico_id,
            segmento_codigo=enq.segmento_codigo,
            tamanho_codigo=enq.tamanho_codigo,
        )
        preco_final = min(preco_calc, teto) if teto else preco_calc

        # ── 9. Snapshot imutável ──────────────────────────────────────────────
        decomposicao: dict = {
            "ficha_id": ficha_aj.ficha_id,
            "ficha_versao": ficha_aj.versao,
            "mao_obra": mo_detalhes,
            "insumos": ins_detalhes,
            "rateio": {
                "valor_hora": str(rateio_valor_hora),
                "horas_servico": str(horas_totais),
                "total": str(rateio),
            },
            "peca": peca_detalhes,
            "quantidade_intervencao": quantidade,
            "acao": acao,
        }
        contexto_json: dict = {
            "veiculo": {
                "marca": ctx.veiculo_marca,
                "modelo": ctx.veiculo_modelo,
                "ano": ctx.veiculo_ano,
                "versao": ctx.veiculo_versao,
            },
            "segmento_codigo": enq.segmento_codigo,
            "tamanho_codigo": enq.tamanho_codigo,
            "tipo_pintura_codigo": ctx.tipo_pintura_codigo,
            "quem_paga": ctx.quem_paga,
        }
        snap = CalculoCustoSnapshot.objects.create(
            empresa_id=ctx.empresa_id,
            servico_canonico_id=servico_canonico_id,
            peca_canonica_id=peca_canonica_id,
            origem=origem,
            contexto=contexto_json,
            custo_mo=custo_mo,
            custo_insumos=custo_ins,
            rateio=rateio,
            custo_peca_base=custo_peca_total,
            custo_total_base=custo_total_base,
            fator_responsabilidade=fator_resp,
            margem_base=margem_base,
            margem_ajustada=margem_ajustada,
            preco_calculado=preco_calc,
            preco_teto_benchmark=teto,
            preco_final=preco_final,
            decomposicao=decomposicao,
            calculado_por_id=user_id,
        )

        logger.info(
            "Motor: intervencao snapshot %s — peca=%s acao=%s preco_final=%s",
            snap.id, peca_canonica_id, acao, preco_final,
        )

        return ResultadoIntervencao(
            snapshot_id=str(snap.id),
            horas_mao_obra=horas_totais,
            valor_peca=custo_peca_total,
            valor_mao_obra=custo_mo,
            valor_insumos=custo_ins,
            preco_final=preco_final,
        )

    @staticmethod
    def calcular_service_catalog(
        ctx: "ContextoCalculo",
        service_catalog_id: str,
        quantidade: int = 1,
        origem: str = "orcamento_linha",
        user_id: str | None = None,
    ) -> "ResultadoServico":
        """Cria snapshot para item adicional usando o suggested_price do ServiceCatalog.

        Não executa pipeline completo de custo (sem ficha técnica nem margem).
        O preço sugerido é usado diretamente como preco_final.
        """
        from apps.service_orders.models import ServiceCatalog

        catalog = ServiceCatalog.objects.get(id=service_catalog_id)
        preco_unit = catalog.suggested_price
        preco_final = (preco_unit * quantidade).quantize(D2, ROUND_HALF_UP)

        contexto_json: dict = {
            "veiculo": {
                "marca": ctx.veiculo_marca,
                "modelo": ctx.veiculo_modelo,
                "ano": ctx.veiculo_ano,
            },
            "quem_paga": ctx.quem_paga,
            "service_catalog_id": service_catalog_id,
            "service_catalog_nome": catalog.name,
            "quantidade": quantidade,
        }
        snap = CalculoCustoSnapshot.objects.create(
            empresa_id=ctx.empresa_id,
            servico_canonico=None,
            peca_canonica=None,
            origem=origem,
            contexto=contexto_json,
            custo_mo=D0,
            custo_insumos=D0,
            rateio=D0,
            custo_peca_base=D0,
            custo_total_base=preco_final,
            fator_responsabilidade=D0,
            margem_base=D0,
            margem_ajustada=D0,
            preco_calculado=preco_final,
            preco_teto_benchmark=None,
            preco_final=preco_final,
            decomposicao={
                "tipo": "service_catalog",
                "service_catalog_id": service_catalog_id,
                "nome": catalog.name,
                "preco_unitario": str(preco_unit),
                "quantidade": quantidade,
            },
            calculado_por_id=user_id,
        )

        return ResultadoServico(
            snapshot_id=str(snap.id),
            preco_final=preco_final,
            custo_total_base=preco_final,
            margem_ajustada=D0,
            teto_aplicado=False,
            decomposicao=contexto_json,
        )
