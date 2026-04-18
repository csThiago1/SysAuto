"""
Paddock Solutions — Pricing Tech — Services
Motor de Orçamentos (MO) — Sprint MO-4: Ficha Técnica Versionada

FichaTecnicaService — lógica de negócio para fichas técnicas versionadas.

Regras implementadas:
- Armadilha A1: mudanças criam nova versão (nunca UPDATE destrutivo).
- Armadilha P3: apenas uma ficha ativa com tipo_pintura=NULL por serviço.
- criar_nova_versao() é atômico: cria nova versão e desativa anterior
  dentro do mesmo transaction.atomic().
"""
import logging
from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction

logger = logging.getLogger(__name__)


@dataclass
class FichaResolvida:
    """Representação resolvida de uma ficha técnica (sem dependências ORM)."""

    ficha_id: str  # UUID como string
    versao: int
    maos_obra: list[dict]  # [{categoria_codigo, categoria_nome, horas, afetada_por_tamanho}, ...]
    insumos: list[dict]  # [{material_codigo, material_nome, quantidade, unidade_base, afetado_por_tamanho}, ...]


class FichaNaoEncontrada(Exception):
    """Levantada quando não existe ficha ativa para o par (servico, tipo_pintura)."""

    pass


def _montar_resolvida(ficha: "FichaTecnicaServico") -> FichaResolvida:  # type: ignore[name-defined]
    """Constrói FichaResolvida a partir de uma instância de FichaTecnicaServico.

    Usa select_related internamente para evitar N+1.
    Filtra apenas itens ativos (is_active=True).
    """
    maos = ficha.maos_obra.select_related("categoria").filter(is_active=True)
    insumos = ficha.insumos.select_related("material_canonico").filter(is_active=True)

    return FichaResolvida(
        ficha_id=str(ficha.pk),
        versao=ficha.versao,
        maos_obra=[
            {
                "categoria_codigo": mo.categoria.codigo,
                "categoria_nome": mo.categoria.nome,
                "horas": mo.horas,
                "afetada_por_tamanho": mo.afetada_por_tamanho,
            }
            for mo in maos
        ],
        insumos=[
            {
                "material_codigo": ins.material_canonico.codigo,
                "material_nome": ins.material_canonico.nome,
                "quantidade": ins.quantidade,
                "unidade_base": ins.unidade,
                "afetado_por_tamanho": ins.afetado_por_tamanho,
            }
            for ins in insumos
        ],
    )


