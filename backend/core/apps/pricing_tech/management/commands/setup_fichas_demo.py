"""
Paddock Solutions — Pricing Tech — Management Command
setup_fichas_demo: seed fichas técnicas para todos os serviços do catálogo.

Uso:
    python manage.py setup_fichas_demo --schema tenant_dscar
"""
import logging
from decimal import Decimal
from typing import Any

from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context

logger = logging.getLogger(__name__)

# Ficha padrão por categoria de serviço
# Cada config define: nome_contains (keywords), categoria_mo (código),
# horas (Decimal), insumos (list of (material_codigo, quantidade, unidade))
_FICHAS_CONFIG: list[dict[str, Any]] = [
    # Funilaria
    {
        "nome_contains": ["funilaria", "amassado", "chapa"],
        "categoria_mo": "funileiro",
        "horas": Decimal("2.50"),
        "insumos": [],
    },
    # Pintura
    {
        "nome_contains": ["pintura", "pintar"],
        "categoria_mo": "pintor",
        "horas": Decimal("3.00"),
        "insumos": [
            ("tinta-solida",      Decimal("0.500"), "L"),
            ("primer-epóxi",      Decimal("0.200"), "L"),
            ("verniz-automotivo", Decimal("0.300"), "L"),
            ("lixa-p80",          Decimal("2.000"), "un"),
        ],
    },
    # Polimento / vitrificação
    {
        "nome_contains": ["poliment", "vitrific", "cristaliz"],
        "categoria_mo": "polidor",
        "horas": Decimal("1.50"),
        "insumos": [
            ("polish-abrasivo", Decimal("0.150"), "kg"),
        ],
    },
    # Remoção e instalação
    {
        "nome_contains": ["remoção", "instalação", "remocao", "instalacao", "r&i", "r/i"],
        "categoria_mo": "funileiro",
        "horas": Decimal("1.00"),
        "insumos": [],
    },
    # Lavagem / higienização
    {
        "nome_contains": ["lavagem", "higieniz", "limpeza"],
        "categoria_mo": "auxiliar",
        "horas": Decimal("1.00"),
        "insumos": [],
    },
    # Alinhamento / balanceamento
    {
        "nome_contains": ["alinhamento", "balancamento", "balanceamento", "geometria"],
        "categoria_mo": "mecanico",
        "horas": Decimal("0.75"),
        "insumos": [],
    },
    # Elétrica / diagnóstico
    {
        "nome_contains": ["eletric", "diagnóst", "diagnost", "scanner", "computador"],
        "categoria_mo": "eletricista",
        "horas": Decimal("1.00"),
        "insumos": [],
    },
    # Mecânica geral
    {
        "nome_contains": ["troca", "revisão", "revisao", "freio", "embreagem", "suspensão", "suspensao", "motor"],
        "categoria_mo": "mecanico",
        "horas": Decimal("2.00"),
        "insumos": [],
    },
    # Vidros
    {
        "nome_contains": ["vidro", "parabrisa", "película", "pelicula"],
        "categoria_mo": "auxiliar",
        "horas": Decimal("1.50"),
        "insumos": [],
    },
]

_DEFAULT_FICHA: dict[str, Any] = {
    "categoria_mo": "auxiliar",
    "horas": Decimal("1.00"),
    "insumos": [],
}


class Command(BaseCommand):
    help = "Seed fichas técnicas para demo — cria ficha para todo serviço sem ficha."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--schema", type=str, default="")

    def handle(self, *args: object, **options: object) -> None:
        schema: str = str(options.get("schema") or "")
        if schema:
            ctx = schema_context(schema)
            ctx.__enter__()
            try:
                self._run()
            finally:
                ctx.__exit__(None, None, None)
        else:
            self._run()

    def _match_config(self, nome: str) -> dict[str, Any]:
        nome_lower = nome.lower()
        for cfg in _FICHAS_CONFIG:
            if any(kw in nome_lower for kw in cfg["nome_contains"]):
                return cfg
        return _DEFAULT_FICHA

    def _run(self) -> None:
        from apps.authentication.models import GlobalUser
        from apps.pricing_catalog.models import (
            CategoriaMaoObra,
            MaterialCanonico,
            ServicoCanonico,
        )
        from apps.pricing_tech.models import FichaTecnicaServico
        from apps.pricing_tech.services import FichaTecnicaService

        servicos = ServicoCanonico.objects.filter(is_active=True)
        cats_mo = {c.codigo: c for c in CategoriaMaoObra.objects.filter(is_active=True)}
        materiais = {m.codigo: m for m in MaterialCanonico.objects.filter(is_active=True)}

        # Usa primeiro GlobalUser como autor (pode ser None)
        user = GlobalUser.objects.first()
        user_id = str(user.pk) if user else ""

        criadas = 0
        skipped = 0

        for svc in servicos:
            # Já tem ficha genérica ativa?
            if FichaTecnicaServico.objects.filter(
                servico=svc, tipo_pintura__isnull=True, is_active=True
            ).exists():
                skipped += 1
                continue

            cfg = self._match_config(svc.nome)

            # Resolve categoria de mão de obra
            cat_mo = cats_mo.get(cfg["categoria_mo"])
            if cat_mo is None:
                # Fallback: primeira categoria disponível
                cat_mo = next(iter(cats_mo.values()), None)
            if cat_mo is None:
                self.stdout.write(f"  SKIP (sem CategoriaMaoObra): {svc.nome}")
                continue

            # Monta dados de mão de obra
            maos_obra_data: list[dict[str, Any]] = [
                {
                    "categoria_id": str(cat_mo.pk),
                    "horas": str(cfg["horas"]),
                    "afetada_por_tamanho": True,
                    "observacao": "",
                }
            ]

            # Monta dados de insumos (pula materiais não encontrados)
            insumos_data: list[dict[str, Any]] = []
            for mat_codigo, qtd, unidade in cfg.get("insumos", []):
                mat = materiais.get(mat_codigo)
                if mat is None:
                    logger.debug("setup_fichas_demo: material '%s' não encontrado — pulando", mat_codigo)
                    continue
                insumos_data.append(
                    {
                        "material_canonico_id": str(mat.pk),
                        "quantidade": str(qtd),
                        "unidade": unidade,
                        "afetado_por_tamanho": True,
                        "observacao": "",
                    }
                )

            try:
                FichaTecnicaService.criar_nova_versao(
                    servico_id=str(svc.pk),
                    tipo_pintura_id=None,
                    maos_obra_data=maos_obra_data,
                    insumos_data=insumos_data,
                    motivo="Setup demo automático",
                    user_id=user_id,
                )
                n_insumos = len(insumos_data)
                self.stdout.write(
                    f"  + {svc.nome} [{cfg['categoria_mo']}] {cfg['horas']}h {n_insumos} insumo(s)"
                )
                criadas += 1
            except Exception as exc:
                logger.error("setup_fichas_demo: erro em '%s': %s", svc.nome, exc)
                self.stdout.write(f"  ERRO {svc.nome}: {exc}")

        self.stdout.write(
            self.style.SUCCESS(
                f"\nFichas criadas: {criadas}  |  Já tinham ficha: {skipped}"
            )
        )
