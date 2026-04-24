# Prompts de Kickoff — Módulo Fiscal em Sprints

**Spec de referência:** [../specs/2026-04-23-modulo-fiscal-focus-nfe-design.md](../specs/2026-04-23-modulo-fiscal-focus-nfe-design.md)
**Skill obrigatória:** `.claude/SKILLS.md` → `fiscal-nfe-pattern`
**Cadência:** 6 sprints de 2 semanas (12 semanas totais) — 1:1 com os ciclos 06A → 06F do roadmap.

---

## Pré-sprint (tarefas humanas, sem Claude Code)

**Bloqueadores que você precisa destravar antes de abrir Sprint 3 (NFS-e Manaus):**

1. **Ticket suporte Focus** — enviar as 7 perguntas do §12 do spec para `suporte@focusnfe.com.br`. Registrar respostas em `docs/superpowers/specs/anexos/2026-04-23-focus-suporte-manaus-respostas.md`.
2. **Contador DS Car** — decidir §15.2 (peças em OS particular entram na NFS-e como insumo ou desdobram em NF-e mod 55?). Registrar decisão em `docs/superpowers/specs/anexos/2026-04-23-contador-tratamento-pecas.md`.
3. **SEFAZ-AM** — solicitar Código de Segurança do Contribuinte (CSC) para NFC-e (só bloqueia Sprint 5).
4. **Cadastro Focus homologação** — subir CNPJ teste + certificado A1 de homologação no painel Focus (só bloqueia Sprint 3).

Sprints 1 e 2 podem rodar em paralelo a essas tarefas.

---

## Template de prompt (copie, troque `{variáveis}`)

