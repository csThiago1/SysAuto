# Painel Fiscal de Faturamento — Design Spec

**Data:** 2026-04-27
**Autor:** Thiago + Claude
**Status:** Aprovado

---

## 1. Objetivo

Página dedicada de faturamento (`/service-orders/{id}/faturamento`) que permite visualizar, editar e corrigir todos os dados fiscais antes de emitir NFS-e e NF-e. Validação prévia bloqueia emissão com dados incompletos. Erros da SEFAZ são exibidos com sugestão de correção automática. Timeline de tentativas de emissão visível.

## 2. Acesso

- **Lista de OS**: coluna "$" → abre `/service-orders/{id}/faturamento`
- **ClosingTab**: botão "Faturar OS" → navega para a mesma página
- **Sidebar**: não aparece (acesso só via OS)

Habilitado quando: `status >= authorized` E `invoice_issued === false`.

## 3. Layout da Página

Tela cheia dividida em seções visíveis, sem scroll horizontal. Header fixo com resumo.

```
┌──────────────────────────────────────────────────────────────┐
│  ← Voltar   OS #123 — Faturamento                           │
│  (logo) Chevrolet Onix (QZA4C43) · Thiago Souza · Particular│
│                                                              │
│  ┌─ VALIDAÇÃO ──────────────────────────────────────────────┐│
│  │ ✅ Destinatário OK   ✅ Itens OK   ⚠ NCM faltando (1)   ││
│  │ ✅ Emitente OK       ✅ Impostos OK                      ││
│  │ [Corrigir 1 problema]                                    ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ EMITENTE ──────────────┐  ┌─ DESTINATÁRIO ────────────┐│
│  │ Razão Social  [editável]│  │ Nome       [editável]      ││
│  │ CNPJ          [editável]│  │ CPF/CNPJ   [editável]      ││
│  │ IE            [editável]│  │ Endereço   [editável]      ││
│  │ Endereço      [editável]│  │ Mun. IBGE  [editável]      ││
│  │ Regime Trib.  [select]  │  │ UF         [editável]      ││
│  └─────────────────────────┘  └────────────────────────────┘│
│                                                              │
│  ┌─ ITENS DA NOTA ──────────────────────────────────────────┐│
│  │ Tipo │ Descrição      │ NCM      │ Qtd │ Unit.  │ Total ││
│  │──────│────────────────│──────────│─────│────────│───────││
│  │ NFS-e│ Troca — Parab. │    —     │ 2.0 │  80,00 │160,00 ││
│  │ NF-e │ Parabrisa      │ 87082999 │ 1.0 │ 720,00 │720,00 ││
│  │      │                │ [editar] │     │        │       ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─ IMPOSTOS ──────────────┐  ┌─ PAGAMENTO ───────────────┐│
│  │ Regime: Normal (3) [▾]  │  │ Serviços → Cliente        ││
│  │ CST ICMS: 00      [▾]  │  │  [Pix ▾]  [À vista ▾]     ││
│  │ Alíq ICMS: 12%    [ed] │  │                            ││
│  │ CST PIS: 01       [▾]  │  │ Peças → Cliente            ││
│  │ Alíq PIS: 0.65%   [ed] │  │  [Pix ▾]  [À vista ▾]     ││
│  │ CST COFINS: 01    [▾]  │  │                            ││
│  │ Alíq COFINS: 3%   [ed] │  │ Total: R$ 880,00           ││
│  │ Alíq ISS: 2%      [ed] │  │                            ││
│  └─────────────────────────┘  └────────────────────────────┘│
│                                                              │
│  ┌─ TIMELINE DE EMISSÕES ───────────────────────────────────┐│
│  │ (vazio — nenhuma tentativa ainda)                        ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│           [Cancelar]    [$ Faturar e Emitir NF]              │
│                                                              │
│  ⓘ NFS-e (serviços R$160) + NF-e (peças R$720)             │
│    Notas emitidas separadamente. PDF/XML salvos na OS.      │
└──────────────────────────────────────────────────────────────┘
```

## 4. Seções

### 4.1 Header

- Botão voltar → `/service-orders/{id}`
- Número da OS, logo montadora, placa, cliente, tipo (Particular/Seguradora)
- Badge: "Não faturada" (warning) ou "Faturada" (success)

### 4.2 Validação

Card de validação prévia com checklist:
- **Destinatário**: CPF/CNPJ preenchido, endereço com município IBGE
- **Itens**: todas as peças com NCM 8 dígitos, descrições não vazias
- **Emitente**: razão social, CNPJ, IE, endereço completo
- **Impostos**: regime tributário definido, alíquotas > 0

