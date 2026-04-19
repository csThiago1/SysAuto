from django.contrib import admin

from apps.pricing_benchmark.models import (
    BenchmarkAmostra,
    BenchmarkFonte,
    BenchmarkIngestao,
    SugestaoIA,
)


@admin.register(BenchmarkFonte)
class BenchmarkFonteAdmin(admin.ModelAdmin):
    list_display = ["nome", "tipo", "empresa", "confiabilidade", "is_active"]
    list_filter = ["tipo", "is_active"]
    search_fields = ["nome"]


class BenchmarkAmostraInline(admin.TabularInline):
    model = BenchmarkAmostra
    extra = 0
    readonly_fields = [
        "tipo_item", "servico_canonico", "peca_canonica", "descricao_bruta",
        "alias_match_confianca", "valor_praticado", "data_referencia",
        "revisado", "descartada",
    ]
    can_delete = False


@admin.register(BenchmarkIngestao)
class BenchmarkIngestaoAdmin(admin.ModelAdmin):
    list_display = [
        "fonte", "status", "amostras_importadas", "amostras_descartadas", "criado_em",
    ]
    list_filter = ["status"]
    readonly_fields = [
        "status", "iniciado_em", "concluido_em",
        "amostras_importadas", "amostras_descartadas", "log_erro",
    ]
    inlines = [BenchmarkAmostraInline]

    actions = ["reprocessar"]

    @admin.action(description="Reprocessar PDF")
    def reprocessar(self, request, queryset):
        from apps.pricing_benchmark.tasks import task_processar_pdf_seguradora
        from django.db import connection

        for ing in queryset:
            if ing.arquivo:
                ing.status = "recebido"
                ing.log_erro = ""
                ing.amostras_importadas = 0
                ing.amostras_descartadas = 0
                ing.save()
                task_processar_pdf_seguradora.delay(ing.pk, connection.schema_name)
        self.message_user(request, f"{queryset.count()} ingestão(ões) reprocessada(s).")


@admin.register(BenchmarkAmostra)
class BenchmarkAmostraAdmin(admin.ModelAdmin):
    list_display = [
        "descricao_bruta_curta", "tipo_item", "valor_praticado",
        "alias_match_confianca", "revisado", "descartada", "data_referencia",
    ]
    list_filter = ["tipo_item", "revisado", "descartada", "segmento", "tamanho"]
    search_fields = ["descricao_bruta"]
    readonly_fields = ["ingestao", "fonte", "metadados"]

    def descricao_bruta_curta(self, obj: BenchmarkAmostra) -> str:
        return obj.descricao_bruta[:60]

    descricao_bruta_curta.short_description = "Descrição"  # type: ignore[attr-defined]


@admin.register(SugestaoIA)
class SugestaoIAAdmin(admin.ModelAdmin):
    list_display = ["id", "avaliacao", "modelo_usado", "tempo_resposta_ms", "criado_em"]
    list_filter = ["avaliacao", "modelo_usado"]
    search_fields = ["briefing"]
    readonly_fields = [
        "orcamento", "briefing", "veiculo_info", "resposta_raw",
        "modelo_usado", "tempo_resposta_ms", "criado_por", "criado_em",
    ]
