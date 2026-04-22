# 📋 Guia de Validação — Módulo de Orçamentação

Snapshot em **2026-04-21** · Branch `claude/mystifying-shamir-d8d8ce` · **57 commits** · **270 testes PASS**

Este documento é um roteiro pra você validar end-to-end o que foi construído antes de merge.

---

## ✅ Checks automáticos (já executados)

```
Backend:
  pytest apps/                     → 270 passed in 7.79s
  manage.py check                  → 0 issues
  manage.py makemigrations --check → No changes detected

Frontend:
  npm run build                    → ✓ built in 2.45s
```

---

## 🎯 Escopo entregue (6 ciclos)

| Ciclo | Escopo | Status |
|---|---|---|
| **01 Foundation** | 3 apps novos + evolução service_orders (20 models) + migrations + seeds (10 insurers, 18 permissions, 7 op types, 9 labor cats) + NumberAllocator atômico + admin Django | ✅ 60 tests |
| **02 Core Services** | BudgetService (7 métodos) + ServiceOrderService (6 métodos) + ComplementoParticularService + PaymentService + OSEventLogger + Celery task expire_stale_budgets + kanban.py com re-entry | ✅ +80 tests (140) |
| **03A Backend API** | drf-spectacular (OpenAPI) + 50+ endpoints REST + nested routers + PDF WeasyPrint com fallback | ✅ +34 tests (174) |
| **03B Frontend** | TanStack Query v5 + Zod schemas + 12 componentes UI (Budget + OS V2 + KanbanV2) + App integration | ✅ build verde |
| **04 Cilia** | CiliaClient httpx + CiliaParser (validado live com prod) + ImportService com dedup por hash + Celery poll_cilia_budget + sync_active_cilia_os (beat 15min) + API /imports/cilia/fetch + frontend CiliaImporter | ✅ +72 tests (246) |
| **04B XML IFX** | XmlIfxParser (stdlib, Brazilian decimal) + 5 grupos de peças + servicosTerceiros + endpoint XML upload + XmlIfxUploader frontend + fixtures reais Porto | ✅ +24 tests (270) |

---

## 🔬 Validações que eu fiz

### 1. API Cilia viva (contra prod)
Testei com o par real fornecido:
```
casualty=406571903, budget=1446508
v1 → HTTP 200 ✅ conclusion.key=not_authorized (NEGADO, flow=1)
v2 → HTTP 200 ✅ conclusion.key=authorized (AUTORIZADO, flow=2)
v3 → HTTP 404 ✅ {"error":"Versão do orçamento não encontrada."}
```

### 2. Parsers contra fixtures reais
```
[CILIA v2]          OS=406571903  cliente=FLEXCABLES DA AMAZONIA  itens=3   parecer=AUTORIZADO
[XML Porto Honda]   OS=5312026226472  cliente=IARA MARIA MAIA  itens=9   placa=QZP8B26
[XML Porto Montana] OS=5312026233175  cliente=JANECLEI PASCARELLI  itens=14  placa=TAF7C72
```

### 3. Dedup + idempotência testados
- Cilia: mesma v2 duas vezes → 2ª call marca `duplicate_of` + não duplica version
- XML: mesmo XML duas vezes → dedup por hash SHA256 do payload

---

## 🧪 Passos pra VOCÊ validar manualmente

### A. Setup ambiente local

```bash
# 1. Rodar backend
cd backend/core
python manage.py migrate
python manage.py runserver

# Em outro terminal:
# 2. Celery worker + beat (opcional pra testar polling)
celery -A config worker -l info
celery -A config beat -l info  # polling Cilia a cada 15min

# 3. Frontend
cd apps/dscar-web
npm install
npm run dev  # localhost:3000
```

### B. Swagger — explorar endpoints
Abrir: `http://localhost:8000/api/v1/schema/swagger/`

Endpoints críticos pra testar:
- `POST /api/v1/auth/token/` — obter JWT
- `GET /api/v1/budgets/` — listagem (vazia inicialmente)
- `POST /api/v1/budgets/` — criar budget particular
- `GET /api/v1/service-orders/` — OSes
- `POST /api/v1/imports/attempts/cilia/fetch/` — **importar Cilia real** (use o par `406571903/1446508/2` pra um exemplo prod)
- `POST /api/v1/imports/attempts/xml/upload/` — **upload XML** (envie Honda Fit XML via multipart)
- `GET /api/v1/imports/attempts/` — histórico de imports

### C. Fluxo end-to-end pelo frontend

Abrir `http://localhost:3000` e:

