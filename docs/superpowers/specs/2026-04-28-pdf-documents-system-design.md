# Sistema de Geração de PDFs — Documentos de OS

**Data:** 2026-04-28
**Status:** Aprovado
**Escopo:** Backend `documents` app + expansão `pdf_engine` + Frontend botões/modal/histórico

---

## Resumo

Sistema de geração de PDFs para o ERP DS Car que produz: Ordem de Serviço, Termo de Garantia, Termo de Quitação e Recibo de Pagamento. Cada documento é pré-preenchido automaticamente a partir dos dados da OS, mas editável pelo usuário antes da geração final. Todas as gerações são auditadas com snapshot JSON versionado, permitindo regerar qualquer versão histórica.

---

## Decisões de Design

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Arquitetura | `pdf_engine` (render puro) + `documents` app (negócio) | Separação de responsabilidades; pdf_engine reutilizável por outros apps |
| Processamento | Síncrono na view | PDFs simples (1-3 páginas), WeasyPrint <1s |
| Dados da empresa | FiscalConfig (banco) | Fonte única de verdade, alinhado com SEFAZ |
| Logo | Base64 embutida no HTML | Funciona offline no container, sem dependência de rede |
| Logo marca d'água | Base64 com opacity 5-8%, rotação -30° | Visual profissional sem interferir na leitura |
| Versionamento | Model dedicado com snapshot JSON | Auditoria completa, regerar qualquer versão |
| Edição pré-geração | Preview editável (drawer) | Usuário pode ajustar antes de confirmar |
| Garantia | Prazo por tipo de serviço (3 ou 6 meses) | Reflete regras reais da DS Car |

---

## 1. Model `DocumentGeneration`

App: `backend/core/apps/documents/` (TENANT_APP)

```python
class DocumentType(models.TextChoices):
    OS_REPORT   = "os_report",   "Ordem de Serviço"
    WARRANTY    = "warranty",    "Termo de Garantia"
    SETTLEMENT  = "settlement", "Termo de Quitação"
    RECEIPT     = "receipt",     "Recibo de Pagamento"


class DocumentGeneration(PaddockBaseModel):
    """Registro imutável de cada PDF gerado — auditoria com snapshot."""

    # Identificação
    document_type = models.CharField(max_length=20, choices=DocumentType.choices)
    version = models.PositiveIntegerField(default=1)

    # Vínculo
    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        on_delete=models.CASCADE,
        related_name="generated_documents",
    )
    receivable = models.ForeignKey(
        "accounts_receivable.ReceivableDocument",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Apenas para recibos",
    )

    # Snapshot — JSON dos dados EXATOS usados na geração (pós-edição do usuário)
    data_snapshot = models.JSONField(
        help_text="Dados completos no momento da geração. Permite regerar PDF idêntico."
    )

    # Arquivo
    s3_key = models.CharField(max_length=500)
    file_size_bytes = models.PositiveIntegerField(null=True, blank=True)

    # Auditoria
    generated_by = models.ForeignKey(
        "authentication.GlobalUser",
        on_delete=models.PROTECT,
        related_name="documents_generated",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["service_order", "document_type", "-version"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["service_order", "document_type", "version"],
                name="unique_doc_version",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.get_document_type_display()} v{self.version} — OS #{self.service_order.number}"
```

**Versionamento automático:**
- Ao gerar documento do mesmo tipo para mesma OS, `version = MAX(version) + 1`
- Versões anteriores permanecem intactas no banco e no S3
- `data_snapshot` salva o que o usuário confirmou (após edições no drawer)

**S3 key pattern:**
```
documents/os-{number}/{document_type}/v{version}-{uuid8}.pdf
```

---

## 2. Data Loaders

