"""
Paddock Solutions — Pricing Catalog — Celery Tasks
Motor de Orçamentos (MO) — Sprint 02: Catálogo Técnico

Tasks assíncronas para geração de embeddings dos canônicos.
Todas as tasks recebem tenant_schema e usam schema_context (multitenancy seguro).
"""
import logging

from celery import shared_task
from django_tenants.utils import schema_context

logger = logging.getLogger(__name__)

BATCH_SIZE = 128


@shared_task(bind=True, max_retries=3)
def embed_canonicos_pendentes(self, tenant_schema: str) -> dict[str, int]:
    """Gera embeddings para todos os canônicos sem embedding.

    Processa ServicoCanonico, PecaCanonica e MaterialCanonico em bulk,
    respeitando o limite de BATCH_SIZE (128) textos por request Voyage AI.
    Em caso de falha transitória, realiza até 3 retentativas com cooldown de 60s.

    Args:
        tenant_schema: Schema do tenant (ex: "tenant_dscar") para schema_context.

    Returns:
        Dicionário com total processado por tipo:
        {"servicos": N, "pecas": N, "materiais": N}
    """
    from apps.pricing_catalog.models import MaterialCanonico, PecaCanonica, ServicoCanonico
    from apps.pricing_catalog.utils.embeddings import embed_texts

    totais: dict[str, int] = {"servicos": 0, "pecas": 0, "materiais": 0}

    with schema_context(tenant_schema):
        for model, chave in [
            (ServicoCanonico, "servicos"),
            (PecaCanonica, "pecas"),
            (MaterialCanonico, "materiais"),
        ]:
            qs = list(model.objects.filter(embedding__isnull=True, is_active=True))
            if not qs:
                continue

            # Monta textos para embedding
            textos: list[str] = []
            for obj in qs:
                if model is ServicoCanonico:
                    descricao = obj.descricao or ""
                    textos.append(f"{obj.nome}. {descricao}".strip())
                else:
                    textos.append(obj.nome)

            try:
                vetores = embed_texts(textos)
                for obj, vetor in zip(qs, vetores):
                    obj.embedding = vetor
                    obj.save(update_fields=["embedding"])
                totais[chave] = len(qs)
                logger.info(
                    "embed_canonicos_pendentes [%s] %s: %d embeddings gerados",
                    tenant_schema,
                    model.__name__,
                    len(qs),
                )
            except Exception as exc:
                logger.error(
                    "Erro ao gerar embeddings para %s (tenant=%s): %s",
                    model.__name__,
                    tenant_schema,
                    exc,
                )
                raise self.retry(exc=exc, countdown=60)

    return totais
