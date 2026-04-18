"""
Management command para configuração inicial das fichas técnicas base.
Popula FichaTecnicaServico com fichas genéricas para os top-10 serviços DS Car.
Idempotente: pula serviços que já possuem ficha ativa.

Uso:
    python manage.py setup_fichas_base --schema tenant_dscar
    python manage.py setup_fichas_base --all-tenants
    python manage.py setup_fichas_base --schema tenant_dscar --dry-run
"""
import logging
from argparse import ArgumentParser
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django_tenants.utils import schema_context

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Dados Seed
#
# Estrutura de cada ficha:
#   servico_codigo: str            — deve existir em ServicoCanonico
#   maos_obra: list[dict]          — categoria_codigo, horas, afetada_por_tamanho
#   insumos: list[dict]            — material_codigo, quantidade, unidade, afetado_por_tamanho
#   motivo: str                    — motivo da criação inicial
# ─────────────────────────────────────────────────────────────────────────────

FICHAS_BASE: list[dict[str, Any]] = [
    # 1. Pintura Para-choque Dianteiro
    {
        "servico_codigo": "pintura-para-choque-dianteiro",
        "maos_obra": [
            {"categoria_codigo": "pintor", "horas": "2.00", "afetada_por_tamanho": True},
            {"categoria_codigo": "auxiliar", "horas": "0.50", "afetada_por_tamanho": True},
        ],
        "insumos": [
            {"material_codigo": "primer-epóxi", "quantidade": "0.15", "unidade": "L", "afetado_por_tamanho": True},
            {"material_codigo": "tinta-solida", "quantidade": "0.30", "unidade": "L", "afetado_por_tamanho": True},
            {"material_codigo": "verniz-automotivo", "quantidade": "0.20", "unidade": "L", "afetado_por_tamanho": True},
        ],
        "motivo": "Ficha inicial DS Car — pintura de para-choque dianteiro (setup_fichas_base)",
    },
    # 2. Pintura Para-choque Traseiro
    {
        "servico_codigo": "pintura-para-choque-traseiro",
        "maos_obra": [
            {"categoria_codigo": "pintor", "horas": "2.00", "afetada_por_tamanho": True},
            {"categoria_codigo": "auxiliar", "horas": "0.50", "afetada_por_tamanho": True},
        ],
        "insumos": [
            {"material_codigo": "primer-epóxi", "quantidade": "0.15", "unidade": "L", "afetado_por_tamanho": True},
            {"material_codigo": "tinta-solida", "quantidade": "0.30", "unidade": "L", "afetado_por_tamanho": True},
            {"material_codigo": "verniz-automotivo", "quantidade": "0.20", "unidade": "L", "afetado_por_tamanho": True},
        ],
        "motivo": "Ficha inicial DS Car — pintura de para-choque traseiro (setup_fichas_base)",
    },
    # 3. Pintura de Porta
    {
        "servico_codigo": "pintura-porta",
        "maos_obra": [
            {"categoria_codigo": "pintor", "horas": "3.00", "afetada_por_tamanho": True},
            {"categoria_codigo": "auxiliar", "horas": "1.00", "afetada_por_tamanho": True},
        ],
        "insumos": [
            {"material_codigo": "primer-epóxi", "quantidade": "0.20", "unidade": "L", "afetado_por_tamanho": True},
            {"material_codigo": "tinta-solida", "quantidade": "0.40", "unidade": "L", "afetado_por_tamanho": True},
            {"material_codigo": "verniz-automotivo", "quantidade": "0.25", "unidade": "L", "afetado_por_tamanho": True},
        ],
        "motivo": "Ficha inicial DS Car — pintura de porta (setup_fichas_base)",
    },
    # 4. Pintura de Capô
    {
        "servico_codigo": "pintura-capô",
        "maos_obra": [
            {"categoria_codigo": "pintor", "horas": "4.00", "afetada_por_tamanho": True},
            {"categoria_codigo": "auxiliar", "horas": "1.50", "afetada_por_tamanho": True},
        ],
        "insumos": [
            {"material_codigo": "primer-epóxi", "quantidade": "0.30", "unidade": "L", "afetado_por_tamanho": True},
            {"material_codigo": "tinta-solida", "quantidade": "0.50", "unidade": "L", "afetado_por_tamanho": True},
            {"material_codigo": "verniz-automotivo", "quantidade": "0.35", "unidade": "L", "afetado_por_tamanho": True},
        ],
        "motivo": "Ficha inicial DS Car — pintura de capô (setup_fichas_base)",
    },
    # 5. Funilaria Para-choque Dianteiro (amassado simples)
    {
        "servico_codigo": "funilaria-para-choque-dianteiro",
        "maos_obra": [
            {"categoria_codigo": "funileiro", "horas": "2.00", "afetada_por_tamanho": True},
        ],
        "insumos": [
            {"material_codigo": "lixa-p80", "quantidade": "3.0000", "unidade": "un", "afetado_por_tamanho": False},
        ],
        "motivo": "Ficha inicial DS Car — funilaria para-choque dianteiro (setup_fichas_base)",
    },
    # 6. Polimento Simples
    {
        "servico_codigo": "polimento-simples",
        "maos_obra": [
            {"categoria_codigo": "polidor", "horas": "1.50", "afetada_por_tamanho": True},
        ],
        "insumos": [
            {"material_codigo": "polish-abrasivo", "quantidade": "0.1500", "unidade": "kg", "afetado_por_tamanho": True},
        ],
        "motivo": "Ficha inicial DS Car — polimento simples (setup_fichas_base)",
    },
    # 7. Remoção e Instalação de Para-choque (dianteiro)
    {
        "servico_codigo": "remocao-para-choque",
        "maos_obra": [
            {"categoria_codigo": "montador", "horas": "0.50", "afetada_por_tamanho": False},
        ],
        "insumos": [],
        "motivo": "Ficha inicial DS Car — remoção/instalação para-choque (setup_fichas_base)",
    },
    # 8. Remoção e Instalação de Porta
    {
        "servico_codigo": "remocao-porta",
        "maos_obra": [
            {"categoria_codigo": "montador", "horas": "0.50", "afetada_por_tamanho": False},
        ],
        "insumos": [],
        "motivo": "Ficha inicial DS Car — remoção/instalação porta (setup_fichas_base)",
    },
    # 9. Lavagem Completa
    {
        "servico_codigo": "lavagem-completa",
        "maos_obra": [
            {"categoria_codigo": "lavador", "horas": "1.00", "afetada_por_tamanho": False},
        ],
        "insumos": [],
        "motivo": "Ficha inicial DS Car — lavagem completa (setup_fichas_base)",
    },
    # 10. Higienização Interna
    {
        "servico_codigo": "higienizacao-interna",
        "maos_obra": [
            {"categoria_codigo": "lavador", "horas": "2.00", "afetada_por_tamanho": False},
        ],
        "insumos": [],
        "motivo": "Ficha inicial DS Car — higienização interna (setup_fichas_base)",
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Command
# ─────────────────────────────────────────────────────────────────────────────


class Command(BaseCommand):
    """Popula as fichas técnicas base do Motor de Orçamentos (idempotente).

    Cria FichaTecnicaServico genéricas (tipo_pintura=None) para os top-10
    serviços DS Car. Pula serviços que já possuem ficha ativa.

    Dependência: setup_catalogo_base deve ter sido executado antes.
    """

    help = "Popula as fichas técnicas base do Motor de Orçamentos (idempotente)"

    def add_arguments(self, parser: ArgumentParser) -> None:
        """Registra os argumentos do comando."""
        group = parser.add_mutually_exclusive_group(required=True)
        group.add_argument(
            "--schema",
            type=str,
            help="Schema do tenant onde os dados serão criados (ex: tenant_dscar).",
        )
        group.add_argument(
            "--all-tenants",
            action="store_true",
            help="Executa em todos os tenants não-públicos.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simula a operação sem persistir nenhuma alteração.",
        )

    def handle(self, *args: object, **options: object) -> None:
        """Ponto de entrada do comando."""
        from apps.tenants.models import Company

        schema_name: str | None = options.get("schema")  # type: ignore[assignment]
        all_tenants: bool = bool(options.get("all_tenants"))
        dry_run: bool = bool(options.get("dry_run"))

        if dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN — nenhuma alteração será salva\n")
            )

        if all_tenants:
            schemas: list[str] = list(
                Company.objects.exclude(schema_name="public").values_list(
                    "schema_name", flat=True
                )
            )
        else:
            if not Company.objects.filter(schema_name=schema_name).exists():
                raise CommandError(
                    f"Schema '{schema_name}' não encontrado. "
                    "Use 'manage.py shell' para listar os tenants disponíveis."
                )
            schemas = [schema_name]  # type: ignore[list-item]

        for schema in schemas:
            self.stdout.write(
                self.style.NOTICE(f"\n[{schema}] === Setup Fichas Técnicas Base ===\n")
            )
            with schema_context(schema):
                self._run_setup(dry_run=dry_run)

        self.stdout.write(self.style.SUCCESS("\nSetup de fichas técnicas concluído."))

    def _run_setup(self, *, dry_run: bool) -> None:
        """Executa o setup dentro do schema_context correto."""
        try:
            with transaction.atomic():
                self._setup_fichas()

                if dry_run:
                    raise _DryRunRollback()

        except _DryRunRollback:
            self.stdout.write(
                self.style.WARNING("  Rollback executado (dry-run) — nada foi salvo.\n")
            )

    def _setup_fichas(self) -> None:
        """Cria fichas técnicas base para os serviços configurados.

        Idempotente: pula serviços que já possuem ficha ativa com tipo_pintura=NULL.
        Ignora silenciosamente serviços ou materiais/categorias inexistentes no catálogo.
        """
        from apps.authentication.models import GlobalUser
        from apps.pricing_catalog.models import (
            CategoriaMaoObra,
            MaterialCanonico,
            ServicoCanonico,
        )
        from apps.pricing_tech.models import FichaTecnicaServico
        from apps.pricing_tech.services import FichaTecnicaService

        # Pega primeiro GlobalUser do schema como autor (ou None)
        user = GlobalUser.objects.first()
        user_id = str(user.pk) if user else None

        self.stdout.write("Fichas técnicas base...")
        created = skipped = errors = 0

        for ficha_data in FICHAS_BASE:
            servico_codigo: str = ficha_data["servico_codigo"]

            # Verifica se servico existe no catálogo
            try:
                servico = ServicoCanonico.objects.get(codigo=servico_codigo)
            except ServicoCanonico.DoesNotExist:
                logger.warning(
                    "setup_fichas_base: ServiçoCanonico '%s' não encontrado — pulando.",
                    servico_codigo,
                )
                skipped += 1
                continue

            # Idempotente: pula se já existe ficha ativa genérica
            ja_existe = FichaTecnicaServico.objects.filter(
                servico=servico,
                tipo_pintura__isnull=True,
                is_active=True,
            ).exists()
            if ja_existe:
                self.stdout.write(f"  [skip] {servico_codigo} — já possui ficha ativa")
                skipped += 1
                continue

            # Monta dados de mão de obra, ignorando categorias inexistentes
            maos_obra_data: list[dict[str, Any]] = []
            for mo in ficha_data["maos_obra"]:
                try:
                    cat_mo = CategoriaMaoObra.objects.get(codigo=mo["categoria_codigo"])
                    maos_obra_data.append(
                        {
                            "categoria_id": cat_mo.pk,
                            "horas": mo["horas"],
                            "afetada_por_tamanho": mo["afetada_por_tamanho"],
                            "observacao": "",
                        }
                    )
                except CategoriaMaoObra.DoesNotExist:
                    logger.warning(
                        "setup_fichas_base: CategoriaMaoObra '%s' não encontrada — "
                        "pulando item de mão de obra em '%s'.",
                        mo["categoria_codigo"],
                        servico_codigo,
                    )

            # Monta dados de insumos, ignorando materiais inexistentes
            insumos_data: list[dict[str, Any]] = []
            for ins in ficha_data["insumos"]:
                try:
                    material = MaterialCanonico.objects.get(codigo=ins["material_codigo"])
                    insumos_data.append(
                        {
                            "material_canonico_id": material.pk,
                            "quantidade": ins["quantidade"],
                            "unidade": ins["unidade"],
                            "afetado_por_tamanho": ins["afetado_por_tamanho"],
                            "observacao": "",
                        }
                    )
                except MaterialCanonico.DoesNotExist:
                    logger.warning(
                        "setup_fichas_base: MaterialCanonico '%s' não encontrado — "
                        "pulando insumo em '%s'.",
                        ins["material_codigo"],
                        servico_codigo,
                    )

            # Pula se não tem nenhuma mão de obra (ficha inútil)
            if not maos_obra_data:
                logger.warning(
                    "setup_fichas_base: '%s' sem mão de obra válida — pulando.",
                    servico_codigo,
                )
                skipped += 1
                continue

            try:
                FichaTecnicaService.criar_nova_versao(
                    servico_id=str(servico.pk),
                    tipo_pintura_id=None,
                    maos_obra_data=maos_obra_data,
                    insumos_data=insumos_data,
                    motivo=ficha_data["motivo"],
                    user_id=user_id or "",
                )
                self.stdout.write(f"  [criada] {servico_codigo}")
                created += 1
            except Exception as exc:
                logger.error(
                    "setup_fichas_base: erro ao criar ficha para '%s': %s",
                    servico_codigo,
                    exc,
                )
                errors += 1

        msg = f"  {created} fichas criadas, {skipped} puladas"
        if errors:
            msg += f", {errors} erros"
            self.stderr.write(msg + "\n")
        else:
            self.stdout.write(msg + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# Sentinela interna para dry-run rollback
# ─────────────────────────────────────────────────────────────────────────────


class _DryRunRollback(Exception):
    """Exceção interna usada para forçar rollback em modo dry-run."""