```python
# backend/core/apps/documents/data_loaders.py

class OSDataLoader:
    """Busca dados de OS e formata para templates PDF."""

    @staticmethod
    def load_os_report(order_id: UUID) -> dict:
        """OS completa: cliente, veículo, peças, serviços, totais, seguradora."""

    @staticmethod
    def load_warranty(order_id: UUID) -> dict:
        """Garantia: serviços + prazo individual por categoria."""

    @staticmethod
    def load_settlement(order_id: UUID) -> dict:
        """Quitação: OS + receivables + forma pagamento."""

    @staticmethod
    def load_receipt(order_id: UUID, receivable_id: UUID) -> dict:
        """Recibo individual."""

    @staticmethod
    def load_company_info() -> dict:
        """Dados empresa via FiscalConfig + logo base64."""
```

**Mapeamento de garantia:**

```python
# backend/core/apps/documents/constants.py

WARRANTY_MONTHS_BY_CATEGORY: dict[str, int] = {
    "mechanic": 3,      # Mecânica
    "bodywork": 6,      # Funilaria
    "painting": 6,      # Pintura
    "polishing": 3,     # Polimento
    "washing": 0,       # Lavagem (sem garantia)
    "aesthetic": 3,     # Estética
    "default": 3,       # Fallback
}
```

Cada loader retorna um dict editável. O frontend recebe esse dict, o usuário ajusta, e manda de volta no POST.

---

## 3. Service Layer

```python
# backend/core/apps/documents/services.py

class DocumentService:
    """Orquestra: preview → validação → render → S3 → audit."""

    @classmethod
    def preview(cls, order_id: UUID, document_type: str) -> dict:
        """Monta dados pré-preenchidos para o drawer de edição."""
        # Chama o data_loader correspondente
        # Retorna JSON editável para o frontend

    @classmethod
    def generate(cls, order_id: UUID, document_type: str, data: dict, user: Any) -> DocumentGeneration:
        """Gera PDF final a partir dos dados confirmados pelo usuário.

        1. Valida campos obrigatórios
        2. Calcula next version
        3. Renderiza PDF via PDFService
        4. Upload S3
        5. Cria DocumentGeneration com data_snapshot
        6. Loga no ServiceOrderActivityLog
        7. Retorna registro criado
        """

    @classmethod
    def regenerate_from_snapshot(cls, doc_id: UUID) -> bytes:
        """Re-renderiza PDF a partir do snapshot salvo (auditoria)."""

    @classmethod
    def history(cls, order_id: UUID) -> QuerySet:
        """Lista todos os documentos gerados para uma OS."""
```

---

## 4. Templates PDF

### Base atualizada (`base.html`)

- **Header:** Logo DS Car (base64, ~40px altura) à esquerda + dados FiscalConfig à direita
- **Marca d'água:** Logo base64, opacity 5-8%, centralizada, rotação -30°, `position: fixed`, cobrindo página inteira
- **Seções numeradas:** estilo "1. TÍTULO DA SEÇÃO" com borda inferior
- **Footer fixo:** "Documento gerado automaticamente pelo ERP Paddock Solutions · DS Car © {ano}"
- **Cores:** acento vermelho `#dc2626` (DS Car)

### Partials reutilizáveis (`_partials/`)

| Partial | Conteúdo |
|---------|----------|
| `customer_info.html` | Nome, CPF, RG, telefone, email, endereço |
| `vehicle_info.html` | Marca/modelo, ano, cor, placa, chassi, km entrada, data entrega |
| `services_table.html` | Tabela: nº, descrição, qtd, valor unitário, total |
| `parts_table.html` | Tabela: nº, descrição/código, qtd, valor unitário, total |
| `totals_block.html` | Subtotal, desconto, total geral (box com fundo) |
| `signature_block.html` | 2 colunas com linha pontilhada, nome + CPF/CNPJ embaixo |
| `watermark.html` | CSS da marca d'água |

### Templates por documento

**`os_report.html`** — Relatório completo da OS:
1. Dados do cliente
2. Dados do veículo
3. Seguradora (se `customer_type == "insurer"`: nome, sinistro, franquia, tipo segurado)
4. Serviços realizados (tabela)
5. Peças utilizadas (tabela)
6. Totais
7. Observações

**`warranty.html`** — Termo de Garantia:
1. Dados do cliente
2. Dados do veículo
3. Serviços realizados com prazo individual (tabela com coluna "Garantia até DD/MM/YYYY")
4. Cobertura da garantia (lista com ✔)
5. Exclusões (lista com ✘)
6. Como acionar a garantia
7. Assinaturas (cliente + DS Car)

