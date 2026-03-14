"""
Paddock Solutions — AI App
Recomendações via Claude API + RAG com pgvector
"""
import uuid

from django.db import models
from pgvector.django import VectorField

from apps.authentication.models import PaddockBaseModel


class AIRecommendation(PaddockBaseModel):
    """
    Recomendações geradas pela IA para uma OS ou atendimento.
    Geradas assincronamente via Celery — nunca bloqueiam o operador.
    """

    entity_type = models.CharField(max_length=50)  # 'service_order', 'customer', etc.
    entity_id = models.UUIDField(db_index=True)
    model_used = models.CharField(max_length=50)
    items = models.JSONField(default=list)  # lista de recomendações estruturadas
    accepted_items = models.JSONField(default=list)  # feedback loop DW
    rejected_items = models.JSONField(default=list)

    class Meta(PaddockBaseModel.Meta):
        db_table = "ai_recommendation"
        verbose_name = "Recomendação IA"
        verbose_name_plural = "Recomendações IA"


class KnowledgeChunk(models.Model):
    """
    Chunk de conhecimento para RAG — indexado no pgvector.
    Manuais, histórico de OS, dados FIPE, etc.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source_type = models.CharField(max_length=50)  # 'manual', 'service_order', 'fipe'
    source_id = models.CharField(max_length=200)
    content = models.TextField()
    embedding = VectorField(dimensions=1536, null=True)  # OpenAI ada-002 / Voyage
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ai_knowledge_chunk"
        indexes = [
            models.Index(fields=["source_type", "source_id"]),
        ]
        verbose_name = "Chunk de Conhecimento"
        verbose_name_plural = "Chunks de Conhecimento"
