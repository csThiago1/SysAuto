"""Seeds de estoque: armazéns, tipos de peça, categorias. Idempotente."""
import logging

from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context

from apps.inventory.models_location import Armazem
from apps.inventory.models_product import CategoriaInsumo, CategoriaProduto, TipoPeca

logger = logging.getLogger(__name__)

TIPOS_PECA_DSCAR = [
    {"codigo": "PCHQ", "nome": "Para-choque"},
    {"codigo": "CAPO", "nome": "Capô"},
    {"codigo": "TAMP", "nome": "Tampa Traseira"},
    {"codigo": "PORT", "nome": "Porta"},
    {"codigo": "PBRZ", "nome": "Parabrisas"},
    {"codigo": "VIGA", "nome": "Vigia"},
    {"codigo": "VDPT", "nome": "Vidro de Porta"},
    {"codigo": "VDLT", "nome": "Vidro Lateral"},
    {"codigo": "RETV", "nome": "Retrovisor"},
    {"codigo": "FARL", "nome": "Farol"},
    {"codigo": "LANT", "nome": "Lanterna"},
    {"codigo": "RODA", "nome": "Roda"},
    {"codigo": "PNEU", "nome": "Pneu"},
    {"codigo": "AMRT", "nome": "Amortecedor"},
    {"codigo": "FILT", "nome": "Filtro"},
    {"codigo": "COXM", "nome": "Coxim"},
    {"codigo": "RADI", "nome": "Radiador"},
    {"codigo": "COND", "nome": "Condensador"},
    {"codigo": "ELTV", "nome": "Eletroventilador"},
    {"codigo": "OUTR", "nome": "Outros"},
]

CATEGORIAS_PRODUTO_DSCAR = [
    {"codigo": "FUN", "nome": "Funilaria", "margem_padrao_pct": "35.00"},
    {"codigo": "MEC", "nome": "Mecânica", "margem_padrao_pct": "30.00"},
    {"codigo": "ELE", "nome": "Elétrica", "margem_padrao_pct": "32.00"},
    {"codigo": "VID", "nome": "Vidros", "margem_padrao_pct": "25.00"},
    {"codigo": "SUS", "nome": "Suspensão", "margem_padrao_pct": "28.00"},
    {"codigo": "FRE", "nome": "Freios", "margem_padrao_pct": "30.00"},
    {"codigo": "ARR", "nome": "Arrefecimento", "margem_padrao_pct": "28.00"},
    {"codigo": "INT", "nome": "Interior", "margem_padrao_pct": "35.00"},
    {"codigo": "EXT", "nome": "Exterior", "margem_padrao_pct": "30.00"},
    {"codigo": "OUT", "nome": "Outros", "margem_padrao_pct": "25.00"},
]

CATEGORIAS_INSUMO_DSCAR = [
    {"codigo": "TINT", "nome": "Tintas", "margem_padrao_pct": "40.00"},
    {"codigo": "VERN", "nome": "Vernizes", "margem_padrao_pct": "38.00"},
    {"codigo": "MASS", "nome": "Massas", "margem_padrao_pct": "35.00"},
    {"codigo": "LIXA", "nome": "Lixas e Abrasivos", "margem_padrao_pct": "30.00"},
    {"codigo": "FITA", "nome": "Fitas e Adesivos", "margem_padrao_pct": "30.00"},
    {"codigo": "SOLV", "nome": "Solventes e Diluentes", "margem_padrao_pct": "25.00"},
    {"codigo": "POLI", "nome": "Polimentos", "margem_padrao_pct": "35.00"},
    {"codigo": "COLA", "nome": "Colas e Selantes", "margem_padrao_pct": "30.00"},
    {"codigo": "EPI", "nome": "EPIs e Consumíveis", "margem_padrao_pct": "20.00"},
    {"codigo": "OUTI", "nome": "Outros Insumos", "margem_padrao_pct": "25.00"},
]

ARMAZENS_DSCAR = [
    {"codigo": "G1", "nome": "Galpão Principal", "tipo": "galpao"},
    {"codigo": "G2", "nome": "Galpão Secundário", "tipo": "galpao"},
    {"codigo": "G3", "nome": "Galpão Reserva", "tipo": "galpao"},
    {"codigo": "PT1", "nome": "Pátio Externo", "tipo": "patio"},
]


class Command(BaseCommand):
    help = "Popula dados base de estoque (armazéns DS Car). Idempotente."

    def handle(self, *args: object, **options: object) -> None:
        schema = "tenant_dscar"
        with schema_context(schema):
            created = 0
            for data in ARMAZENS_DSCAR:
                _, was_created = Armazem.objects.get_or_create(
                    codigo=data["codigo"],
                    defaults={"nome": data["nome"], "tipo": data["tipo"]},
                )
                if was_created:
                    created += 1
            logger.info(
                "Armazéns: %d criados, %d já existiam.",
                created,
                len(ARMAZENS_DSCAR) - created,
            )
            # --- Tipos de Peça ---
            tipos_created = 0
            for idx, data in enumerate(TIPOS_PECA_DSCAR, start=1):
                _, was_created = TipoPeca.objects.get_or_create(
                    codigo=data["codigo"],
                    defaults={"nome": data["nome"], "ordem": idx * 10},
                )
                if was_created:
                    tipos_created += 1
            logger.info(
                "Tipos de peça: %d criados, %d já existiam.",
                tipos_created,
                len(TIPOS_PECA_DSCAR) - tipos_created,
            )

            # --- Categorias de Produto (Peças) ---
            cat_prod_created = 0
            for idx, data in enumerate(CATEGORIAS_PRODUTO_DSCAR, start=1):
                _, was_created = CategoriaProduto.objects.get_or_create(
                    codigo=data["codigo"],
                    defaults={
                        "nome": data["nome"],
                        "margem_padrao_pct": data["margem_padrao_pct"],
                        "ordem": idx * 10,
                    },
                )
                if was_created:
                    cat_prod_created += 1
            logger.info(
                "Categorias produto: %d criadas, %d já existiam.",
                cat_prod_created,
                len(CATEGORIAS_PRODUTO_DSCAR) - cat_prod_created,
            )

            # --- Categorias de Insumo ---
            cat_ins_created = 0
            for idx, data in enumerate(CATEGORIAS_INSUMO_DSCAR, start=1):
                _, was_created = CategoriaInsumo.objects.get_or_create(
                    codigo=data["codigo"],
                    defaults={
                        "nome": data["nome"],
                        "margem_padrao_pct": data["margem_padrao_pct"],
                        "ordem": idx * 10,
                    },
                )
                if was_created:
                    cat_ins_created += 1
            logger.info(
                "Categorias insumo: %d criadas, %d já existiam.",
                cat_ins_created,
                len(CATEGORIAS_INSUMO_DSCAR) - cat_ins_created,
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Setup estoque base concluído: {created} armazéns, "
                    f"{tipos_created} tipos de peça, "
                    f"{cat_prod_created} categorias produto, "
                    f"{cat_ins_created} categorias insumo criados."
                )
            )
