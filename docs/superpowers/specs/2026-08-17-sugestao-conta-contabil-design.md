# Sugestão de Conta Contábil por Descrição — Design

**Data:** 2026-08-17 · **Status:** aprovado em brainstorming
**Pedido do cliente:** "Busca aprimorada no financeiro e plano de contas. Se eu colocar
uma tesoura ou régua, quero que sugira que se trata de material de escritório e trate
como tal."
**Objetivo:** ao lançar uma despesa, sugerir a conta contábil a partir da descrição em
linguagem natural — e permitir achar a conta no plano digitando o item, não o nome
contábil.

## Situação atual

`PayableDocument` (`apps/accounts_payable/models.py`) tem `description` livre e
`expense_account` (FK → `accounting.ChartOfAccount`). A escolha da conta é 100% manual.
A busca do plano de contas é `SearchFilter` sobre `code` e `name` — quem não sabe que
"tesoura" mora em "Material de Escritório" não acha nada.

## Decisões de escopo (aprovadas)

| Decisão | Escolha |
|---|---|
| Motor | LLM via endpoint compatível com OpenAI. Chave OpenCode agora, Ollama na VM depois — troca só a `base_url` |
| Abstração | Nenhuma. Uma função, provider por variável de ambiente. Sem interface com uma implementação |
| Custo | Cache é o mecanismo central: LLM é chamada **uma vez por termo novo**, nunca de novo |
| Aprendizado | A conta que o humano confirmou ao salvar vira regra determinística |
| Aplicação | Nunca automática. Sugestão visível + botão aplicar |

## 1. Modelo — `AccountSuggestionRule`

Novo model em `apps/accounting/models/account_suggestion.py`, herdando
`PaddockBaseModel` (TENANT_APP, como o resto de accounting):

```python
class SuggestionSource(models.TextChoices):
    HUMAN = "H", _("Confirmada por usuário")
    LLM   = "L", _("Sugerida por LLM")
    SEED  = "S", _("Carga inicial")

class AccountSuggestionRule(PaddockBaseModel):
    term = models.CharField(max_length=120, unique=True, db_index=True)
    account = models.ForeignKey("accounting.ChartOfAccount", on_delete=models.PROTECT,
                                related_name="suggestion_rules")
    source = models.CharField(max_length=1, choices=SuggestionSource.choices)
    hits = models.PositiveIntegerField(default=0)
```

`term` é a descrição **normalizada**: minúscula, sem acento, sem pontuação, espaços
colapsados. A normalização vive em `services/term_normalizer.py` e é a mesma na
gravação e na consulta — se divergirem, o cache nunca acerta.

## 2. Serviço de sugestão

`apps/accounting/services/account_suggestion_service.py`, função única:

```python
def suggest_account(description: str) -> AccountSuggestion | None
```

Passos:

1. **Normaliza** a descrição.
2. **Cache exato** — `AccountSuggestionRule.objects.filter(term=normalized)`. Achou:
   incrementa `hits`, devolve na hora. Grátis, sem rede.
3. **Miss → LLM.** Monta o prompt com as contas **analíticas** de tipo `COST` e
   `EXPENSE` (código + nome) e pede de volta apenas o `code`.
4. **Valida** o código devolvido: existe, está ativo, é analítico, é custo/despesa.
   Falhou a validação → devolve `None`. A LLM não escolhe fora do plano de contas.
5. **Grava** a regra com `source=LLM` para não pagar de novo pelo mesmo termo.

### Cliente LLM

`apps/accounting/services/llm_client.py`, uma função `complete(prompt: str) -> str`,
chamada HTTP para `settings.LLM_BASE_URL` (`/chat/completions`), com
`settings.LLM_API_KEY` e `settings.LLM_MODEL`. Timeout curto (5s). Ollama depois =
apontar `LLM_BASE_URL` para a VM. Sem SDK, sem camada de provider.

