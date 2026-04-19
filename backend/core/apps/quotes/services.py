"""
Paddock Solutions — Quotes Services
Motor de Orçamentos (MO) — Sprint MO-7: Orçamento + OS

OrcamentoService — fluxo completo de orçamento:
  criar → adicionar_intervencao / adicionar_item_adicional →
  enviar → aprovar (gera ServiceOrder) → nova_versao
"""
import logging
from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.pricing_catalog.constants import MAPEAMENTO_ACAO_SERVICO
from apps.pricing_catalog.models import ServicoCanonico
from apps.pricing_engine.services.motor import ContextoCalculo, MotorPrecificacaoService
from apps.pricing_profile.models import Empresa
from apps.pricing_profile.services import EnquadramentoService
from apps.pricing_tech.services import FichaNaoEncontrada, FichaTecnicaService
from apps.quotes.constants import (
    Acao,
    Fornecimento,
    StatusArea,
    StatusItem,
)
from apps.quotes.models import AreaImpacto, Orcamento, OrcamentoIntervencao, OrcamentoItemAdicional

logger = logging.getLogger(__name__)


class MapeamentoAcaoAusente(Exception):
    """Ação não mapeada para ServicoCanonico — adicionar em MAPEAMENTO_ACAO_SERVICO."""


class OrcamentoNaoEditavel(Exception):
    """Orçamento em status que não permite edição."""


