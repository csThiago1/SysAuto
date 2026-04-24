"""
Paddock Solutions — Fiscal Admin
MO-5: NF-e de entrada
06B: FiscalConfigModel, FiscalEvent, FiscalDocumentItem
"""

from django.contrib import admin

from apps.fiscal.models import (
    FiscalConfigModel,
    FiscalDocument,
    FiscalDocumentItem,
    FiscalEvent,
    NFeEntrada,
    NFeEntradaItem,
)

# ─── FiscalDocumentItem Inline ────────────────────────────────────────────────


class FiscalDocumentItemInline(admin.TabularInline):
    model = FiscalDocumentItem
    extra = 0
    readonly_fields = ("created_at",)
    fields = (
        "numero_item",
        "descricao",
        "ncm",
        "cfop",
        "unidade",
        "quantidade",
        "valor_unitario",
        "valor_total",
        "valor_desconto",
        "aliquota_iss",
        "aliquota_icms",
        "created_at",
    )


# ─── FiscalDocument ───────────────────────────────────────────────────────────


@admin.register(FiscalDocument)
class FiscalDocumentAdmin(admin.ModelAdmin):
    list_display = (
        "document_type",
        "number",
        "status",
        "total_value",
        "environment",
        "authorized_at",
    )
    list_filter = ("document_type", "status", "environment")
    search_fields = ("key", "number")
    readonly_fields = ("authorized_at", "cancelled_at", "created_at", "updated_at")
    inlines = [FiscalDocumentItemInline]


# ─── FiscalConfigModel ────────────────────────────────────────────────────────


@admin.register(FiscalConfigModel)
class FiscalConfigModelAdmin(admin.ModelAdmin):
    """Configuração fiscal do emissor.

    seq_* são readonly — nunca editar manualmente (podem gerar refs duplicadas).
    """

    list_display = (
        "razao_social",
        "cnpj",
        "environment",
        "is_active",
        "seq_nfse",
        "seq_nfe",
        "seq_nfce",
    )
    list_filter = ("environment", "is_active")
    search_fields = ("cnpj", "razao_social")
    # Sequenciadores NUNCA devem ser editados manualmente
    readonly_fields = ("seq_nfse", "seq_nfe", "seq_nfce", "created_at", "updated_at")
    fieldsets = (
        (
            "Identificação",
            {
                "fields": ("cnpj", "razao_social", "nome_fantasia", "is_active"),
            },
        ),
        (
            "Inscrições",
            {
                "fields": ("inscricao_estadual", "inscricao_municipal", "regime_tributario"),
            },
        ),
        (
            "Configuração Focus",
            {
                "fields": ("focus_token", "environment", "aliquota_iss_default", "serie_rps"),
            },
        ),
        (
            "Endereço",
            {
                "fields": ("endereco",),
            },
        ),
        (
            "Sequenciadores (somente leitura)",
            {
                "fields": ("seq_nfse", "seq_nfe", "seq_nfce"),
                "description": "Nunca editar manualmente — incrementados atomicamente via select_for_update.",
            },
        ),
        (
            "Auditoria",
            {
                "fields": ("created_at", "updated_at"),
            },
        ),
    )


# ─── FiscalEvent ──────────────────────────────────────────────────────────────


@admin.register(FiscalEvent)
class FiscalEventAdmin(admin.ModelAdmin):
    """Log de auditoria fiscal imutável — somente leitura.

    Nunca permite criação ou edição via admin.
    """

    list_display = (
        "event_type",
        "document",
        "http_status",
        "triggered_by",
        "duration_ms",
        "created_at",
    )
    list_filter = ("event_type", "triggered_by")
    search_fields = ("document__key", "document__number", "error_type")
    readonly_fields = (
        "document",
        "event_type",
        "http_status",
        "payload",
        "response",
        "duration_ms",
        "error_type",
        "error_message",
        "triggered_by",
        "created_at",
    )
    ordering = ("-created_at",)

    def has_add_permission(self, request) -> bool:  # type: ignore[override]
        return False

    def has_change_permission(self, request, obj=None) -> bool:  # type: ignore[override]
        return False

    def has_delete_permission(self, request, obj=None) -> bool:  # type: ignore[override]
        return False


# ─── NF-e de Entrada (MO-5) ──────────────────────────────────────────────────


class NFeEntradaItemInline(admin.TabularInline):
    model = NFeEntradaItem
    extra = 0
    readonly_fields = ("status_reconciliacao",)
    fields = (
        "numero_item",
        "descricao_original",
        "codigo_produto_nf",
        "unidade_compra",
        "quantidade",
        "valor_unitario_com_tributos",
        "valor_total_com_tributos",
        "fator_conversao",
        "peca_canonica",
        "material_canonico",
        "status_reconciliacao",
    )


@admin.register(NFeEntrada)
class NFeEntradaAdmin(admin.ModelAdmin):
    list_display = (
        "numero",
        "serie",
        "emitente_nome",
        "data_emissao",
        "valor_total",
        "status",
        "estoque_gerado",
    )
    list_filter = ("status", "estoque_gerado")
    search_fields = ("chave_acesso", "numero", "emitente_cnpj", "emitente_nome")
    readonly_fields = ("estoque_gerado", "created_at", "updated_at")
    inlines = [NFeEntradaItemInline]