Variáveis novas: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. Ausentes → o serviço pula
o passo 3 e só usa o cache (dev funciona sem chave).

### Falhas

Timeout, erro HTTP, resposta fora do formato, código inválido: `logger.warning` com o
contexto e retorno `None`. Nunca 500, nunca `str(e)` no corpo da resposta (regra do
projeto). O formulário simplesmente não mostra sugestão.

## 3. Endpoint

`GET /api/v1/accounting/suggest-account/?q=tesoura`

```json
{ "account_id": "uuid", "code": "4.1.02.003",
  "name": "Material de Escritório", "source": "L" }
```

Ou `{}` quando não há sugestão. Permissão: `IsConsultantOrAbove` (é leitura).
Registrado em `accounting/urls.py` como `path()` antes do `include(router.urls)`.

## 4. Confirmação humana vira regra

No `perform_create`/`perform_update` de `PayableDocumentViewSet`: gravado o documento
com `description` e `expense_account`, faz `update_or_create` da regra
`term=normalize(description)` → `account=expense_account`, `source=HUMAN`.

`source=HUMAN` **sobrescreve** `LLM`; o inverso nunca acontece (o passo 5 do serviço só
cria quando não existe regra). O acerto do usuário é a última palavra e nunca é
desfeito por uma chamada futura à LLM.

Mesmo gancho no `JournalEntryViewSet` quando a linha tem conta de despesa/custo.

## 5. Frontend — formulário de despesa

`app/(app)/financeiro/contas-pagar/novo/page.tsx`: ao sair do campo Descrição (ou após
600ms de debounce, mínimo 3 caracteres), chama o endpoint. Havendo sugestão, aparece
abaixo do seletor de conta:

> Sugestão: **4.1.02.003 — Material de Escritório**  [Aplicar]

Clicar preenche `expense_account`. Não clicar não muda nada. Se o usuário já escolheu
uma conta manualmente, a sugestão aparece mas não se impõe.

## 6. Busca do plano de contas por item

`ChartOfAccountViewSet.get_queryset`: quando há `?search=`, além do
`SearchFilter` sobre `code`/`name`, incluir no queryset as contas cujo `term` de regra
casa com o termo buscado (`icontains` sobre `AccountSuggestionRule.term`). Digitar
"tesoura" no plano de contas passa a achar Material de Escritório.

## 7. Gestão das regras

Nova aba em `/financeiro/plano-contas`: lista das regras (termo, conta, origem, hits),
com edição e exclusão. É como o cliente corrige uma classificação errada — e a correção
vale para sempre, porque vira `source=HUMAN`.

## Carga inicial

Migração de dados com ~40 termos óbvios do dia a dia da oficina
(`source=SEED`): tesoura, régua, caneta, papel A4, grampeador, toner, café, água,
detergente, estopa, lixa, fita crepe, luva, EPI, energia, água/esgoto, internet,
telefone. Cada um apontando para a conta correspondente do plano vigente. A migração é
tolerante: conta inexistente no plano do tenant → pula aquele termo, sem quebrar.

## Testes

`apps/accounting/tests/test_account_suggestion.py`, com o cliente LLM mockado:

- Cache hit não chama a LLM e incrementa `hits`.
- Cache miss chama a LLM uma vez, grava a regra, e a segunda chamada não usa a rede.
- Código inválido/inexistente devolvido pela LLM → `None`, sem regra gravada.
- LLM indisponível (exceção) → `None`, sem 500.
- Salvar despesa com conta X grava regra `HUMAN` e sobrescreve a regra `LLM` anterior.
- Normalização: "Tesoura", "tesoura ", "TESOURA" caem no mesmo `term`.

## Fora de escopo

- Sugestão de centro de custo.
- Classificação em lote de despesas já lançadas.
- Embeddings / RAG / pgvector — o cache exato resolve o custo sem isso.
- Reviver `apps.ai` (deletado em 2026-06-30). O cliente LLM mora em `accounting`,
  onde é usado.