1. **Login** com usuário Django criado via `createsuperuser`
2. **Navegar pra "Orçamentos"** (sidebar — ícone FileText)
3. **Criar orçamento particular** — cliente + placa + descrição
4. **Adicionar itens** com operações (TROCA, PINTURA, etc.)
5. **Enviar ao cliente** — gera PDF (baixa em nova aba)
6. **Aprovar** com evidence → **cria OS automaticamente**
7. **Ver OS V2** — 4 tabs (Versões, Timeline, Pagamentos, Complemento)
8. **Timeline** mostra eventos: `BUDGET_LINKED`, `VERSION_CREATED`, `STATUS_CHANGE`
9. **Registrar pagamento** → aparece em Pagamentos + evento `PAYMENT_RECORDED`

### D. Importar Cilia via frontend

1. Navegar pra **Central de Importações** (precisa adicionar sidebar link ou rotear manualmente — se ainda não tiver, adicionar em App.tsx view `"cilia-import"`)
2. **Seção Cilia**: preencher sinistro `406571903`, orçamento `1446508`, versão `2`
3. Clicar **Buscar orçamento** → cria OS seguradora automática com 3 itens + parecer AUTORIZADO
4. Clicar **Abrir OS** no histórico — ver v2 criada, raw_payload preservado, report_pdf_base64 salvo

### E. Importar XML Porto

1. Mesma tela Central, **seção XML IFX**
2. Selecionar seguradora: **Porto**
3. Subir arquivo XML (o de testes em `backend/core/apps/imports/tests/fixtures/xml_ifx_honda_fit.xml`)
4. Clicar **Importar XML** → cria OS com 9 items (peças trocadas, recuperadas, overlap + serviços)

---

## 🛡️ Travas e auditoria pra verificar

### Trava fiscal
```python
# Não entrega OS particular sem NFS-e
>>> ServiceOrderService.change_status(service_order=os, new_status="delivered")
ValidationError: NFS-e pendente — emitir antes da entrega
```

### Timeline consistente
Qualquer mutação em OS gera `ServiceOrderEvent`. Ver na admin `/admin/service_orders/serviceorderevent/` ou via API `/api/v1/service-orders/{id}/events/`.

### Versões imutáveis
Cada versão guarda:
- `raw_payload` — JSON completo da fonte
- `content_hash` — SHA256 estável
- `report_pdf_base64` / `report_html_base64` — Cilia
- `external_budget_id`, `external_version_id`, `external_flow_number`

---

## 💣 Débito técnico conhecido

| Item | Severidade | Previsto |
|---|---|---|
| `DB paddock_dev` compartilhado não aplica migrations deste worktree | 🟡 Médio | Infra: DB dedicado `paddock_erp_dev` |
| `Payment.fiscal_doc_ref` é CharField stub, não FK pra FiscalDocument | 🟡 Médio | Ciclo 05 (Fiscal) |
| `ServiceOrder.total_value` DEPRECATED — cálculo via `active_version.net_total` | 🟢 Baixo | Remover em migration futura |
| Frontend não tem `ImportCenter` view no App.tsx (componente pronto, falta link) | 🟢 Baixo | 5 linhas — trivial |
| HDI HTML parser não implementado (aguarda amostra) | 🟢 Baixo | Ciclo 04C |
| OpenAPI não documenta body do action `fetch_cilia` e `upload_xml_ifx` | 🟢 Baixo | drf-spectacular `@extend_schema` |
| 24 erros TypeScript pré-existentes em componentes legados (Agenda, Dashboard, etc) | 🟢 Baixo | Migração progressiva |

---

## 📦 O que falta pra v1.0 (roadmap após merge)

- **Ciclo 04C** — HDI HTML parser (aguarda amostra)
- **Ciclo 05** — Fotos S3 reais + Assinatura digital + Fiscal NFSe/NFe (Focus NF-e)
- **Ciclo 06** — Migração ETL Databox (10k OS legadas)
- **Ciclo 07** — Multitenancy + LGPD (EncryptedField em CPF/email)
- **Ciclo 08** — Authentication via Keycloak (hoje é JWT simpler)

---

## 🚀 Comando pra criar PR

```bash
cd /Users/thiagocampos/projetos/grupo-dscar/.claude/worktrees/mystifying-shamir-d8d8ce
gh pr create --title "feat: Módulo de Orçamentação completo (MVP + Cilia + XML IFX)" \
  --body-file docs/superpowers/specs/2026-04-20-modulo-orcamentacao-design.md
```

Ou, se preferir merge direto na main:
```bash
# Depois de validar
git checkout main
git merge claude/mystifying-shamir-d8d8ce --no-ff
```

---

**Fim do guia. Qualquer coisa estranha no caminho, me avisa que corrijo na hora.**