Cada check é ✅ (ok) ou ⚠ (problema com descrição).
Botão "Corrigir N problema(s)" faz scroll até o campo com erro e foca nele.
**Botão "Faturar" desabilitado enquanto houver ⚠.**

### 4.3 Emitente

Dados pré-carregados do `FiscalConfigModel`. Editáveis inline.
Campos: razão social, CNPJ, IE, IM, logradouro, número, bairro, município, UF, CEP, regime tributário (select: 1=Simples, 2=Simples Excesso, 3=Normal).

Ao editar, salva no `FiscalConfigModel` via PATCH.

### 4.4 Destinatário

Dados pré-carregados da `Person` do cliente (ou seguradora, se for o caso).
Campos: nome/razão social, CPF ou CNPJ, endereço completo, município IBGE, UF, CEP, email.

Para seguradora com franquia: mostra dois blocos — dados do cliente (franquia) e dados da seguradora (serviços/peças).

Ao editar, salva na `Person` via PATCH.

### 4.5 Itens da Nota

Tabela com todos os itens que irão na NF, separados por tipo:
- **NFS-e** (serviços/mão de obra) — vindos de `ServiceOrderLabor`
- **NF-e** (peças) — vindos de `ServiceOrderPart`

Colunas: Tipo (badge NFS-e/NF-e), Descrição (editável), NCM (editável, só peças), CFOP (auto), Qtd (editável), Valor Unit. (editável), Desconto, Total.

NCM com validação inline: 8 dígitos numéricos. Campo vermelho se inválido.

### 4.6 Impostos

Pré-carregados do `FiscalConfigModel` + `NFeTaxConfig`.

| Campo | Tipo | Aplicação |
|---|---|---|
| Regime Tributário | Select (1/2/3) | NF-e |
| CST/CSOSN ICMS | Select | NF-e (auto por regime) |
| Alíquota ICMS | Input % | NF-e |
| Modalidade BC ICMS | Select | NF-e |
| CST PIS | Select | NF-e |
| Alíquota PIS | Input % | NF-e |
| CST COFINS | Select | NF-e |
| Alíquota COFINS | Input % | NF-e |
| Alíquota ISS | Input % | NFS-e |
| ISS Retido | Toggle | NFS-e |
| Código LC116 | Input | NFS-e |

Ao mudar regime para Simples (1): auto-preenche CSOSN 102, PIS 07, COFINS 07.
Ao mudar para Normal (3): auto-preenche CST 00, PIS 01, COFINS 01.

### 4.7 Pagamento

Mesma lógica do BillingModal atual:
- Split por destinatário (cliente/seguradora)
- Método de pagamento (Pix, Boleto, etc.)
- Prazo (À vista, 7/10/15/21/30/45/60 dias)
- Defaults por tipo

### 4.8 Timeline de Emissões

Lista cronológica de todas as tentativas de emissão para esta OS.
Dados de `FiscalDocument` + `FiscalEvent`.

| Campo | Fonte |
|---|---|
| Data/hora | FiscalEvent.created_at |
| Tipo | FiscalDocument.document_type (NFS-e/NF-e) |
| Ref | FiscalDocument.ref |
| Status | FiscalDocument.status (pending/authorized/rejected/cancelled) |
| Código SEFAZ | ultima_resposta.status_sefaz |
| Mensagem | ultima_resposta.mensagem_sefaz |
| Ação sugerida | Mapeamento de erro → correção (ver seção 6) |

Status badges:
- `pending` → amarelo pulsante "Processando..."
- `authorized` → verde "Autorizado"
- `rejected` → vermelho "Rejeitado" + mensagem + sugestão
- `cancelled` → cinza "Cancelado"

### 4.9 Erros SEFAZ — Sugestão de Correção Automática

Quando uma emissão é rejeitada, a timeline mostra o erro com botão de correção:

| Código SEFAZ | Mensagem | Sugestão | Ação do botão |
|---|---|---|---|
| 481 | Regime tributário diverge | "Corrigir para Regime Normal (3)?" | Altera regime e foca na seção Impostos |
| 980 | Razão social diverge | "Atualizar razão social para '{valor da SEFAZ}'?" | Preenche campo com valor sugerido |
| 629 | Valor produto diverge | "Recalcular valor bruto dos itens?" | Recalcula e foca na seção Itens |
| 212 | Data emissão futura | "Corrigir timezone para America/Manaus?" | Automático (já corrigido no builder) |
| 539 | Duplicidade NF-e | "NF-e já autorizada com esta ref" | Mostra link para o doc autorizado |
| 233 | IE inválida | "Corrigir IE do emitente?" | Foca no campo IE na seção Emitente |
| — | NCM inválido | "NCM deve ter 8 dígitos" | Foca no item sem NCM |
| — | Sem endereço | "Preencha endereço do destinatário" | Foca na seção Destinatário |

