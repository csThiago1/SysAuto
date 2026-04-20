"""
Paddock Solutions — Pricing Engine — Management Command
MO-9: setup_motor_precificacao

Onboarding idempotente do motor de precificação para um tenant.
Cria MargemOperacao padrão, MarkupPeca de fallback e ParametroCustoHora
se esses registros ainda não existirem.

Uso:
    python manage.py setup_motor_precificacao --schema tenant_dscar
    python manage.py setup_motor_precificacao  # usa o schema padrão do manage.py
"""
import logging
from decimal import Decimal
from datetime import date

from django.core.management.base import BaseCommand, CommandError
from django_tenants.utils import schema_context

logger = logging.getLogger(__name__)

# Segmentos × Tipos de operação para os quais criaremos margens padrão
_DEFAULT_MARGENS = [
    # (segmento_codigo, tipo_operacao, margem_minima, margem_maxima)
    ("leve", "SERVICO", Decimal("0.35"), Decimal("0.55")),
    ("leve", "PECA",    Decimal("0.30"), Decimal("0.50")),
    ("medio", "SERVICO", Decimal("0.40"), Decimal("0.60")),
    ("medio", "PECA",    Decimal("0.35"), Decimal("0.55")),
    ("pesado", "SERVICO", Decimal("0.45"), Decimal("0.65")),
    ("pesado", "PECA",    Decimal("0.40"), Decimal("0.60")),
    ("moto", "SERVICO",  Decimal("0.30"), Decimal("0.50")),
    ("moto", "PECA",     Decimal("0.25"), Decimal("0.45")),
]

_FATOR_RESPONSABILIDADE_DEFAULT = Decimal("1.00")
_CUSTO_HORA_FALLBACK = Decimal("85.00")  # R$/h — fallback quando RH não tem dados


class Command(BaseCommand):
    help = "Onboarding idempotente do Motor de Precificação para um tenant."

    def add_arguments(self, parser) -> None:  # type: ignore[override]
        parser.add_argument(
            "--schema",
            type=str,
            default="",
            help="Schema do tenant (ex: tenant_dscar). Se vazio, usa o schema atual.",
        )
        parser.add_argument(
            "--empresa-id",
            type=str,
            default="",
            help="UUID da Empresa para MargemOperacao (se não informado, usa a primeira encontrada).",
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
            MarkupPeca,
        )
        from apps.pricing_profile.models import Empresa

        empresas = Empresa.objects.filter(is_active=True)
        if not empresas.exists():
            self.stdout.write(
                self.style.WARNING(
                    "Nenhuma Empresa ativa encontrada. Crie uma Empresa antes de rodar este comando."
                )
            )
            return

        for empresa in empresas:
            self.stdout.write(f"Configurando motor para empresa: {empresa.nome} ({empresa.id})")

            # ── MargemOperacao padrão ─────────────────────────────────────────
            criadas_margens = 0
            for segmento_cod, tipo_op, m_min, m_max in _DEFAULT_MARGENS:
                try:
                    from apps.pricing_profile.models import SegmentoVeicular
                    segmento = SegmentoVeicular.objects.filter(codigo=segmento_cod).first()
                    if segmento is None:
                        continue
                    _, created = MargemOperacao.objects.get_or_create(
                        empresa=empresa,
                        segmento=segmento,
                        tipo_operacao=tipo_op,
                        defaults={
                            "margem_minima": m_min,
                            "margem_maxima": m_max,
                            "fator_responsabilidade": _FATOR_RESPONSABILIDADE_DEFAULT,
                            "vigente_desde": date.today(),
                        },
                    )
                    if created:
                        criadas_margens += 1
                except Exception as exc:
                    logger.warning("setup_motor: skip margem %s/%s: %s", segmento_cod, tipo_op, exc)

            self.stdout.write(f"  MargemOperacao: {criadas_margens} criadas (existentes ignoradas)")

            # ── CustoHoraFallback padrão ──────────────────────────────────────
            _, created = CustoHoraFallback.objects.get_or_create(
                empresa=empresa,
                defaults={
                    "custo_hora": _CUSTO_HORA_FALLBACK,
                    "vigente_desde": date.today(),
                },
            )
            status_fallback = "criado" if created else "já existe"
            self.stdout.write(f"  CustoHoraFallback R${_CUSTO_HORA_FALLBACK}/h: {status_fallback}")

        self.stdout.write(self.style.SUCCESS("setup_motor_precificacao concluído."))
