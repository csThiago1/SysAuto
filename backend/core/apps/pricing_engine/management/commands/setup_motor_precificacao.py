"""
Paddock Solutions — Pricing Engine — Management Command
MO-9: setup_motor_precificacao

Onboarding idempotente do motor de precificação para um tenant.
Cria MargemOperacao padrão, CustoHoraFallback (por CategoriaMaoObra)
e ParametroRateio se esses registros ainda não existirem.

Uso:
    python manage.py setup_motor_precificacao --schema tenant_dscar
    python manage.py setup_motor_precificacao  # usa o schema padrão do manage.py
"""
import logging
from decimal import Decimal
from datetime import date

from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context

logger = logging.getLogger(__name__)

# Segmentos × Tipos de operação para os quais criaremos margens padrão
# tipo_operacao choices: servico_mao_obra | peca_revenda | insumo_comp
# Segmentos DS Car: popular, medio, premium, luxo, exotico
_DEFAULT_MARGENS = [
    # (segmento_codigo, tipo_operacao, margem_percentual)
    ("popular", "servico_mao_obra", Decimal("0.40")),
    ("popular", "peca_revenda",     Decimal("0.35")),
    ("popular", "insumo_comp",      Decimal("0.30")),
    ("medio",   "servico_mao_obra", Decimal("0.45")),
    ("medio",   "peca_revenda",     Decimal("0.40")),
    ("medio",   "insumo_comp",      Decimal("0.35")),
    ("premium", "servico_mao_obra", Decimal("0.50")),
    ("premium", "peca_revenda",     Decimal("0.45")),
    ("premium", "insumo_comp",      Decimal("0.40")),
    ("luxo",    "servico_mao_obra", Decimal("0.55")),
    ("luxo",    "peca_revenda",     Decimal("0.50")),
    ("luxo",    "insumo_comp",      Decimal("0.45")),
    ("exotico", "servico_mao_obra", Decimal("0.60")),
    ("exotico", "peca_revenda",     Decimal("0.55")),
    ("exotico", "insumo_comp",      Decimal("0.50")),
]

_VALOR_HORA_FALLBACK = Decimal("85.00")   # R$/h — fallback quando RH não tem dados
_HORAS_PRODUTIVAS_MES = Decimal("168.00") # 21 dias × 8h


class Command(BaseCommand):
    help = "Onboarding idempotente do Motor de Precificação para um tenant."

    def add_arguments(self, parser) -> None:  # type: ignore[override]
        parser.add_argument(
            "--schema",
            type=str,
            default="",
            help="Schema do tenant (ex: tenant_dscar). Se vazio, usa o schema atual.",
        )

    def handle(self, *args, **options) -> None:  # type: ignore[override]
        schema = options["schema"]
        if schema:
            ctx = schema_context(schema)
            ctx.__enter__()

        try:
            self._setup()
        finally:
            if schema:
                ctx.__exit__(None, None, None)

    def _setup(self) -> None:
        from apps.pricing_engine.models import (
            CustoHoraFallback,
            MargemOperacao,
        )
        from apps.pricing_engine.models.parametros import ParametroRateio
        from apps.pricing_profile.models import Empresa, SegmentoVeicular
        from apps.pricing_catalog.models import CategoriaMaoObra

        empresas = Empresa.objects.filter(is_active=True)
        if not empresas.exists():
            self.stdout.write(
                self.style.WARNING(
                    "Nenhuma Empresa ativa encontrada. Crie uma Empresa antes de rodar este comando."
                )
            )
            return

        categorias_mo = list(CategoriaMaoObra.objects.filter(is_active=True))
        if not categorias_mo:
            self.stdout.write(
                self.style.WARNING(
                    "Nenhuma CategoriaMaoObra ativa. Rode setup_catalogo_base antes."
                )
            )

        for empresa in empresas:
            self.stdout.write(f"Configurando motor para empresa: {empresa.nome_fantasia} ({empresa.id})")

            # ── MargemOperacao padrão ─────────────────────────────────────────
            criadas_margens = 0
            for segmento_cod, tipo_op, margem in _DEFAULT_MARGENS:
                segmento = SegmentoVeicular.objects.filter(codigo=segmento_cod).first()
                if segmento is None:
                    continue
                _, created = MargemOperacao.objects.get_or_create(
                    empresa=empresa,
                    segmento=segmento,
                    tipo_operacao=tipo_op,
                    vigente_desde=date.today(),
                    defaults={"margem_percentual": margem},
                )
                if created:
                    criadas_margens += 1

            self.stdout.write(f"  MargemOperacao: {criadas_margens} criadas (existentes ignoradas)")

            # ── CustoHoraFallback por CategoriaMaoObra ────────────────────────
            criados_fallback = 0
            for cat in categorias_mo:
                _, created = CustoHoraFallback.objects.get_or_create(
                    empresa=empresa,
                    categoria=cat,
                    defaults={
                        "valor_hora": _VALOR_HORA_FALLBACK,
                        "vigente_desde": date.today(),
                        "motivo": "Configuração inicial automática (setup_motor_precificacao)",
                    },
                )
                if created:
                    criados_fallback += 1

            self.stdout.write(f"  CustoHoraFallback: {criados_fallback} criados (existentes ignorados)")

            # ── ParametroRateio padrão ────────────────────────────────────────
            _, created = ParametroRateio.objects.get_or_create(
                empresa=empresa,
                vigente_desde=date.today(),
                defaults={
                    "horas_produtivas_mes": _HORAS_PRODUTIVAS_MES,
                    "metodo": "por_hora",
                    "observacoes": "Configuração inicial automática (setup_motor_precificacao)",
                },
            )
            status_rateio = "criado" if created else "já existe"
            self.stdout.write(f"  ParametroRateio ({_HORAS_PRODUTIVAS_MES}h/mês): {status_rateio}")

        self.stdout.write(self.style.SUCCESS("setup_motor_precificacao concluído."))
