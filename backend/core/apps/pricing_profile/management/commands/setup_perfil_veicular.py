"""
Management command para configuração inicial do perfil veicular.
Popula SegmentoVeicular, CategoriaTamanho, TipoPintura e EnquadramentoVeiculo.
Idempotente: update_or_create em todos os registros.

Uso:
    python manage.py setup_perfil_veicular --schema tenant_dscar
    python manage.py setup_perfil_veicular --all-tenants
    python manage.py setup_perfil_veicular --schema tenant_dscar --skip-enquadramentos
"""
import json
import logging
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django_tenants.utils import schema_context

from apps.pricing_profile.models import (
    CategoriaTamanho,
    EnquadramentoVeiculo,
    SegmentoVeicular,
    TipoPintura,
)

logger = logging.getLogger(__name__)

SEGMENTOS: list[dict[str, Any]] = [
    {
        "codigo": "popular",
        "nome": "Popular",
        "ordem": 1,
        "fator_responsabilidade": "1.00",
        "descricao": "Veículos populares: Onix, Gol, Palio, Uno, HB20",
    },
    {
        "codigo": "medio",
        "nome": "Médio",
        "ordem": 2,
        "fator_responsabilidade": "1.25",
        "descricao": "Veículos de médio padrão: Corolla, Civic, Cruze",
    },
    {
        "codigo": "premium",
        "nome": "Premium",
        "ordem": 3,
        "fator_responsabilidade": "1.55",
        "descricao": "Veículos premium: BMW 3, Mercedes C, Audi A4",
    },
    {
        "codigo": "luxo",
        "nome": "Luxo",
        "ordem": 4,
        "fator_responsabilidade": "1.90",
        "descricao": "Veículos de luxo: BMW 5, Mercedes E, Porsche Macan",
    },
    {
        "codigo": "exotico",
        "nome": "Exótico",
        "ordem": 5,
        "fator_responsabilidade": "2.50",
        "descricao": "Veículos exóticos: Ferrari, Lamborghini, McLaren",
    },
]

TAMANHOS: list[dict[str, Any]] = [
    {
        "codigo": "compacto",
        "nome": "Compacto",
        "ordem": 1,
        "multiplicador_insumos": "0.75",
        "multiplicador_horas": "0.85",
    },
    {
        "codigo": "medio",
        "nome": "Médio",
        "ordem": 2,
        "multiplicador_insumos": "1.00",
        "multiplicador_horas": "1.00",
    },
    {
        "codigo": "suv_grande",
        "nome": "SUV / Grande",
        "ordem": 3,
        "multiplicador_insumos": "1.25",
        "multiplicador_horas": "1.10",
    },
    {
        "codigo": "extra_grande",
        "nome": "Extra Grande",
        "ordem": 4,
        "multiplicador_insumos": "1.45",
        "multiplicador_horas": "1.20",
    },
]

TIPOS_PINTURA: list[dict[str, Any]] = [
    {"codigo": "solida", "nome": "Sólida", "complexidade": 1},
    {"codigo": "metalica", "nome": "Metálica", "complexidade": 2},
    {"codigo": "perolizada", "nome": "Perolizada", "complexidade": 3},
    {"codigo": "tricoat", "nome": "Tricoat", "complexidade": 4},
]