class FichaTecnicaService:
    """Serviço de negócio para fichas técnicas versionadas.

    Centraliza toda a lógica de resolução, versionamento e aplicação
    de multiplicadores de tamanho. Nenhuma lógica de negócio deve
    existir nos ViewSets — apenas aqui.
    """

    @staticmethod
    def resolver(
        servico_id: str,
        tipo_pintura_codigo: str | None = None,
    ) -> FichaResolvida:
        """Resolve a ficha técnica ativa para um serviço, com fallback.

        Prioridade de resolução:
          1. Ficha ativa com tipo_pintura.codigo == tipo_pintura_codigo
          2. Ficha ativa genérica (tipo_pintura=NULL)
          3. FichaNaoEncontrada

        Args:
            servico_id: UUID do ServicoCanonico.
            tipo_pintura_codigo: código do TipoPintura (ex: "SOLIDA"). None = genérico.

        Returns:
            FichaResolvida com mãos de obra e insumos.

        Raises:
            FichaNaoEncontrada: se nenhuma ficha ativa for encontrada.
        """
        from apps.pricing_tech.models import FichaTecnicaServico

        qs = FichaTecnicaServico.objects.filter(servico_id=servico_id, is_active=True)

        if tipo_pintura_codigo:
            especifica = qs.filter(tipo_pintura__codigo=tipo_pintura_codigo).first()
            if especifica:
                return _montar_resolvida(especifica)

        generica = qs.filter(tipo_pintura__isnull=True).first()
        if generica:
            return _montar_resolvida(generica)

        raise FichaNaoEncontrada(
            f"Nenhuma ficha ativa encontrada para servico_id={servico_id} "
            f"tipo_pintura={tipo_pintura_codigo!r}"
        )

    @staticmethod
    def aplicar_multiplicadores(
        ficha: FichaResolvida,
        aplica_multiplicador_tamanho: bool,
        multiplicador_insumos: Decimal,
        multiplicador_horas: Decimal,
    ) -> FichaResolvida:
        """Aplica multiplicadores de tamanho aos itens da ficha.

        Gate geral: se aplica_multiplicador_tamanho=False, retorna a ficha
        sem alteração (útil para serviços fixos como diagnóstico).

        Quando True, multiplica apenas itens com afetada_por_tamanho=True
        (ou afetado_por_tamanho=True para insumos). Itens não afetados
        mantêm seus valores originais.

        Args:
            ficha: FichaResolvida base.
            aplica_multiplicador_tamanho: gate geral.
            multiplicador_insumos: fator aplicado às quantidades de insumos.
            multiplicador_horas: fator aplicado às horas de mão de obra.

        Returns:
            Nova FichaResolvida com valores ajustados.
        """
        if not aplica_multiplicador_tamanho:
            return ficha

        maos_ajustadas = [
            {
                **mo,
                "horas": mo["horas"] * (multiplicador_horas if mo["afetada_por_tamanho"] else Decimal("1")),
            }
            for mo in ficha.maos_obra
        ]
        ins_ajustados = [
            {
                **ins,
                "quantidade": ins["quantidade"] * (multiplicador_insumos if ins["afetado_por_tamanho"] else Decimal("1")),
            }
            for ins in ficha.insumos
        ]

        return FichaResolvida(
            ficha_id=ficha.ficha_id,
            versao=ficha.versao,
            maos_obra=maos_ajustadas,
            insumos=ins_ajustados,
        )

    @staticmethod
    def criar_nova_versao(
        servico_id: str,
        tipo_pintura_id: str | None,
        maos_obra_data: list[dict],
        insumos_data: list[dict],
        motivo: str,
        user_id: str,
    ) -> "FichaTecnicaServico":  # type: ignore[name-defined]
        """Cria nova versão da ficha técnica e desativa a anterior.

        Operação atômica:
          1. Bloqueia a ficha anterior (select_for_update) para evitar corrida.
          2. Calcula próxima versão (anterior.versao + 1 ou 1 se inédita).
          3. Cria nova FichaTecnicaServico.
          4. Cria FichaTecnicaMaoObra e FichaTecnicaInsumo para a nova ficha.
          5. Desativa a ficha anterior (is_active=False).

        Args:
            servico_id: UUID do ServicoCanonico.
            tipo_pintura_id: UUID do TipoPintura ou None (ficha genérica).
            maos_obra_data: lista de dicts com campos de FichaTecnicaMaoObra.
            insumos_data: lista de dicts com campos de FichaTecnicaInsumo.
            motivo: descrição do motivo da nova versão (mín. 10 chars).
            user_id: UUID do GlobalUser responsável.

        Returns:
            Nova instância de FichaTecnicaServico (com is_active=True).
        """
        from apps.pricing_tech.models import (
            FichaTecnicaInsumo,
            FichaTecnicaMaoObra,
            FichaTecnicaServico,
        )

        with transaction.atomic():
            anterior = (
                FichaTecnicaServico.objects.select_for_update()
                .filter(
                    servico_id=servico_id,
                    tipo_pintura_id=tipo_pintura_id,
                    is_active=True,
                )
                .first()
            )

            prox_versao = (anterior.versao + 1) if anterior else 1

            nova = FichaTecnicaServico.objects.create(
                servico_id=servico_id,
                tipo_pintura_id=tipo_pintura_id,
                versao=prox_versao,
                is_active=True,
                criada_por_id=user_id,
                motivo_nova_versao=motivo,
            )

            for mo in maos_obra_data:
                FichaTecnicaMaoObra.objects.create(ficha=nova, **mo)

            for ins in insumos_data:
                obj = FichaTecnicaInsumo(ficha=nova, **ins)
                obj.full_clean()  # valida unidade vs material_canonico.unidade_base
                obj.save()

            if anterior:
                anterior.is_active = False
                anterior.save(update_fields=["is_active"])

            logger.info(
                "Nova ficha técnica criada: ficha_id=%s versao=%s servico_id=%s tipo_pintura_id=%s user_id=%s",
                nova.pk,
                prox_versao,
                servico_id,
                tipo_pintura_id,
                user_id,
            )

            return nova
