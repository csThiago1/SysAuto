"""
Management command para configuração inicial do catálogo base do Motor de Orçamentos.
Popula CategoriaServico, CategoriaMaoObra, MaterialCanonico e ServicoCanonico.
Idempotente: update_or_create por código em todos os registros.

Uso:
    python manage.py setup_catalogo_base --schema tenant_dscar
    python manage.py setup_catalogo_base --all-tenants
    python manage.py setup_catalogo_base --schema tenant_dscar --dry-run
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
# ─────────────────────────────────────────────────────────────────────────────

CATEGORIAS_SERVICO: list[dict[str, Any]] = [
    {"codigo": "funilaria", "nome": "Funilaria", "ordem": 10},
    {"codigo": "pintura", "nome": "Pintura", "ordem": 20},
    {"codigo": "restauracao", "nome": "Restauração", "ordem": 30},
    {"codigo": "polimento", "nome": "Polimento e Vitrificação", "ordem": 40},
    {"codigo": "lavagem", "nome": "Lavagem e Higienização", "ordem": 50},
    {"codigo": "remocao-instalacao", "nome": "Remoção e Instalação", "ordem": 60},
    {"codigo": "eletrica", "nome": "Elétrica e Eletrônica", "ordem": 70},
    {"codigo": "mecanica", "nome": "Mecânica", "ordem": 80},
    {"codigo": "alinhamento", "nome": "Alinhamento e Geometria", "ordem": 90},
    {"codigo": "balanceamento", "nome": "Balanceamento", "ordem": 100},
    {"codigo": "diagnostico", "nome": "Diagnóstico e Inspeção", "ordem": 110},
    {"codigo": "outros", "nome": "Outros Serviços", "ordem": 200},
]

CATEGORIAS_MAO_OBRA: list[dict[str, Any]] = [
    {"codigo": "funileiro", "nome": "Funileiro", "ordem": 10},
    {"codigo": "pintor", "nome": "Pintor", "ordem": 20},
    {"codigo": "montador", "nome": "Montador / Desmontador", "ordem": 30},
    {"codigo": "eletricista", "nome": "Eletricista Automotivo", "ordem": 40},
    {"codigo": "mecanico", "nome": "Mecânico", "ordem": 50},
    {"codigo": "polidor", "nome": "Polidor", "ordem": 60},
    {"codigo": "lavador", "nome": "Lavador / Higienizador", "ordem": 70},
    {"codigo": "auxiliar", "nome": "Auxiliar de Oficina", "ordem": 80},
]

MATERIAIS: list[dict[str, Any]] = [
    {"codigo": "primer-epóxi", "nome": "Primer Epóxi", "unidade_base": "L", "tipo": "consumivel"},
    {"codigo": "tinta-base-metalica", "nome": "Tinta Base Metálica", "unidade_base": "L", "tipo": "consumivel"},
    {"codigo": "tinta-solida", "nome": "Tinta Sólida", "unidade_base": "L", "tipo": "consumivel"},
    {"codigo": "verniz-automotivo", "nome": "Verniz Automotivo", "unidade_base": "L", "tipo": "consumivel"},
    {"codigo": "thinner-rapido", "nome": "Thinner Rápido", "unidade_base": "L", "tipo": "consumivel"},
    {"codigo": "thinner-lento", "nome": "Thinner Lento / Redutor", "unidade_base": "L", "tipo": "consumivel"},
    {"codigo": "lixa-p80", "nome": "Lixa Seco P80", "unidade_base": "un", "tipo": "consumivel"},
    {"codigo": "lixa-p120", "nome": "Lixa Seco P120", "unidade_base": "un", "tipo": "consumivel"},
    {"codigo": "lixa-p320", "nome": "Lixa D'Água P320", "unidade_base": "un", "tipo": "consumivel"},
    {"codigo": "lixa-p600", "nome": "Lixa D'Água P600", "unidade_base": "un", "tipo": "consumivel"},
    {"codigo": "lixa-p1200", "nome": "Lixa D'Água P1200", "unidade_base": "un", "tipo": "consumivel"},
    {"codigo": "massa-polies", "nome": "Massa Poliéster", "unidade_base": "kg", "tipo": "consumivel"},
    {"codigo": "fita-crepe", "nome": "Fita Crepe 48mm", "unidade_base": "un", "tipo": "consumivel"},
    {"codigo": "papel-mascaramento", "nome": "Papel de Mascaramento", "unidade_base": "m2", "tipo": "consumivel"},
    {"codigo": "graxa-branca", "nome": "Graxa Branca Multifuncional", "unidade_base": "kg", "tipo": "consumivel"},
    {"codigo": "limpa-contato", "nome": "Limpa Contato Elétrico", "unidade_base": "L", "tipo": "consumivel"},
    {"codigo": "selante-poliuretano", "nome": "Selante de Poliuretano", "unidade_base": "kg", "tipo": "consumivel"},
    {"codigo": "silicone-automotivo", "nome": "Silicone Automotivo", "unidade_base": "kg", "tipo": "consumivel"},
    {"codigo": "polish-abrasivo", "nome": "Polish Abrasivo", "unidade_base": "kg", "tipo": "consumivel"},
    {"codigo": "coat-ceramico", "nome": "Coating Cerâmico 9H", "unidade_base": "ml", "tipo": "consumivel"},
]

# Armadilha A3: aplica_multiplicador_tamanho=True APENAS em pintura, funilaria,
# polimento/vitrificação. Default False é obrigatório para todos os demais.
SERVICOS: list[dict[str, Any]] = [
    # Funilaria — aplica_multiplicador_tamanho=True
    {
        "codigo": "funilaria-para-choque-dianteiro",
        "nome": "Funilaria Para-choque Dianteiro",
        "categoria": "funilaria",
        "aplica_multiplicador_tamanho": True,
    },
    {
        "codigo": "funilaria-para-choque-traseiro",
        "nome": "Funilaria Para-choque Traseiro",
        "categoria": "funilaria",
        "aplica_multiplicador_tamanho": True,
    },
    {
        "codigo": "funilaria-porta",
        "nome": "Funilaria de Porta",
        "categoria": "funilaria",
        "aplica_multiplicador_tamanho": True,
    },
    {
        "codigo": "funilaria-capô",
        "nome": "Funilaria de Capô",
        "categoria": "funilaria",
        "aplica_multiplicador_tamanho": True,
    },
    {
        "codigo": "funilaria-paralama",
        "nome": "Funilaria de Paralama",
        "categoria": "funilaria",
        "aplica_multiplicador_tamanho": True,
    },
    {
        "codigo": "funilaria-lateral-traseira",
        "nome": "Funilaria Lateral Traseira",
        "categoria": "funilaria",
        "aplica_multiplicador_tamanho": True,
    },
    # Pintura — aplica_multiplicador_tamanho=True
    {
        "codigo": "pintura-para-choque-dianteiro",
        "nome": "Pintura Para-choque Dianteiro",
        "categoria": "pintura",
        "aplica_multiplicador_tamanho": True,
    },
    {
        "codigo": "pintura-para-choque-traseiro",
        "nome": "Pintura Para-choque Traseiro",
        "categoria": "pintura",
        "aplica_multiplicador_tamanho": True,
    },
    {
        "codigo": "pintura-porta",
        "nome": "Pintura de Porta",
        "categoria": "pintura",
        "aplica_multiplicador_tamanho": True,
    },
    {
        "codigo": "pintura-capô",
        "nome": "Pintura de Capô",
        "categoria": "pintura",
        "aplica_multiplicador_tamanho": True,
    },
    {
        "codigo": "pintura-paralama",
        "nome": "Pintura de Paralama",
        "categoria": "pintura",
        "aplica_multiplicador_tamanho": True,
    },
    {
        "codigo": "pintura-teto",
        "nome": "Pintura de Teto",
        "categoria": "pintura",
        "aplica_multiplicador_tamanho": True,
    },
    {
        "codigo": "pintura-total",
        "nome": "Pintura Total do Veículo",
        "categoria": "pintura",
        "aplica_multiplicador_tamanho": True,
    },
    # Polimento / Vitrificação — aplica_multiplicador_tamanho=True
    {
        "codigo": "polimento-simples",
        "nome": "Polimento Simples",
        "categoria": "polimento",
        "aplica_multiplicador_tamanho": True,
    },
    {
        "codigo": "polimento-completo",
        "nome": "Polimento Completo + Cristalização",
        "categoria": "polimento",
        "aplica_multiplicador_tamanho": True,
    },
    {
        "codigo": "vitrificacao-ceramica",
        "nome": "Vitrificação Cerâmica 9H",
        "categoria": "polimento",
        "aplica_multiplicador_tamanho": True,
    },
    # Remoção / Instalação — aplica_multiplicador_tamanho=False (default)
    {
        "codigo": "remocao-para-choque",
        "nome": "Remoção e Instalação de Para-choque",
        "categoria": "remocao-instalacao",
        "aplica_multiplicador_tamanho": False,
    },
    {
        "codigo": "remocao-porta",
        "nome": "Remoção e Instalação de Porta",
        "categoria": "remocao-instalacao",
        "aplica_multiplicador_tamanho": False,
    },
    {
        "codigo": "remocao-capô",
        "nome": "Remoção e Instalação de Capô",
        "categoria": "remocao-instalacao",
        "aplica_multiplicador_tamanho": False,
    },
    {
        "codigo": "remocao-paralama",
        "nome": "Remoção e Instalação de Paralama",
        "categoria": "remocao-instalacao",
        "aplica_multiplicador_tamanho": False,
    },
    # Lavagem — aplica_multiplicador_tamanho=False
    {
        "codigo": "lavagem-completa",
        "nome": "Lavagem Completa",
        "categoria": "lavagem",
        "aplica_multiplicador_tamanho": False,
    },
    {
        "codigo": "higienizacao-interna",
        "nome": "Higienização Interna",
        "categoria": "lavagem",
        "aplica_multiplicador_tamanho": False,
    },
    # Elétrica — aplica_multiplicador_tamanho=False
    {
        "codigo": "diagnostico-eletrico",
        "nome": "Diagnóstico Elétrico",
        "categoria": "eletrica",
        "aplica_multiplicador_tamanho": False,
    },
    {
        "codigo": "troca-bateria",
        "nome": "Troca de Bateria",
        "categoria": "eletrica",
        "aplica_multiplicador_tamanho": False,
    },
    # Mecânica / Alinhamento / Balanceamento — aplica_multiplicador_tamanho=False
    {
        "codigo": "alinhamento-geometria",
        "nome": "Alinhamento e Geometria",
        "categoria": "alinhamento",
        "aplica_multiplicador_tamanho": False,
    },
    {
        "codigo": "balanceamento-rodas",
        "nome": "Balanceamento de Rodas",
        "categoria": "balanceamento",
        "aplica_multiplicador_tamanho": False,
    },
    {
        "codigo": "troca-oleo-filtro",
        "nome": "Troca de Óleo e Filtro",
        "categoria": "mecanica",
        "aplica_multiplicador_tamanho": False,
    },
    # Diagnóstico — aplica_multiplicador_tamanho=False
    {
        "codigo": "vistoria-entrada",
        "nome": "Vistoria de Entrada",
        "categoria": "diagnostico",
        "aplica_multiplicador_tamanho": False,
    },
    {
        "codigo": "vistoria-saida",
        "nome": "Vistoria de Saída",
        "categoria": "diagnostico",
        "aplica_multiplicador_tamanho": False,
    },
    # Restauração — aplica_multiplicador_tamanho=False
    {
        "codigo": "restauracao-farol",
        "nome": "Restauração de Farol",
        "categoria": "restauracao",
        "aplica_multiplicador_tamanho": False,
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Command
# ─────────────────────────────────────────────────────────────────────────────


class Command(BaseCommand):
    """Popula o catálogo base do Motor de Orçamentos (idempotente).

    Cria CategoriaServico, CategoriaMaoObra, MaterialCanonico e ServicoCanonico
    usando update_or_create por código. Pode ser executado múltiplas vezes com
    segurança — nunca duplica registros.

    Ordem de criação:
        1. CategoriaServico  (sem FK)
        2. CategoriaMaoObra  (sem FK)
        3. MaterialCanonico  (sem FK)
        4. ServicoCanonico   (FK → CategoriaServico)
    """

    help = "Popula o catálogo base do Motor de Orçamentos (idempotente)"

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
                self.style.NOTICE(f"\n[{schema}] === Setup Catálogo Base ===\n")
            )
            with schema_context(schema):
                self._run_setup(dry_run=dry_run)

        self.stdout.write(self.style.SUCCESS("\nSetup concluído."))

    def _run_setup(self, *, dry_run: bool) -> None:
        """Executa todo o setup dentro do schema_context correto."""
        try:
            with transaction.atomic():
                # 1. Categorias sem FK — podem ser criadas em paralelo
                self._setup_categorias_servico()
                self._setup_categorias_mao_obra()
                # 2. Materiais sem FK
                self._setup_materiais()
                # 3. Serviços (FK → CategoriaServico) — criados por último
                self._setup_servicos()

                if dry_run:
                    raise _DryRunRollback()

        except _DryRunRollback:
            self.stdout.write(
                self.style.WARNING("  Rollback executado (dry-run) — nada foi salvo.\n")
            )

    # -------------------------------------------------------------------------
    # Métodos privados de setup
    # -------------------------------------------------------------------------

    def _setup_categorias_servico(self) -> None:
        """Cria ou atualiza as 12 categorias de serviço."""
        from apps.pricing_catalog.models import CategoriaServico

        self.stdout.write("Categorias de serviço...")
        created = updated = 0
        for data in CATEGORIAS_SERVICO:
            _, is_new = CategoriaServico.objects.update_or_create(
                codigo=data["codigo"],
                defaults={
                    "nome": data["nome"],
                    "ordem": data["ordem"],
                    "is_active": True,
                },
            )
            if is_new:
                created += 1
            else:
                updated += 1
        self.stdout.write(f"  {created} criados, {updated} atualizados\n")

    def _setup_categorias_mao_obra(self) -> None:
        """Cria ou atualiza as 8 categorias de mão de obra."""
        from apps.pricing_catalog.models import CategoriaMaoObra

        self.stdout.write("Categorias de mão de obra...")
        created = updated = 0
        for data in CATEGORIAS_MAO_OBRA:
            _, is_new = CategoriaMaoObra.objects.update_or_create(
                codigo=data["codigo"],
                defaults={
                    "nome": data["nome"],
                    "ordem": data["ordem"],
                    "is_active": True,
                },
            )
            if is_new:
                created += 1
            else:
                updated += 1
        self.stdout.write(f"  {created} criados, {updated} atualizados\n")

    def _setup_materiais(self) -> None:
        """Cria ou atualiza os 20 materiais canônicos."""
        from apps.pricing_catalog.models import MaterialCanonico

        self.stdout.write("Materiais canônicos...")
        created = updated = 0
        for data in MATERIAIS:
            _, is_new = MaterialCanonico.objects.update_or_create(
                codigo=data["codigo"],
                defaults={
                    "nome": data["nome"],
                    "unidade_base": data["unidade_base"],
                    "tipo": data["tipo"],
                    "is_active": True,
                },
            )
            if is_new:
                created += 1
            else:
                updated += 1
        self.stdout.write(f"  {created} criados, {updated} atualizados\n")

    def _setup_servicos(self) -> None:
        """Cria ou atualiza os 30 serviços canônicos.

        aplica_multiplicador_tamanho=True APENAS para pintura, funilaria e
        polimento/vitrificação. Todos os demais permanecem False (default seguro).
        """
        from apps.pricing_catalog.models import CategoriaServico, ServicoCanonico

        self.stdout.write("Serviços canônicos...")
        created = updated = errors = 0

        for data in SERVICOS:
            try:
                categoria = CategoriaServico.objects.get(codigo=data["categoria"])
            except CategoriaServico.DoesNotExist:
                logger.error(
                    "Categoria '%s' não encontrada ao criar serviço '%s'.",
                    data["categoria"],
                    data["codigo"],
                )
                errors += 1
                continue

            _, is_new = ServicoCanonico.objects.update_or_create(
                codigo=data["codigo"],
                defaults={
                    "nome": data["nome"],
                    "categoria": categoria,
                    "aplica_multiplicador_tamanho": data["aplica_multiplicador_tamanho"],
                    "is_active": True,
                },
            )
            if is_new:
                created += 1
            else:
                updated += 1

        msg = f"  {created} criados, {updated} atualizados"
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