**`settlement.html`** — Termo de Quitação:
1. Dados do cliente
2. Dados do veículo
3. Serviços realizados (tabela resumida)
4. Forma de pagamento e quitação (método, valor, data, status QUITADO)
5. Declaração de quitação (texto legal com dados interpolados)
6. Assinaturas

**`receipt.html`** — Recibo:
1. Pagador (nome, CPF/CNPJ)
2. Referência (OS número + descrição do item)
3. Valor pago + forma de pagamento + data
4. Declaração de recebimento
5. Assinatura DS Car + data/local

---

## 5. Endpoints API

```
GET  /api/v1/documents/os/{id}/preview/{tipo}/           → JSON pré-preenchido
POST /api/v1/documents/os/{id}/generate/                  → Gera PDF, retorna registro
GET  /api/v1/documents/os/{id}/history/                   → Lista documentos (todas versões)
GET  /api/v1/documents/{doc_id}/download/                 → Download PDF
GET  /api/v1/documents/{doc_id}/snapshot/                 → JSON do snapshot (auditoria)
```

`{tipo}` = `os_report` | `warranty` | `settlement` | `receipt`

### RBAC

| Ação | Permissão |
|------|-----------|
| Preview / Gerar / Histórico / Download | CONSULTANT+ |
| Ver snapshot (auditoria) | MANAGER+ |

### Payload POST `/generate/`

```json
{
  "document_type": "warranty",
  "receivable_id": null,
  "data": {
    "company": { "razao_social": "...", "cnpj": "...", "endereco": "..." },
    "customer": { "name": "...", "cpf": "...", "phone": "...", "address": "..." },
    "vehicle": { "make": "...", "model": "...", "year": "...", "plate": "...", "chassis": "...", "mileage_in": 38542 },
    "services": [
      {
        "description": "Reparo funilaria — parachoque dianteiro",
        "quantity": 1,
        "unit_price": "1800.00",
        "total": "1800.00",
        "warranty_months": 6,
        "warranty_until": "2026-10-28"
      }
    ],
    "parts": [...],
    "totals": { "parts": "1450.00", "services": "4550.00", "discount": "0.00", "grand_total": "6000.00" },
    "payment": { "method": "pix", "amount": "6000.00", "date": "2026-04-28", "status": "paid" },
    "warranty_coverage": ["Defeitos de execução em funilaria...", "Peças com defeito de fabricação..."],
    "warranty_exclusions": ["Danos por novo acidente...", "Desgaste natural..."],
    "observations": "Texto livre"
  }
}
```

### Response POST `/generate/`

```json
{
  "id": "uuid",
  "document_type": "warranty",
  "version": 2,
  "download_url": "/api/v1/documents/{doc_id}/download/",
  "generated_at": "2026-04-28T14:30:00-04:00",
  "generated_by_name": "Thiago Campos",
  "file_size_bytes": 45230
}
```

---

## 6. Frontend

### 6a. `DocumentsDropdown` (header da OS)

- Botão `[📄 Documentos ▾]` no header do `ServiceOrderForm`, ao lado do dropdown de status
- Badge com contagem total de documentos gerados
- Menu com 4 itens (OS Report, Garantia, Quitação, Recibo)
- Itens desabilitados com tooltip explicativo quando indisponível:
  - Garantia: desabilitado se status < `ready`
  - Quitação: desabilitado se `invoice_issued == false`
  - Recibo: desabilitado se não há `ReceivableReceipt`
- Clique abre o `DocumentPreviewDrawer`

### 6b. `DocumentPreviewDrawer` (edição pré-geração)

- Sheet lateral (padrão do projeto)
- Header: ícone + nome do documento + "OS #1234"
- Corpo: formulário com seções colapsáveis
  - Dados do cliente (editável: nome, CPF, telefone, endereço)
  - Dados do veículo (editável: placa, modelo, ano, cor, chassi, km)
  - Serviços (editável: descrição, valor, prazo de garantia por item)
  - Peças (editável: descrição, valor)
  - Totais (recalculados automaticamente)
  - Observações (textarea livre)
  - Cobertura/Exclusões (só garantia — lista editável com add/remove)