class OrcamentoService:
    """Fluxo completo de orçamento.

    REGRA: nunca crie OrcamentoIntervencao/OrcamentoItemAdicional diretamente —
    sempre passe por adicionar_intervencao / adicionar_item_adicional para garantir
    que cada item gera um CalculoCustoSnapshot.
    """

    # ── Criação ────────────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def criar(
        empresa_id: str,
        customer_id: str,
        insurer_id: str | None,
        tipo_responsabilidade: str,
        sinistro_numero: str,
        veiculo: dict,
        user_id: str | None,
        observacoes: str = "",
    ) -> Orcamento:
        """Cria orçamento vazio com área 'Geral' pré-criada.

        Args:
            empresa_id: UUID string da Empresa.
            customer_id: UUID string do UnifiedCustomer.
            insurer_id: UUID string da Insurer ou None.
            tipo_responsabilidade: "cliente" | "seguradora" | "rcf".
            sinistro_numero: número do sinistro (vazio para particular).
            veiculo: {marca, modelo, ano, versao?, placa?, tipo_pintura_codigo?}.
            user_id: UUID do GlobalUser criador.
            observacoes: texto livre.

        Returns:
            Orcamento criado em status "rascunho".
        """
        empresa = Empresa.objects.get(id=empresa_id)

        try:
            enq = EnquadramentoService.resolver(
                marca=veiculo["marca"],
                modelo=veiculo["modelo"],
                ano=veiculo["ano"],
                versao=veiculo.get("versao"),
            )
            enquadramento_snapshot = {
                "segmento_codigo":        enq.segmento_codigo,
                "tamanho_codigo":         enq.tamanho_codigo,
                "fator_responsabilidade": str(enq.fator_responsabilidade),
                "tipo_pintura_codigo":    veiculo.get("tipo_pintura_codigo"),
            }
        except Exception:
            # Fallback se FIPE não retornar enquadramento válido
            enquadramento_snapshot = {
                "segmento_codigo":        "medio",
                "tamanho_codigo":         "medio",
                "fator_responsabilidade": "1.00",
                "tipo_pintura_codigo":    veiculo.get("tipo_pintura_codigo"),
            }
            logger.warning("OrcamentoService.criar: enquadramento não resolvido — usando fallback.")

        numero = OrcamentoService._proximo_numero(empresa_id)

        orc = Orcamento.objects.create(
            empresa=empresa,
            numero=numero,
            versao=1,
            customer_id=customer_id,
            insurer_id=insurer_id,
            tipo_responsabilidade=tipo_responsabilidade,
            sinistro_numero=sinistro_numero,
            veiculo_marca=veiculo["marca"],
            veiculo_modelo=veiculo["modelo"],
            veiculo_ano=veiculo["ano"],
            veiculo_versao=veiculo.get("versao", ""),
            veiculo_placa=veiculo.get("placa", ""),
            enquadramento_snapshot=enquadramento_snapshot,
            status="rascunho",
            validade=date.today() + timedelta(days=15),
            created_by_id=user_id,
            observacoes=observacoes,
        )

        # ADR-001 Action Item #7: toda OS nasce com 1 área "Geral"
        AreaImpacto.objects.create(
            orcamento=orc,
            titulo="Geral",
            ordem=0,
            status=StatusArea.ABERTA,
            created_by_id=user_id,
        )

        return orc

    @staticmethod
    @transaction.atomic
    def _proximo_numero(empresa_id: str) -> str:
        year = date.today().year
        last = (
            Orcamento.objects
            .select_for_update()
            .filter(empresa_id=empresa_id, numero__startswith=f"ORC-{year}-")
            .order_by("-numero")
            .values_list("numero", flat=True)
            .first()
        )
        if last:
            try:
                seq = int(last.split("-")[-1]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        return f"ORC-{year}-{seq:06d}"

    # ── Adição de intervenção ─────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def adicionar_intervencao(
        orcamento_id: str,
        area_impacto_id: str,
        peca_canonica_id: str,
        acao: str,
        qualificador_peca: str,
        fornecimento: str,
        quantidade: int,
        user_id: str | None,
        codigo_peca: str = "",
        inclusao_manual: bool = False,
        descricao: str = "",
    ) -> OrcamentoIntervencao:
        """Adiciona intervenção calculando snapshot via motor.

        Ação resolve ServicoCanonico via MAPEAMENTO_ACAO_SERVICO; ficha é
        resolvida via FichaTecnicaService.resolver().

        Raises:
            OrcamentoNaoEditavel: se orçamento não está em "rascunho".
            MapeamentoAcaoAusente: se acao não tem ServicoCanonico no catálogo.
        """
        orc = Orcamento.objects.select_for_update().get(id=orcamento_id)
        if orc.status != "rascunho":
            raise OrcamentoNaoEditavel(
                f"Orçamento {orc.numero} em status '{orc.status}' não aceita edição."
            )

        servico_codigo = MAPEAMENTO_ACAO_SERVICO.get(acao)
        if servico_codigo is None:
            raise MapeamentoAcaoAusente(
                f"Ação '{acao}' não mapeada em MAPEAMENTO_ACAO_SERVICO."
            )

        try:
            servico = ServicoCanonico.objects.get(codigo=servico_codigo)
        except ServicoCanonico.DoesNotExist as exc:
            raise MapeamentoAcaoAusente(
                f"ServicoCanonico com codigo='{servico_codigo}' não encontrado no catálogo."
            ) from exc

        enq_snap = orc.enquadramento_snapshot
        ctx = ContextoCalculo(
            empresa_id=str(orc.empresa_id),
            veiculo_marca=orc.veiculo_marca,
            veiculo_modelo=orc.veiculo_modelo,
            veiculo_ano=orc.veiculo_ano,
            veiculo_versao=orc.veiculo_versao or None,
            tipo_pintura_codigo=enq_snap.get("tipo_pintura_codigo"),
            quem_paga="seguradora" if orc.insurer_id else "cliente",
            aplica_multiplicador_tamanho=servico.aplica_multiplicador_tamanho,
        )

        try:
            ficha = FichaTecnicaService.resolver(
                servico_id=str(servico.id),
                tipo_pintura_codigo=ctx.tipo_pintura_codigo,
            )
            ficha_id = str(ficha.id) if ficha else None
        except FichaNaoEncontrada:
            ficha = None
            ficha_id = None

        res = MotorPrecificacaoService.calcular_intervencao(
            ctx=ctx,
            peca_canonica_id=peca_canonica_id,
            servico_canonico_id=str(servico.id),
            ficha_id=ficha_id,
            quantidade=quantidade,
            acao=acao,
            fornecimento=fornecimento,
            origem="orcamento_linha",
            user_id=user_id,
        )

        intervencao = OrcamentoIntervencao.objects.create(
            orcamento=orc,
            area_impacto_id=area_impacto_id,
            peca_canonica_id=peca_canonica_id,
            acao=acao,
            servico_canonico=servico,
            ficha_tecnica=ficha,
            qualificador_peca=qualificador_peca,
            fornecimento=fornecimento,
            codigo_peca=codigo_peca,
            quantidade=quantidade,
            horas_mao_obra=res.horas_mao_obra,
            valor_peca=res.valor_peca,
            valor_mao_obra=res.valor_mao_obra,
            valor_insumos=res.valor_insumos,
            preco_total=res.preco_final,
            snapshot_id=res.snapshot_id,
            status=StatusItem.ORCADO,
            inclusao_manual=inclusao_manual,
            ordem=orc.intervencoes.count(),
            descricao_visivel=descricao,
            created_by_id=user_id,
        )
        OrcamentoService._recalcular_totais(orc)
        return intervencao

    # ── Adição de item adicional ──────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def adicionar_item_adicional(
        orcamento_id: str,
        service_catalog_id: str,
        quantidade: int,
        fornecimento: str,
        user_id: str | None,
        descricao: str = "",
        inclusao_manual: bool = False,
    ) -> OrcamentoItemAdicional:
        """Adiciona serviço adicional (sem peça) — alinhamento, polimento, lavagem."""
        orc = Orcamento.objects.select_for_update().get(id=orcamento_id)
        if orc.status != "rascunho":
            raise OrcamentoNaoEditavel(
                f"Orçamento {orc.numero} em status '{orc.status}' não aceita edição."
            )

        enq_snap = orc.enquadramento_snapshot
        ctx = ContextoCalculo(
            empresa_id=str(orc.empresa_id),
            veiculo_marca=orc.veiculo_marca,
            veiculo_modelo=orc.veiculo_modelo,
            veiculo_ano=orc.veiculo_ano,
            tipo_pintura_codigo=enq_snap.get("tipo_pintura_codigo"),
            quem_paga="seguradora" if orc.insurer_id else "cliente",
            aplica_multiplicador_tamanho=False,  # item adicional nunca varia por tamanho (A3)
        )

        res = MotorPrecificacaoService.calcular_service_catalog(
            ctx=ctx,
            service_catalog_id=service_catalog_id,
            quantidade=quantidade,
            origem="orcamento_linha",
            user_id=user_id,
        )

        preco_unit = (res.preco_final / quantidade).quantize(Decimal("0.01"))
        item = OrcamentoItemAdicional.objects.create(
            orcamento=orc,
            service_catalog_id=service_catalog_id,
            quantidade=quantidade,
            preco_unitario=preco_unit,
            preco_total=res.preco_final,
            snapshot_id=res.snapshot_id,
            fornecimento=fornecimento,
            status=StatusItem.ORCADO,
            ordem=orc.itens_adicionais.count(),
            descricao_visivel=descricao,
            inclusao_manual=inclusao_manual,
            created_by_id=user_id,
        )
        OrcamentoService._recalcular_totais(orc)
        return item

    # ── Totais ────────────────────────────────────────────────────────────────

    @staticmethod
    def _recalcular_totais(orc: Orcamento) -> None:
        subtotal = (
            sum(
                (i.preco_total for i in orc.intervencoes.filter(is_active=True)),
                Decimal("0"),
            )
            + sum(
                (i.preco_total for i in orc.itens_adicionais.filter(is_active=True)),
                Decimal("0"),
            )
        )
        orc.subtotal = subtotal
        orc.total = subtotal - orc.desconto
        orc.save(update_fields=["subtotal", "total", "updated_at"])

    # ── Transições de status ──────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def enviar(orcamento_id: str) -> Orcamento:
        """Status rascunho → enviado."""
        orc = Orcamento.objects.select_for_update().get(id=orcamento_id)
        if orc.status != "rascunho":
            raise OrcamentoNaoEditavel(
                f"Orçamento {orc.numero} não está em rascunho (atual: {orc.status})."
            )
        orc.status = "enviado"
        orc.enviado_em = timezone.now()
        orc.save(update_fields=["status", "enviado_em", "updated_at"])
        return orc

    @staticmethod
    @transaction.atomic
    def recusar(orcamento_id: str) -> Orcamento:
        """Status → recusado."""
        orc = Orcamento.objects.select_for_update().get(id=orcamento_id)
        if orc.status in ("convertido_os", "expirado"):
            raise OrcamentoNaoEditavel(
                f"Orçamento {orc.numero} em status '{orc.status}' não pode ser recusado."
            )
        orc.status = "recusado"
        orc.save(update_fields=["status", "updated_at"])
        return orc

    # ── Aprovação → ServiceOrder ──────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def aprovar(
        orcamento_id: str,
        intervencoes_ids: list[str] | None,
        itens_adicionais_ids: list[str] | None,
        areas_negadas: list[dict] | None,
        user_id: str | None,
    ):  # type: ignore[return]
        """Aprovação gera ServiceOrder com itens espelhados.

        Args:
            orcamento_id: UUID do orçamento.
            intervencoes_ids: None = aprova todas; lista parcial = aprovação parcial.
            itens_adicionais_ids: None = aprova todos; lista parcial = parcial.
            areas_negadas: [{area_id, motivo}] — marca área inteira como negada.
            user_id: UUID do GlobalUser que aprovou.

        Returns:
            ServiceOrder criada.

        Raises:
            OrcamentoNaoEditavel: se orçamento não está em estado aprovável.
            ValueError: se nenhum item resulta aprovado.
        """
        from apps.inventory.models import UnidadeFisica
        from apps.inventory.services import ReservaIndisponivel, ReservaUnidadeService
        from apps.service_orders.models import (
            OSAreaImpacto,
            OSIntervencao,
            OSItemAdicional,
            ServiceOrder,
        )

        orc = Orcamento.objects.select_for_update().get(id=orcamento_id)
        if orc.status in ("convertido_os", "expirado", "recusado"):
            raise OrcamentoNaoEditavel(
                f"Orçamento {orc.numero} em status '{orc.status}' não é aprovável."
            )

        # Negação de áreas inteiras
        if areas_negadas:
            for a in areas_negadas:
                area = AreaImpacto.objects.get(id=a["area_id"], orcamento=orc)
                area.status = StatusArea.NEGADA_PRE_EXIST
                area.observacao_regulador = a.get("motivo", "")
                area.save(update_fields=["status", "observacao_regulador", "updated_at"])
                area.intervencoes.update(status=StatusItem.SEM_COBERTURA)

        intervencoes_aprovadas = orc.intervencoes.filter(is_active=True).exclude(
            status=StatusItem.SEM_COBERTURA
        )
        if intervencoes_ids is not None:
            intervencoes_aprovadas = intervencoes_aprovadas.filter(id__in=intervencoes_ids)

        itens_aprovados = orc.itens_adicionais.filter(is_active=True)
        if itens_adicionais_ids is not None:
            itens_aprovados = itens_aprovados.filter(id__in=itens_adicionais_ids)

        if not intervencoes_aprovadas.exists() and not itens_aprovados.exists():
            raise ValueError("Nenhum item resultou aprovado. Orçamento não convertido.")

        from django.db.models import Max as _Max

        # Criar ServiceOrder (P10 — transacional)
        max_num = ServiceOrder.objects.aggregate(m=_Max("number"))["m"] or 0
        os_ = ServiceOrder.objects.create(
            number=max_num + 1,
            customer_id=orc.customer_id,
            customer_uuid=orc.customer_id,
            customer_name=orc.customer.name,
            make=orc.veiculo_marca,
            model=orc.veiculo_modelo,
            year=orc.veiculo_ano,
            vehicle_version=orc.veiculo_versao,
            plate=orc.veiculo_placa or "N/A",
            insurer_id=orc.insurer_id,
            insured_type=("insured" if orc.insurer_id else "particular"),
            status="authorized",
            created_by_id=user_id,
        )

        # Espelhar áreas aprovadas
        area_map: dict[str, OSAreaImpacto] = {}
        for area in orc.areas.filter(is_active=True).exclude(
            status=StatusArea.NEGADA_PRE_EXIST
        ):
            os_area = OSAreaImpacto.objects.create(
                service_order=os_,
                area_impacto_origem=area,
                titulo=area.titulo,
                ordem=area.ordem,
                status=StatusArea.APROVADA,
                created_by_id=user_id,
            )
            area_map[str(area.id)] = os_area

        # Espelhar intervenções aprovadas
        for iv in intervencoes_aprovadas:
            os_area = area_map.get(str(iv.area_impacto_id))
            if os_area is None:
                continue  # Área negada — não espelha
            OSIntervencao.objects.create(
                service_order=os_,
                area=os_area,
                orcamento_intervencao=iv,
                peca_canonica=iv.peca_canonica,
                acao=iv.acao,
                servico_canonico=iv.servico_canonico,
                ficha_tecnica=iv.ficha_tecnica,
                qualificador_peca=iv.qualificador_peca,
                fornecimento=iv.fornecimento,
                codigo_peca=iv.codigo_peca,
                quantidade=iv.quantidade,
                horas_mao_obra=iv.horas_mao_obra,
                valor_peca=iv.valor_peca,
                valor_mao_obra=iv.valor_mao_obra,
                valor_insumos=iv.valor_insumos,
                preco_total=iv.preco_total,
                snapshot=iv.snapshot,
                status=StatusItem.APROVADO,
                ordem=iv.ordem,
                descricao_visivel=iv.descricao_visivel,
                observacao=iv.observacao,
                created_by_id=user_id,
            )
            iv.status = StatusItem.APROVADO
            iv.save(update_fields=["status", "updated_at"])

        # Intervenções não aprovadas (aprovação parcial sem área negada)
        if intervencoes_ids is not None:
            orc.intervencoes.filter(is_active=True).exclude(
                id__in=intervencoes_ids
            ).exclude(
                status=StatusItem.SEM_COBERTURA
            ).update(status=StatusItem.SEM_COBERTURA)

        # Espelhar itens adicionais aprovados
        for it in itens_aprovados:
            OSItemAdicional.objects.create(
                service_order=os_,
                orcamento_item_adicional=it,
                service_catalog=it.service_catalog,
                quantidade=it.quantidade,
                preco_unitario=it.preco_unitario,
                preco_total=it.preco_total,
                snapshot=it.snapshot,
                fornecimento=it.fornecimento,
                status=StatusItem.APROVADO,
                ordem=it.ordem,
                descricao_visivel=it.descricao_visivel,
                created_by_id=user_id,
            )
            it.status = StatusItem.APROVADO
            it.save(update_fields=["status", "updated_at"])

        if itens_adicionais_ids is not None:
            orc.itens_adicionais.filter(is_active=True).exclude(
                id__in=itens_adicionais_ids
            ).update(status=StatusItem.SEM_COBERTURA)

        orc.service_order = os_
        parcial = (
            (intervencoes_ids is not None)
            or (itens_adicionais_ids is not None)
            or bool(areas_negadas)
        )
        orc.status = "aprovado_parc" if parcial else "aprovado"
        orc.aprovado_em = timezone.now()
        orc.save(update_fields=["service_order", "status", "aprovado_em", "updated_at"])

        # Reserva automática de peças TROCAR + OFICINA (P6 — falha não bloqueia)
        for osi in os_.intervencoes_motor.filter(
            fornecimento=Fornecimento.OFICINA,
            acao=Acao.TROCAR,
        ):
            try:
                ReservaUnidadeService.reservar(
                    peca_canonica_id=str(osi.peca_canonica_id),
                    quantidade=osi.quantidade,
                    ordem_servico_id=str(os_.id),
                )
            except ReservaIndisponivel:
                logger.warning(
                    "OS %s: reserva impossível peça %s — operador deve comprar.",
                    os_.number,
                    osi.peca_canonica_id,
                )
            except Exception as exc:
                logger.error(
                    "OS %s: erro inesperado na reserva peça %s: %s",
                    os_.number, osi.peca_canonica_id, exc,
                )

        return os_

    # ── Nova versão ───────────────────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def nova_versao(orcamento_id: str, user_id: str | None) -> Orcamento:
        """Clona orçamento incrementando versão, recalculando todos os snapshots."""
        orig = Orcamento.objects.select_for_update().get(id=orcamento_id)

        nova = Orcamento.objects.create(
            empresa=orig.empresa,
            numero=orig.numero,
            versao=orig.versao + 1,
            customer=orig.customer,
            insurer=orig.insurer,
            tipo_responsabilidade=orig.tipo_responsabilidade,
            sinistro_numero=orig.sinistro_numero,
            veiculo_marca=orig.veiculo_marca,
            veiculo_modelo=orig.veiculo_modelo,
            veiculo_ano=orig.veiculo_ano,
            veiculo_versao=orig.veiculo_versao,
            veiculo_placa=orig.veiculo_placa,
            enquadramento_snapshot=orig.enquadramento_snapshot,
            status="rascunho",
            validade=date.today() + timedelta(days=15),
            created_by_id=user_id,
            observacoes=orig.observacoes,
        )

        # Clonar áreas
        area_map: dict[str, str] = {}
        for area in orig.areas.filter(is_active=True):
            nova_area = AreaImpacto.objects.create(
                orcamento=nova,
                titulo=area.titulo,
                ordem=area.ordem,
                created_by_id=user_id,
            )
            area_map[str(area.id)] = str(nova_area.id)

        # Recalcular intervenções com custos correntes (P4)
        for iv in orig.intervencoes.filter(is_active=True):
            nova_area_id = area_map.get(str(iv.area_impacto_id))
            if nova_area_id is None:
                continue
            OrcamentoService.adicionar_intervencao(
                orcamento_id=str(nova.id),
                area_impacto_id=nova_area_id,
                peca_canonica_id=str(iv.peca_canonica_id),
                acao=iv.acao,
                qualificador_peca=iv.qualificador_peca,
                fornecimento=iv.fornecimento,
                quantidade=iv.quantidade,
                user_id=user_id,
                codigo_peca=iv.codigo_peca,
                descricao=iv.descricao_visivel,
            )

        for it in orig.itens_adicionais.filter(is_active=True):
            OrcamentoService.adicionar_item_adicional(
                orcamento_id=str(nova.id),
                service_catalog_id=str(it.service_catalog_id),
                quantidade=it.quantidade,
                fornecimento=it.fornecimento,
                user_id=user_id,
                descricao=it.descricao_visivel,
            )

        return nova