class Command(BaseCommand):
    """Configura dados iniciais de perfil veicular.

    Popula segmentos, tamanhos de veículo, tipos de pintura e
    enquadramentos (top marcas/modelos BR) a partir de dados estáticos
    e do arquivo seeds/enquadramentos.json.

    Idempotente: pode ser executado múltiplas vezes com segurança.
    """

    help = "Configura dados iniciais de perfil veicular (segmentos, tamanhos, pinturas, enquadramentos)"

    def add_arguments(self, parser: Any) -> None:
        """Adiciona argumentos ao comando."""
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
            "--skip-enquadramentos",
            action="store_true",
            help="Pula a criação dos enquadramentos (útil para testes rápidos).",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        """Executa o comando de setup."""
        from apps.tenants.models import Company

        schema_name = options.get("schema")
        all_tenants = options.get("all_tenants")
        skip_enquadramentos = options["skip_enquadramentos"]

        if all_tenants:
            schemas = list(
                Company.objects.exclude(schema_name="public")
                .values_list("schema_name", flat=True)
            )
        else:
            if not Company.objects.filter(schema_name=schema_name).exists():
                raise CommandError(
                    f"Schema '{schema_name}' não encontrado. "
                    "Use 'manage.py shell' para listar os tenants disponíveis."
                )
            schemas = [schema_name]

        for schema in schemas:
            self.stdout.write(
                self.style.NOTICE(f"\n[{schema}] === Setup Perfil Veicular ===\n")
            )
            with schema_context(schema):
                self._run_setup(skip_enquadramentos)

        self.stdout.write(self.style.SUCCESS("\nSetup concluído."))

    def _run_setup(self, skip_enquadramentos: bool) -> None:
        """Executa todo o setup dentro do schema_context correto."""
        # 1. Segmentos
        self._setup_segmentos()

        # 2. Categorias de Tamanho
        self._setup_tamanhos()

        # 3. Tipos de Pintura
        self._setup_tipos_pintura()

        # 4. Enquadramentos
        if not skip_enquadramentos:
            self._setup_enquadramentos()
        else:
            self.stdout.write("  Enquadramentos: ignorados (--skip-enquadramentos)\n")

    def _setup_segmentos(self) -> None:
        """Cria ou atualiza os 5 segmentos veiculares."""
        self.stdout.write("Segmentos veiculares...")
        created = updated = 0
        for data in SEGMENTOS:
            _, is_new = SegmentoVeicular.objects.update_or_create(
                codigo=data["codigo"],
                defaults={
                    "nome": data["nome"],
                    "ordem": data["ordem"],
                    "fator_responsabilidade": data["fator_responsabilidade"],
                    "descricao": data["descricao"],
                    "is_active": True,
                },
            )
            if is_new:
                created += 1
            else:
                updated += 1
        self.stdout.write(f"  {created} criados, {updated} atualizados\n")

    def _setup_tamanhos(self) -> None:
        """Cria ou atualiza as 4 categorias de tamanho."""
        self.stdout.write("Categorias de tamanho...")
        created = updated = 0
        for data in TAMANHOS:
            _, is_new = CategoriaTamanho.objects.update_or_create(
                codigo=data["codigo"],
                defaults={
                    "nome": data["nome"],
                    "ordem": data["ordem"],
                    "multiplicador_insumos": data["multiplicador_insumos"],
                    "multiplicador_horas": data["multiplicador_horas"],
                    "is_active": True,
                },
            )
            if is_new:
                created += 1
            else:
                updated += 1
        self.stdout.write(f"  {created} criados, {updated} atualizados\n")

    def _setup_tipos_pintura(self) -> None:
        """Cria ou atualiza os 4 tipos de pintura."""
        self.stdout.write("Tipos de pintura...")
        created = updated = 0
        for data in TIPOS_PINTURA:
            _, is_new = TipoPintura.objects.update_or_create(
                codigo=data["codigo"],
                defaults={
                    "nome": data["nome"],
                    "complexidade": data["complexidade"],
                    "is_active": True,
                },
            )
            if is_new:
                created += 1
            else:
                updated += 1
        self.stdout.write(f"  {created} criados, {updated} atualizados\n")

    def _setup_enquadramentos(self) -> None:
        """Cria enquadramentos a partir de seeds/enquadramentos.json."""
        seeds_path = (
            Path(__file__).parent.parent.parent / "seeds" / "enquadramentos.json"
        )
        if not seeds_path.exists():
            self.stderr.write(f"  AVISO: seeds não encontrado em {seeds_path}\n")
            return

        with seeds_path.open(encoding="utf-8") as f:
            enquadramentos: list[dict[str, Any]] = json.load(f)

        self.stdout.write(f"Enquadramentos ({len(enquadramentos)} registros)...")
        created = updated = errors = 0

        for item in enquadramentos:
            try:
                segmento = SegmentoVeicular.objects.get(codigo=item["segmento_codigo"])
                tamanho = CategoriaTamanho.objects.get(codigo=item["tamanho_codigo"])
                tipo_pintura = None
                if item.get("tipo_pintura_codigo"):
                    tipo_pintura = TipoPintura.objects.filter(
                        codigo=item["tipo_pintura_codigo"]
                    ).first()

                _, is_new = EnquadramentoVeiculo.objects.update_or_create(
                    marca=item["marca"].upper(),
                    modelo=item.get("modelo", "").upper(),
                    ano_inicio=item.get("ano_inicio"),
                    ano_fim=item.get("ano_fim"),
                    defaults={
                        "segmento": segmento,
                        "tamanho": tamanho,
                        "tipo_pintura_default": tipo_pintura,
                        "prioridade": item.get("prioridade", 100),
                        "is_active": True,
                    },
                )
                if is_new:
                    created += 1
                else:
                    updated += 1
            except Exception as exc:
                logger.error("Erro ao criar enquadramento %s: %s", item, exc)
                errors += 1

        self.stdout.write(
            f"  {created} criados, {updated} atualizados, {errors} erros\n"
        )