- Footer: `[Cancelar]` + `[Gerar PDF]`
- Ao confirmar: loading → POST generate → abre PDF em nova aba → toast sucesso

### 6c. `DocumentHistorySection` (ClosingTab)

Nova seção na ClosingTab abaixo do bloco fiscal:

- Header "DOCUMENTOS GERADOS" com ícone FileText
- Lista de cards por documento (último de cada tipo):
  - Ícone por tipo + nome + badge "v2"
  - Linha: "Gerado por {nome} · {data formatada}"
  - Botões: [Download] [Versões anteriores]
- Accordion de versões anteriores:
  - Cada versão: número + data + autor + [Download] + [Snapshot] (MANAGER+)
- Empty state: "Nenhum documento gerado ainda."
- Botão inferior: `[+ Gerar Documento ▾]` (mesmo dropdown do header)

### 6d. Sugestões automáticas (toasts com ação)

| Gatilho | Toast |
|---------|-------|
| Transição → `delivered` | "OS entregue! Gerar Termo de Garantia e Quitação?" com botão [Gerar] |
| Billing concluído | "Faturamento OK. Gerar recibo?" com botão [Gerar] |

Toasts com ação — não bloqueantes, usuário pode ignorar.

### 6e. Regras de disponibilidade

| Documento | Habilitado quando |
|-----------|-------------------|
| OS Report | Sempre (qualquer status) |
| Garantia | `status` ∈ {ready, delivered} |
| Quitação | `invoice_issued == true` |
| Recibo | Existe ≥1 ReceivableReceipt para a OS |

---

## 7. Estrutura de Arquivos

```
backend/core/apps/documents/
├── __init__.py
├── apps.py
├── models.py                    ← DocumentGeneration
├── data_loaders.py              ← OSDataLoader
├── services.py                  ← DocumentService
├── serializers.py               ← PreviewSerializer, GenerateSerializer, HistorySerializer
├── views.py                     ← DocumentViewSet
├── urls.py
├── constants.py                 ← WARRANTY_MONTHS_BY_CATEGORY, cobertura/exclusões default
└── migrations/
    └── 0001_initial.py

backend/core/apps/pdf_engine/
├── services.py                  ← PDFService (expandido)
├── logo.py                      ← LogoService: carrega + cacheia base64
└── templates/pdf_engine/
    ├── base.html                ← ATUALIZADO (logo + marca d'água + FiscalConfig)
    ├── _partials/
    │   ├── customer_info.html
    │   ├── vehicle_info.html
    │   ├── services_table.html
    │   ├── parts_table.html
    │   ├── totals_block.html
    │   ├── signature_block.html
    │   └── watermark.html
    ├── os_report.html
    ├── warranty.html
    ├── settlement.html
    ├── receipt.html
    ├── orcamento.html           ← existente (sem mudança)
    └── budget.html              ← existente (sem mudança)

apps/dscar-web/src/
├── hooks/useDocuments.ts
├── app/(app)/service-orders/[id]/_components/
│   ├── DocumentsDropdown.tsx
│   ├── DocumentPreviewDrawer.tsx
│   ├── DocumentHistorySection.tsx
│   ├── ServiceOrderForm.tsx     ← editado (adiciona dropdown no header)
│   └── tabs/ClosingTab.tsx      ← editado (adiciona seção histórico)

packages/types/src/documents.types.ts
```

---

## 8. Dependências

- **WeasyPrint** — já no `requirements/base.txt`
- **boto3** — já disponível (S3 upload)
- Nenhuma nova dependência externa

---

## 9. Fora de escopo (futuro)

- Relatórios financeiros gerais (DRE, Balanço, Fluxo de Caixa)
- PDFs para PDV/e-commerce (usarão `pdf_engine` mas com app próprio)
- Assinatura digital (certificado A1/A3)
- Envio automático por WhatsApp/email após geração
