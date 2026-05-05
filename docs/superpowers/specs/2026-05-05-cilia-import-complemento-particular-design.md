# Importação de Sinistros (Cilia/Soma/Audatex) + Complemento Particular

**Data:** 2026-05-05
**Status:** Aprovado
**Autor:** Thiago + Claude Code

---

## Contexto

A DS Car recebe orçamentos de seguradoras por três canais: Cilia (webservice), Soma (XML) e Audatex (HTML). Esses orçamentos precisam ser importados para a OS, versionados (snapshots imutáveis), e faturados. Além disso, o cliente pode solicitar serviços extras fora da cobertura da seguradora (complemento particular), que são faturados independentemente.

## Decisões de Design

### Importação Multi-Fonte

1. **Configuração na seguradora:** O `InsurerTenantProfile` ganha campo `import_tool` (cilia/soma/audatex/manual) que pré-seleciona a fonte no modal de importação.
2. **Modal de importação na OS:** Botão "Importar Orçamento" no header da OS abre modal com:
   - Seletor de fonte (Cilia/Soma/Audatex) pré-selecionado pela config da seguradora
   - **Cilia:** campos sinistro + orçamento (pré-preenchidos se já importou antes) + versão opcional
   - **Soma:** upload de arquivo XML
   - **Audatex:** upload de arquivo HTML
   - Todos os parsers convergem para o formato `ParsedBudget` existente
3. **Botão "Verificar Nova Versão":** Atalho que abre o modal com sinistro/orçamento da OS já preenchidos. Sem polling automático no MVP.
4. **Versionamento incremental:** O sistema salva o `budget_version_id` atual e busca a próxima versão (.2, .3, .4...) automaticamente quando o usuário consulta.

### Override de Versão com Diff

1. Quando uma nova versão é encontrada, o sistema mostra um **diff visual** entre a versão atual e a nova:
   - Itens novos (verde)
   - Itens alterados (amarelo) com valor anterior/novo
   - Itens removidos (vermelho)
   - Totais comparativos
2. O usuário confirma o override. A nova versão sobrescreve a ativa.
3. **Preservação:** Itens já executados (peças instaladas, serviços em andamento) e custos já realizados (insumos consumidos) são preservados — o override só afeta itens orçados ainda não executados.
4. **Snapshots imutáveis:** Versões anteriores permanecem consultáveis via `ServiceOrderVersion` (nunca editadas/deletadas).

### Complemento Particular

1. **Aba separada** na OS chamada "Complemento Particular" (cor âmbar para diferenciar da seguradora em azul).
2. **Itens editáveis:** O usuário adiciona peças e serviços livremente, com preço, quantidade, e descrição.
3. **Independente da versão Cilia:** Override de versão nunca toca nos itens do complemento.
4. **Faturamento independente:** Botão "Faturar Itens Pendentes" disponível a qualquer momento, sem depender do fechamento da OS. Gera NF-e (peças) e NFS-e (serviços) em nome do cliente.
5. **Status individual:** Cada item mostra se está "Pendente" ou "Faturado". Itens faturados ficam read-only.

### Abas da OS (Seguradora)

Para OS de seguradora, a OS terá estas abas:

| Aba | Conteúdo | Editável? |
|-----|----------|-----------|
| Dados | Dados gerais, cliente, seguradora | Sim |
| Veículo | Dados do veículo | Sim |
| **Peças** | Visão consolidada: seguradora + particular + manual | Parcial (manual sim, importado não) |
| **Serviços** | Visão consolidada: seguradora + particular + manual | Parcial |
| **Orçamento Seguradora** | Itens importados (Cilia/Soma/Audatex), versão ativa | Read-only |
| **Complemento Particular** | Extras do cliente, faturamento independente | Sim |
| Fotos | Evidências por pasta | Sim |
| Histórico | Timeline de eventos | Read-only |

- As abas **Peças** e **Serviços** são a visão operacional consolidada (tudo junto), com filtros por origem (Seguradora / Particular / Manual) e coluna "Pagador".
- A aba **Orçamento Seguradora** é a visão financeira/gestão do que veio da importação.
- A aba **Complemento Particular** é a visão financeira/gestão dos extras do cliente.

### Resumo Financeiro

Card de resumo financeiro visível na OS com breakdown:

- **Seguradora:** peças + MO + insumos = subtotal, menos franquia
- **Complemento Particular:** serviços + peças = subtotal, com indicação de já faturado vs pendente
- **Cliente deve:** franquia + particular pendente
- **Seguradora deve:** subtotal - franquia
- **Total geral da OS:** soma de tudo

### Faturamento

Dois fluxos de faturamento independentes:

1. **Seguradora:** Faturamento no fechamento da OS (fluxo existente no `BillingService`). Franquia cobrada do cliente, resto da seguradora.
2. **Complemento Particular:** Faturamento a qualquer momento via botão na aba. Gera documentos fiscais separados (NF-e peças + NFS-e serviços) em nome do cliente. Cria receivables no `accounts_receivable`.

## Modelagem de Dados

### Alterações em Models Existentes

**`InsurerTenantProfile`** — novo campo:
```python
import_tool = models.CharField(
    max_length=20,
    choices=[("cilia", "Cilia"), ("soma", "Soma"), ("audatex", "Audatex"), ("manual", "Manual")],
    default="manual",
)
```

**`ServiceOrderPart` / `ServiceOrderLabor`** — novo campo para distinguir origem:
```python
payer = models.CharField(
    max_length=20,
    choices=[("insurer", "Seguradora"), ("customer", "Cliente/Particular")],
    default="insurer",
)
source_type = models.CharField(
    max_length=20,
    choices=[("import", "Importado"), ("complement", "Complemento Particular"), ("manual", "Manual")],
    default="manual",
)
```

**`ServiceOrderPart` / `ServiceOrderLabor`** — campo de status de faturamento:
```python
billing_status = models.CharField(
    max_length=20,
    choices=[("pending", "Pendente"), ("billed", "Faturado")],
    default="pending",
)
billed_at = models.DateTimeField(null=True, blank=True)
```

**`ServiceOrderVersionItem`** — já possui `payer_block` e `flag_inclusao_manual` que suportam a distinção.

### Novos Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/service-orders/{id}/import/` | Importar orçamento (Cilia consulta / Soma XML / Audatex HTML) |
| GET | `/api/v1/service-orders/{id}/versions/` | Listar versões com snapshots |
| GET | `/api/v1/service-orders/{id}/versions/{v}/diff/` | Diff entre versão ativa e versão v |
| POST | `/api/v1/service-orders/{id}/versions/{v}/apply/` | Aplicar override da versão v |
| GET | `/api/v1/service-orders/{id}/complement/` | Listar itens do complemento particular |
| POST | `/api/v1/service-orders/{id}/complement/parts/` | Adicionar peça ao complemento |
| POST | `/api/v1/service-orders/{id}/complement/services/` | Adicionar serviço ao complemento |
| PATCH | `/api/v1/service-orders/{id}/complement/{item_id}/` | Editar item do complemento |
| DELETE | `/api/v1/service-orders/{id}/complement/{item_id}/` | Remover item do complemento |
| POST | `/api/v1/service-orders/{id}/complement/bill/` | Faturar itens pendentes do complemento |
| GET | `/api/v1/service-orders/{id}/financial-summary/` | Resumo financeiro consolidado |

### Frontend — Novos Componentes

| Componente | Localização | Descrição |
|------------|-------------|-----------|
| `ImportBudgetModal` | `src/components/service-orders/` | Modal de importação multi-fonte |
| `ImportDiffView` | `src/components/service-orders/` | Visualização de diff entre versões |
| `InsurerBudgetTab` | `src/components/service-orders/tabs/` | Aba read-only do orçamento seguradora |
| `ComplementTab` | `src/components/service-orders/tabs/` | Aba editável do complemento particular |
| `FinancialSummaryCard` | `src/components/service-orders/` | Card resumo financeiro |
| `PayerBadge` | `src/components/service-orders/` | Badge de origem/pagador nas tabelas |

### Parser Audatex (Novo)

Parser para HTML do Audatex que converte para `ParsedBudget`. Segue o mesmo padrão do parser XML existente para Soma/Porto/Azul. A ser implementado como `parse_audatex_html()` em `apps/cilia/parsers/`.

## Fluxo Completo

```
1. Usuário cria OS de seguradora (já existe)
2. Clica "Importar Orçamento" → Modal abre com fonte pré-selecionada
3. Cilia: preenche sinistro/orçamento → Consulta API → ParsedBudget
   Soma: upload XML → Parser → ParsedBudget
   Audatex: upload HTML → Parser → ParsedBudget
4. Se primeira importação: cria ServiceOrderVersion v1 + itens
5. Se já existe versão: mostra diff → usuário confirma → override (preserva executados)
6. Itens aparecem na aba "Orçamento Seguradora" (read-only) e na aba "Peças"/"Serviços" (consolidado)
7. Usuário adiciona extras na aba "Complemento Particular" (opcional)
8. Complemento pode ser faturado a qualquer momento (independente)
9. No fechamento da OS, seguradora é faturada pelo fluxo normal
```

## Fora do Escopo (MVP)

- Polling automático de novas versões Cilia
- Aprovação/rejeição de versões (workflow multi-step)
- Notificações de nova versão disponível
- Parser Audatex completo (pode ser stub inicial com suporte básico)