```
Você é engenheiro sênior Paddock Solutions trabalhando no ERP DS Car.

# Leituras fundamentais (nesta ordem, antes de qualquer ação)
1. /CLAUDE.md — regras de negócio e padrões
2. /.claude/SKILLS.md (seção fiscal-nfe-pattern) — padrão de implementação
3. /docs/superpowers/specs/2026-04-23-modulo-fiscal-focus-nfe-design.md
   — especificamente as seções: §3 pré-requisitos, §5 modelo de dados,
   §{seções_específicas}, §14 roadmap
4. /backend/core/MVP_CHECKLIST.md — estado atual
5. {arquivos_referência_extras}

# Missão desta sprint
Ciclo {06X} — {nome_sprint}.
Duração: 2 semanas. Branch: `feat/ciclo-{06X}-{slug}`.

Escopo:
{escopo_bullets}

# Workflow obrigatório (não pule etapas)
1. Invocar `superpowers:using-git-worktrees` para criar worktree isolado.
2. Invocar `superpowers:writing-plans` para elaborar plano detalhado em
   `docs/superpowers/plans/YYYY-MM-DD-ciclo-{06X}-{slug}.md`.
   O plano deve listar TAREFAS ATÔMICAS (cada uma commit próprio).
3. Apresentar o plano e aguardar aprovação do usuário (ExitPlanMode).
4. Executar com `superpowers:executing-plans` usando TDD
   (`superpowers:test-driven-development`): teste vermelho → código verde → refactor.
5. Cada tarefa concluída passa por `superpowers:verification-before-completion`
   (rodar pytest + type check + smoke relevante antes de marcar done).
6. Commits em Conventional Commits (feat/fix/chore/docs/test).
7. Ao final: abrir PR contra `main`, atualizar MVP_CHECKLIST.md, rodar smoke
   em `scripts/smoke_ciclo_{06X}.py`.

# Critérios de aceite (sprint só fecha se TODOS passam)
- [ ] Migrations criadas, testadas e reversíveis
- [ ] Cobertura ≥ 80% nos novos módulos (pytest-cov)
- [ ] Todos os testes da suíte passam (incluindo pré-existentes)
- [ ] Type check limpo (mypy backend; tsc frontend strict)
- [ ] Smoke {fixture|homologação|live} registrado
- [ ] MVP_CHECKLIST.md atualizado com seção "Entregue no Ciclo {06X}"
- [ ] PR com descrição (§resumo, §testes, §riscos, §rollback)
- [ ] Code review (self ou humano) concluído
- [ ] Sem dívida técnica não-documentada (TODO/FIXME sem issue)

# Bloqueadores — abortar se algum não estiver resolvido
{bloqueadores}

# Entregáveis concretos
{entregaveis_bullets}

# Antipadrões que vou rejeitar
- Implementar antes do plano ser aprovado
- Commits gigantes (>500 linhas) misturando domínios
- Testes mockando a própria lógica testada (tautologia)
- `raise` genérico em lugar da hierarquia `FocusNFeError`
- `ref` Focus construída fora de `next_fiscal_ref`
- `except: pass` / `print(` / `raw SQL`
- Mudanças não relacionadas à sprint (scope creep)

Estamos em plan mode. NÃO implemente até aprovação do plano.
```

---

## Sprint 1 — Ciclo 06A: Person LGPD + ETL Databox

**Variáveis para o template:**

- `{06X}` = `06A`
- `{nome_sprint}` = `Person evolução + ETL Databox`
- `{slug}` = `person-lgpd`
- `{seções_específicas}` = `§3.1 Person evolução`
- `{arquivos_referência_extras}`:
  - `/backend/core/apps/persons/models.py` (modelo stub atual)
  - `/backend/core/apps/imports/` (padrão ETL)
- `{escopo_bullets}`:
  ```
  - Models: Document (type=CPF|CNPJ|IE|IM), Category, Contact (type=EMAIL|PHONE|WHATSAPP), Address — todos FK Person
  - EncryptedField custom usando cryptography.fernet (ou django-cryptography se preferir)
  - Migration de dados: enriquecer Person com FKs novas, preservar legacy_databox_id
  - ETL em backend/core/scripts/etl_persons_databox.py: parse export Databox (7.789 pessoas), criptografa PII, insere via bulk com batch de 500
  - Admin Django expondo novos models com campos PII mascarados
  - DRF serializers atualizados (Person list/detail expõe apenas último dígito de docs sensíveis por default)
  - Endpoint GET /api/v1/persons/{id}/documents/ com permission fiscal_admin para ver plaintext
  - Frontend: PersonForm atualizado (CPF/CNPJ masks, endereço multi-linha, IBGE lookup)
  ```
- `{bloqueadores}`:
  ```
  - Export Databox deve estar disponível em formato consumível (CSV ou JSON).
    Se não, spawnar sub-task de exportação antes.
  - Definir chave de criptografia (FERNET_KEY) e local de armazenamento
    (env var + rotação documentada).
  ```
- `{entregaveis_bullets}`:
  ```
  - backend/core/apps/persons/models.py expandido (Document, Category, Contact, Address)
  - backend/core/apps/persons/fields.py (EncryptedField)
  - backend/core/apps/persons/migrations/0002_lgpd_evolution.py + 0003_etl_import.py
  - backend/core/scripts/etl_persons_databox.py + testes
  - backend/core/apps/persons/tests/test_models.py, test_etl.py, test_encryption.py
  - apps/dscar-web/src/components/persons/PersonForm.tsx atualizado
  - Smoke: scripts/smoke_ciclo_06a.py — insere 10 pessoas de teste, criptografa, lê, valida
  - +40 testes aprox (total projeto deve subir para ~310)
  ```

---

## Sprint 2 — Ciclo 06B: Fiscal foundation

**Variáveis:**

- `{06X}` = `06B`
- `{nome_sprint}` = `Fiscal foundation (app + client + Celery)`
- `{slug}` = `fiscal-foundation`
- `{seções_específicas}` = `§4 arquitetura, §5 modelo de dados, §11 erros/retry`
- `{arquivos_referência_extras}`:
  - `/backend/core/apps/imports/sources/cilia_client.py` (padrão a copiar)
  - `/backend/core/apps/imports/models.py` (padrão ImportAttempt → FiscalEvent)
  - `/backend/core/config/celery.py` (padrão beat)
- `{escopo_bullets}`:
  ```
  - App backend/core/apps/fiscal/ com estrutura completa (models, services, clients, tasks, views, urls, admin, tests)
  - Models: FiscalConfig, FiscalDocument, FiscalDocumentItem, FiscalEvent (sem builders específicos ainda)
  - FocusNFeClient httpx conforme skill fiscal-nfe-pattern
  - Hierarquia de exceptions (FocusNFeError + filhos)
  - ref_generator.next_fiscal_ref() com sequenciadores atômicos
  - Settings FOCUS_NFE_* + guard contra DEBUG+producao
  - Celery task poll_fiscal_document (skeleton genérico, sem builder)
  - Webhook view FocusWebhookView com validação path-secret + idempotência
  - Management command register_focus_webhook
  - NÃO emitir nada real nesta sprint — só infra. Todos testes com respx.
  ```
- `{bloqueadores}`:
  ```
  - Ciclo 06A (Sprint 1) merged em main
  - FOCUS_NFE_TOKEN de homologação obtido (mesmo sem CNPJ configurado ainda)
  ```
- `{entregaveis_bullets}`:
  ```
  - Nova app apps/fiscal com ≥25 testes, todos respx/unit
  - backend/core/apps/fiscal/models.py (4 models), migrations 0001
  - backend/core/apps/fiscal/clients/focus_nfe_client.py
  - backend/core/apps/fiscal/services/ref_generator.py + fiscal_service.py (stubs)
  - backend/core/apps/fiscal/tasks.py (poll_fiscal_document)
  - backend/core/apps/fiscal/views.py (FocusWebhookView)
  - backend/core/apps/fiscal/management/commands/register_focus_webhook.py
  - backend/core/config/settings.py atualizado
  - .env.example com FOCUS_NFE_*
  - Sem smoke live (só fixtures)
  ```

---

## Sprint 3 — Ciclo 06C: NFS-e Manaus end-to-end ⚠️ BLOQUEADA

**Variáveis:**

- `{06X}` = `06C`
- `{nome_sprint}` = `NFS-e Manaus end-to-end`
- `{slug}` = `nfse-manaus`
- `{seções_específicas}` = `§6.4 endpoint NFS-e, §7.4 payload Manaus, §8.1 fluxo, §8.5 emissão manual, §9.1 mapeamento LC116, §12 gap Manaus`
- `{arquivos_referência_extras}`:
  - `docs/superpowers/specs/anexos/2026-04-23-focus-suporte-manaus-respostas.md` (resposta Focus)
  - `docs/superpowers/specs/anexos/2026-04-23-contador-tratamento-pecas.md` (decisão contador)
- `{escopo_bullets}`:
  ```
  Automatizada (a partir de OS):
  - ManausNfseBuilder: constrói payload a partir de ServiceOrder + Person + Address + BudgetVersionItems
  - FiscalService.emit_nfse / cancel_nfse / consult_nfse completos
  - Celery task poll_fiscal_document reconhecendo doc_type=NFSE
  - Integração com ServiceOrderService: endpoint POST /api/v1/fiscal/nfse/emit/ {service_order_id}
  - Atualizar ServiceOrderService._can_deliver: checa Payment.fiscal_document.status=AUTHORIZED
  - Frontend: modal FiscalEmissionModal na tela OSDetailV2 (tab Pagamentos)

  Manual (ad-hoc, §8.5 do spec):
  - ManualNfseBuilder: payload a partir de form livre (sem OS)
  - FiscalService.emit_manual_nfse com permission can_emit_manual + manual_reason obrigatório
  - Endpoint POST /api/v1/fiscal/documents/nfse/emit-manual/
  - CheckConstraint no FiscalDocument: service_order=NULL exige manual_reason
  - Permission can_emit_manual atribuída a fiscal_admin e OWNER (apps/authz/seeds.py)
  - Frontend: nova tela ManualNfseEmissionPage (rota /fiscal/emitir-nfse) com formulário Zod (cliente + itens livres + discriminação + obs + justificativa) — RHF + react-select para Person
  - FiscalEvent.triggered_by="USER_MANUAL" para auditoria distinta

  Comum aos dois fluxos:
  - Hook useEmitNfse + useConsultFiscalDocument
  - Webhook dispatcher para evento nfse_autorizado
  - Smoke homologação: scripts/smoke_ciclo_06c.py emite NFS-e contra prefeitura teste (1 automatizada + 1 manual)
  ```
- `{bloqueadores}`:
  ```
  - Ciclo 06B merged
  - Resposta suporte Focus sobre padrão Manaus documentada (§12 do spec)
  - Decisão contador sobre peças em NFS-e documentada
  - CNPJ homologação DS Car cadastrado no painel Focus com certificado A1 teste
  ```
- `{entregaveis_bullets}`:
  ```
  - backend/core/apps/fiscal/services/manaus_nfse.py (ManausNfseBuilder + ManualNfseBuilder)
  - backend/core/apps/fiscal/services/fiscal_service.py (emit_nfse + emit_manual_nfse + cancel + consult)
  - backend/core/apps/fiscal/views.py (FiscalDocumentViewSet + actions emit_nfse, emit_nfse_manual)
  - backend/core/apps/fiscal/serializers.py (ManualNfseInputSerializer)
  - backend/core/apps/fiscal/migrations/000X_manual_reason_constraint.py
  - apps/authz/seeds.py atualizado com permission can_emit_manual
  - apps/dscar-web/src/components/fiscal/FiscalEmissionModal.tsx (automatizada)
  - apps/dscar-web/src/pages/ManualNfseEmissionPage.tsx (manual)
  - apps/dscar-web/src/api/fiscal.ts + schemas Zod (incl manualNfseSchema)
  - +40 testes (total projeto ≥ 375)
  - Smoke live validando emissão automatizada + manual + cancelamento
  ```

---

## Sprint 4 — Ciclo 06D: NF-e mod 55 + devolução + CCe

**Variáveis:**

- `{06X}` = `06D`
- `{nome_sprint}` = `NF-e modelo 55 + devolução + CCe`
- `{slug}` = `nfe-55`
- `{seções_específicas}` = `§6.3, §7.1, §7.2, §8.2, §8.5 emissão manual, §9.2 CFOP`
- `{escopo_bullets}`:
  ```
  Automatizada (a partir de venda estruturada):
  - NfeBuilder: payload NF-e normal (finalidade=1) + devolução (finalidade=4 + notas_referenciadas)
  - FiscalService.emit_nfe, emit_devolucao, cce, inutilizar
  - Mapeamento ItemOperationType → CFOP (tabela em settings)
  - Endpoint POST /api/v1/fiscal/nfe/emit/ para venda de peça avulsa estruturada
  - Endpoint POST /api/v1/fiscal/nfe/{id}/devolucao/
  - Endpoint POST /api/v1/fiscal/nfe/{id}/cce/

  Manual (ad-hoc, §8.5 do spec):
  - ManualNfeBuilder: payload a partir de form (cliente + itens NCM/CFOP livres + obs)
  - FiscalService.emit_manual_nfe com permission can_emit_manual + manual_reason obrigatório
  - Endpoint POST /api/v1/fiscal/documents/nfe/emit-manual/
  - Frontend: nova tela ManualNfeEmissionPage (rota /fiscal/emitir-nfe) com formulário Zod
    (cliente + itens com NCM/CFOP/qty/valor + naturezaOperacao + finalidade + obs + justificativa)
  - Reuso do mesmo padrão de permission/auditoria criado em 06C

  Comum:
  - Frontend: ação "Emitir devolução" em FiscalDocument autorizado (modal)
  - Frontend: ação "Emitir CCe" em FiscalDocument autorizado (modal)
  - Alerta 20h após emissão: "Cancelamento disponível por mais 4h"
  - Smoke homologação: venda automatizada + venda manual + CCe + devolução
  ```
- `{bloqueadores}`:
  ```
  - Ciclo 06C merged
  - Tabela CFOP definitiva revisada com contador
  ```
- `{entregaveis_bullets}`:
  ```
  - backend/core/apps/fiscal/services/nfe_builder.py (NfeBuilder + ManualNfeBuilder)
  - FiscalService expandido (emit_nfe, emit_manual_nfe, emit_devolucao, cce, inutilizar)
  - backend/core/apps/fiscal/serializers.py (ManualNfeInputSerializer)
  - apps/dscar-web/src/pages/PartsSalePage.tsx (venda estruturada)
  - apps/dscar-web/src/pages/ManualNfeEmissionPage.tsx (manual)
  - apps/dscar-web/src/components/fiscal/DevolucaoModal.tsx, CceModal.tsx
  - +35 testes (total projeto ≥ 410)
  - Smoke live NF-e estruturada + manual + devolução + CCe
  ```

---

## Sprint 5 — Ciclo 06E: NFC-e mod 65 (PDV balcão)

**Variáveis:**

- `{06X}` = `06E`
- `{nome_sprint}` = `NFC-e modelo 65 síncrono (PDV balcão)`
- `{slug}` = `nfce-65`
- `{seções_específicas}` = `§6.5, §7.3 payload NFC-e`
- `{escopo_bullets}`:
  ```
  - NfceBuilder: payload NFC-e com formas_pagamento obrigatório + consumidor_final=1
  - FiscalService.emit_nfce (síncrono — SEM polling)
  - Geração do QR-Code visual a partir do link retornado pela Focus
  - Frontend: tela PDVPage simples (seleção de peça + forma pgto + "Emitir")
  - Impressão térmica do DANFCE (receita básica em CSS print)
  - Smoke homologação
  ```
- `{bloqueadores}`:
  ```
  - Ciclo 06D merged
  - CSC (Código de Segurança do Contribuinte) obtido na SEFAZ-AM
  - CSC armazenado em FiscalConfig.nfce_csc (EncryptedField)
  ```
- `{entregaveis_bullets}`:
  ```
  - backend/core/apps/fiscal/services/nfce_builder.py
  - FiscalService.emit_nfce
  - apps/dscar-web/src/pages/PDVPage.tsx
  - apps/dscar-web/src/components/fiscal/DanfcePrint.tsx
  - +20 testes (total projeto ≥ 420)
  - Smoke live NFC-e
  ```

---

## Sprint 6 — Ciclo 06F: Manifestação destinatário (inbox)

**Variáveis:**

- `{06X}` = `06F`
- `{nome_sprint}` = `Manifestação destinatário (caixa de entrada NFs recebidas)`
- `{slug}` = `manifestacao-dest`
- `{seções_específicas}` = `§6.6, §8.4 fluxo inbox`
- `{escopo_bullets}`:
  ```
  - Novo model FiscalReceivedDocument (espelha FiscalDocument para NFs recebidas)
  - manifestacao_service com 4 tipos (ciencia/confirmacao/desconhecimento/operacao_nao_realizada)
  - Celery beat sync_focus_inbox (a cada 1h) listando /v2/nfes_recebidas do CNPJ
  - Auto-ciência: NF de fornecedor cadastrado (Category=FORNECEDOR_PECAS) recebe ciência automática
  - Frontend: página FiscalInboxPage com tabs (Pendentes / Ciência / Confirmadas / Desconhecidas)
  - Hook useManifestar
  - Smoke fixture (não há ambiente manifestação em homologação Focus — validar em doc)
  ```
- `{bloqueadores}`:
  ```
  - Ciclo 06E merged
  - Payload exato da manifestação confirmado com suporte Focus (§6.6 lista gap)
  ```
- `{entregaveis_bullets}`:
  ```
  - backend/core/apps/fiscal/models.py expandido (FiscalReceivedDocument)
  - backend/core/apps/fiscal/services/manifestacao_service.py
  - backend/core/apps/fiscal/tasks.py expandido (sync_focus_inbox)
  - apps/dscar-web/src/pages/FiscalInboxPage.tsx
  - +20 testes (total projeto ≥ 440)
  ```

---

## Meta-prompt (se quiser gerar todo o plano num shot)

Use este prompt em uma sessão nova de Claude Code quando quiser **gerar o plano de implementação completo de TODAS as 6 sprints** de uma vez:

```
Leia /docs/superpowers/specs/2026-04-23-modulo-fiscal-focus-nfe-design.md
e /docs/superpowers/prompts/2026-04-23-fiscal-sprints.md.

Para CADA uma das 6 sprints (06A → 06F), invoque superpowers:writing-plans
e gere um plano detalhado salvo em
docs/superpowers/plans/2026-04-23-ciclo-06X-{slug}.md.

Cada plano deve ter:
- Context (extraído do spec)
- Tarefas atômicas numeradas (cada uma um commit)
- Critérios de aceite por tarefa
- Verificação e smoke
- Riscos

Execute os 6 em paralelo usando superpowers:dispatching-parallel-agents
(são independentes — cada plano é um documento).

Ao final, apresente índice dos 6 planos criados e aguarde revisão.
Não inicie implementação.
```

---

## Princípios que nortearam essa quebra

1. **Vertical slicing**: cada sprint entrega valor de ponta a ponta (backend + frontend + smoke), não "só models" ou "só API".
2. **1:1 com spec**: sprints = ciclos do §14 do spec. Mudança de escopo = mudança de spec.
3. **Bloqueadores explícitos**: Sprint 3 só abre quando ticket Focus respondido — evita retrabalho por padrão municipal errado.
4. **TDD não-negociável**: skill `superpowers:test-driven-development` listada como obrigatória em todo prompt.
5. **Scope creep rejeitado**: lista de antipadrões inclui "mudanças não relacionadas" — refactors oportunistas vão para backlog separado.
6. **Plan mode primeiro**: cada sprint começa em plan mode. Nada é implementado sem ExitPlanMode aprovado.