Botão "Aplicar correção" aplica a mudança inline. Botão "Reemitir" tenta novamente com dados corrigidos.

## 5. Backend

### Endpoints existentes (reutilizar)

- `GET /service-orders/{id}/billing/preview/` — breakdown
- `POST /service-orders/{id}/billing/` — faturar

### Novos endpoints

```
GET  /service-orders/{id}/billing/fiscal-config/
```
Retorna dados do emitente (FiscalConfigModel) + impostos (NFeTaxConfig).

```
PATCH /service-orders/{id}/billing/fiscal-config/
```
Atualiza FiscalConfigModel (razão social, IE, endereço, regime, alíquotas).
ADMIN+ apenas.

```
GET /service-orders/{id}/billing/fiscal-history/
```
Retorna FiscalDocuments + FiscalEvents da OS, ordenados cronologicamente.

```
POST /service-orders/{id}/billing/retry/
```
Reemite nota fiscal com dados corrigidos (cria novo FiscalDocument com nova ref).

### Preview expandido

O `billing/preview/` deve retornar adicionalmente:
- `emitente`: dados do FiscalConfigModel
- `destinatario`: dados da Person (nome, CPF/CNPJ, endereço)
- `items_nfse`: itens de serviço com valores
- `items_nfe`: itens de peça com NCM, valores
- `tax_config`: alíquotas atuais
- `validation`: lista de checks (ok/error) com campo e mensagem

## 6. Frontend

### Página

```
app/(app)/service-orders/[id]/faturamento/
  page.tsx                    ← Server component, carrega OS
  _components/
    BillingPage.tsx           ← Client component principal
    ValidationCard.tsx        ← Checklist de validação
    EmitenteSection.tsx       ← Dados editáveis do emitente
    DestinatarioSection.tsx   ← Dados editáveis do destinatário
    ItemsTable.tsx            ← Tabela de itens NFS-e/NF-e
    TaxSection.tsx            ← Impostos editáveis
    PaymentSection.tsx        ← Métodos e prazos de pagamento
    EmissionTimeline.tsx      ← Timeline de tentativas
    SefazErrorCard.tsx        ← Erro + sugestão de correção
```

### Hooks

```typescript
// _hooks/useBillingPage.ts
useBillingPreviewExpanded(orderId)  // GET preview com emitente+destinatario+items+validation
useFiscalConfig(orderId)            // GET fiscal-config
useUpdateFiscalConfig(orderId)      // PATCH fiscal-config
useFiscalHistory(orderId)           // GET fiscal-history
useRetryEmission(orderId)           // POST retry
```

### Fluxo do Usuário

1. Usuário clica "$" na lista ou "Faturar OS" na ClosingTab
2. Navega para `/service-orders/{id}/faturamento`
3. Página carrega e mostra validação no topo
4. Se tudo ✅: botão "Faturar e Emitir NF" habilitado
5. Se tem ⚠: botão desabilitado, usuário corrige inline
6. Ao clicar "Faturar": POST /billing/ — cria títulos + emite NF
7. Timeline atualiza com status "Processando..."
8. Polling via Celery atualiza status para "Autorizado" ou "Rejeitado"
9. Se rejeitado: mostra erro + sugestão de correção
10. Usuário corrige → clica "Reemitir" → nova tentativa
11. Se autorizado: badge verde, PDF/XML disponíveis, OS marcada como faturada

## 7. Arquivos a Criar/Modificar

### Backend (criar)
- Novos endpoints no ViewSet: `fiscal_config`, `fiscal_history`, `retry`
- Serializer para FiscalConfigModel (read/write)
- Preview expandido com validação

### Backend (modificar)
- `BillingService.preview()` → adicionar emitente, destinatario, items, validation
- `billing.py` → adicionar método `validate()` e `retry()`

### Frontend (criar)
- `app/(app)/service-orders/[id]/faturamento/page.tsx`
- 8 componentes em `_components/`
- Hooks em `_hooks/useBillingPage.ts`

### Frontend (modificar)
- `ServiceOrderTable.tsx` — "$" navega para `/faturamento` em vez de abrir modal
- `ClosingTab.tsx` — botão navega para `/faturamento`
- O `BillingModal.tsx` existente será deprecado (substituído pela página)

### Tipos
- Expandir `billing.types.ts` com tipos de validação, fiscal config, timeline
