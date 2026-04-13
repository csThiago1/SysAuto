# Backlog — Sprint 15 (Banking + Asaas + Relatórios Financeiros)

**Projeto:** DS Car ERP + Mobile
**Sprint atual:** 15 (web) · M5 (mobile)
**Última atualização:** 2026-04-12
**Legenda:** `[ ]` pendente · `[x]` concluído · `[~]` em progresso · `[!]` bloqueado

---

## Refinamentos UX Mobile pós-M4 — Concluído ✅
> Nav/Header/Filtros Redesign · 2026-04-12

### FrostedNavBar
- [x] Reescrita completa: T2 dark pill `#141414`, borderRadius 22, sem BlurView
- [x] `activeLine` vermelha com glow (3px, shadowColor #e31b1b) abaixo do ícone ativo
- [x] Botão central `+` vermelho (red pill com shadow)
- [x] Fix: `HIDDEN_ROUTES` continha `'os'` que era o nome do tab home → removido
- [x] Fix: `TAB_CONFIG[0].routeName` era `'os'` → corrigido para `'index'`
- [x] Tab busca → Agenda (ícone `calendar`/`calendar-outline`)
- [x] Tab perfil → Config (ícone `settings`/`settings-outline`)

### OSHeader (os/index.tsx)
- [x] LinearGradient `#1c1c1e → #141414` (antes era View sólida)
- [x] Logo DS Car centralizado com `resizeMode="cover"` + `overflow:hidden`
- [x] Layout DubiCars: `[spacer 40px][logo flex:1][bell button]`
- [x] Sem saudação, sem nome de usuário, sem chips de stats
- [x] Removido header nativo "Ordens de Serviço" do Stack (duplicava)
- [x] Removido botão de voltar customizado de `OSDetailHeader` (duplicava com nativo)
- [x] `headerBackTitle: 'Voltar'` no screen `[id]`
- [x] `headerSpacer` sem background (antes tinha `rgba(255,255,255,0.08)` visível)

### Busca (useServiceOrders.ts)
- [x] Expandida de somente `vehicle_plate` para `Q.or` em `vehicle_plate`, `customer_name`, `vehicle_model`, `vehicle_brand` + `number` (se numérico)

### Filtros por status (os/index.tsx)
- [x] Removido ScrollView horizontal com chips de status abaixo da busca
- [x] Adicionado botão `options-outline` (44×44) à direita da barra de busca
- [x] Estado ativo: borda/bg vermelhos + badge dot vermelho no canto
- [x] Modal bottom-sheet: lista "Todas" + 11 status com dot colorido + checkmark
- [x] Active filter label bar: linha compacta com nome do filtro ativo + botão × para limpar

---

## Sprint M4 Mobile — Concluído ✅
> Checklist de Itens + Editor de Anotações nas Fotos · 2026-04-12

### Backend
- [x] Migration `0012_add_checklist_item.py` — model `ChecklistItem` (checklist_type, category, item_key, status, notes)
- [x] `ChecklistItemSerializer` e `ChecklistItemBulkSerializer`
- [x] `GET /service-orders/{id}/checklist-items/` — lista por OS (filtra por checklist_type)
- [x] `POST /service-orders/{id}/checklist-items/bulk/` — upsert em lote (sync offline)
- [x] Migration `0014_vehicle_version.py` — campo `vehicle_version` em `ServiceOrder`
- [x] Migration `customers/0003` — campos `birth_date` e `address` em `UnifiedCustomer`

### Mobile
- [x] `AnnotationCanvas.tsx` — SVG dupla camada (committed + live preview), arrowhead path helper
- [x] `EditorToolBar.tsx` — ferramentas seta/círculo/texto, paleta 3 cores, undo/redo, salvar
- [x] `photo-editor/index.tsx` — editor completo com PanResponder, histórico 10 estados, ViewShot, expo-file-system novo API
- [x] `photo-editor/_layout.tsx` — Stack com `headerShown: false`
- [x] `checklist-items.store.ts` — Zustand offline-first para itens de checklist + `syncChecklistItems()`
- [x] `ItemChecklistGrid.tsx` — 7 categorias expansíveis, ciclo pending→ok→attention→critical, `ChecklistSummaryBar`
- [x] `checklist/[osId].tsx` — aba "Itens" + `handlePhotoPress` + botão upload unificado (fotos + itens)
- [x] `PhotoSlotGrid.tsx` — `onPhotoPress` prop, overlay anotação (badge roxo), thumbnail via `annotatedLocalUri`
- [x] `photo.store.ts` — tipos `Annotation` (arrow/circle/text), campos `annotations?`, `annotatedLocalUri?`, `observation?`
- [x] Upload unificado: `uploadPendingPhotos` usa `annotatedLocalUri ?? localUri`

### Correções pós-M4
- [x] Migration `0012` e `customers/0003` adicionadas ao git (estavam untracked)
- [x] `checklist-items.store.ts` e `ItemChecklistGrid.tsx` adicionados ao git (estavam untracked)
- [x] `os/index` stats: `observeCount()` reativo em vez de `Promise.all` com `fetchCount`
- [x] Bug raiz da regressão: `make migrate` não tinha sido rodado com migration `0014_vehicle_version` → resolvido

---

## Sprint 14 — Concluído ✅

### OS Form Web (dscar-web) — Sessão Paralela
- [x] `NewOSDrawer` — Sheet lateral para criação de OS (substitui modal/dialog antigo)
- [x] `TypeBar` — pill toggle cliente_type + selects de tipo OS e consultor
- [x] `VehicleSection` — seção com campo `vehicle_version` (versão/trim do veículo)
- [x] `CustomerSection` — seção de cliente com busca inline
- [x] `CustomerSearch` — combobox de busca de cliente por nome/CPF/placa
- [x] `InsurerSection` — seção seguradora com logo, número sinistro, franquia, perito
- [x] `InsurerSelect` / `InsurerLogo` — select de seguradoras com exibição do logo
- [x] `ExpertCombobox` — combobox de peritos (especialistas externos)
- [x] `OpeningTab` — layout duas colunas com TypeBar e PrazosSection
- [x] `PrazosSection` — campos de prazo de entrega e prometido

### Backend OS Form
- [x] Migration `0014_vehicle_version.py` — campo `vehicle_version` em `ServiceOrder`
- [x] `insurers/serializers.py` — `LogoField` com URL absoluta

---

## Sprint 13 — Concluído ✅

### Backend
- [x] `apps/hr/tax_calculator.py` — INSS/IRRF/FGTS progressivo (tabelas 2024/2025)
- [x] `apps/hr/accounting_service.py` — lançamentos automáticos ao fechar contracheque/vale/bônus
- [x] `PayslipService.generate_payslip()` — INSS e IRRF calculados automaticamente
- [x] `DevTenantMiddleware` — fallback `dscar.localhost` (admin Django funcionando)
- [x] Fix admissão colaborador HTTP 400 (campos opcionais vazios filtrados)

### Frontend
- [x] `packages/types/src/accounting.types.ts` — tipos contábeis completos
- [x] `src/hooks/useAccounting.ts` — 9 hooks TanStack Query v5
- [x] Sidebar — menu "Financeiro" colapsável
- [x] `/financeiro` — dashboard
- [x] `/financeiro/lancamentos` — lista de lançamentos
- [x] `/financeiro/lancamentos/[id]` — detalhe (fix TypeError)
- [x] `/financeiro/lancamentos/novo` — formulário partidas dobradas
- [x] `/financeiro/plano-contas` — árvore hierárquica
- [x] `/financeiro/plano-contas/nova` — criação de conta
- [x] Contracheque → link para lançamento contábil

---

## Sprint 14 (AP/AR) — Concluído ✅

### Backend — `apps/accounts_payable` ✅

- [x] `Supplier` model (nome, CNPJ, contato)
- [x] `PayableDocument` model (título a pagar, status progressivo)
- [x] `PayablePayment` model (baixa parcial/total)
- [x] `PayableDocumentService` — create/pay/cancel + overdue refresh
- [x] `PayableAccountingService` — lançamento automático na baixa (D: Fornecedores / C: Banco)
- [x] Serializers: SupplierSerializer, PayableDocumentListSerializer, PayableDocumentSerializer, CreatePayableDocumentSerializer, RecordPaymentSerializer
- [x] ViewSets: SupplierViewSet, PayableDocumentViewSet (+ `pay` + `cancel` actions)
- [x] Migration `0001_initial.py`

### Backend — `apps/accounts_receivable` ✅

- [x] `ReceivableDocument` model (título a receber, origin: OS/NF-e/Manual)
- [x] `ReceivableReceipt` model (baixa de recebimento)
- [x] `ReceivableDocumentService` — create/receive/cancel + overdue refresh
- [x] `ReceivableAccountingService` — lançamento na baixa (D: Banco / C: Clientes a Receber)
- [x] Serializers + ViewSets + Migration

### Backend — Integrações

- [x] `config/settings/base.py` — adicionar apps em `TENANT_APPS`
- [x] `config/urls.py` — registrar novas URLs
- [x] `hr/services.py` — ao fechar contracheque, criar `PayableDocument(origin='FOLHA')`
- [ ] `service_orders/services.py` — ao entregar OS, criar `ReceivableDocument(origin='OS')` → **Sprint 15**
- [ ] Celery beat task `task_refresh_overdue_payables` (diário 06:15) → **Sprint 15**
- [ ] Celery beat task `task_refresh_overdue_receivables` (diário 06:15) → **Sprint 15**
- [ ] Asaas webhook stub `POST /api/v1/accounts-payable/asaas/webhook/` → **Sprint 15**

### Frontend

- [x] `packages/types/src/financeiro.types.ts` — tipos AP/AR
- [x] `src/hooks/useFinanceiro.ts` — hooks TanStack Query v5
- [x] `/financeiro/contas-pagar/page.tsx` — lista + cards + RecordPaymentDialog
- [x] `/financeiro/contas-pagar/novo/page.tsx` — formulário novo título
- [x] `/financeiro/contas-receber/page.tsx` — lista + cards + RecordReceiptDialog
- [ ] `/financeiro/contas-receber/novo/page.tsx` → **Sprint 15**
- [ ] `/financeiro/contas-pagar/[id]/page.tsx` → **Sprint 15**
- [ ] `/financeiro/contas-receber/[id]/page.tsx` → **Sprint 15**
- [x] `/financeiro/page.tsx` — atualizar cards de visão geral

---

## Pré-Produção — Segurança 🔒

> Detalhes completos em `docs/pre-production-security.md`

- [x] JWT secret hardcoded removido (`auth.ts`) — 2026-04-10
- [x] TLS verification habilitado nos clientes httpx — 2026-04-10
- [x] WebSocket consumer rejeita conexões não autenticadas — 2026-04-10
- [ ] **SEC-01** Rotacionar `FIELD_ENCRYPTION_KEY` + re-encriptar dados (LGPD) — **Crítico**
- [ ] **SEC-02** `AUTH_SECRET` único por app (hub ≠ dscar-web)
- [ ] **SEC-03** Confirmar `DEV_JWT_SECRET` no `.env.local` de todos os devs
- [ ] **SEC-04** Rate limiting nos endpoints DRF
- [ ] **SEC-05** `dev-credentials` provider condicional via `DEV_CREDENTIALS_ENABLED`
- [ ] **SEC-06** Restringir Swagger/OpenAPI em produção
- [ ] **SEC-07** JWT audience verification habilitada
- [ ] **SEC-08** Validação de MIME type e tamanho em upload de fotos de OS

---

## Sprint 15 — Backlog

### Testes AP/AR (prioridade alta)
- [ ] Testes unitários `apps/accounts_payable` — suíte completa (modelos + services + views)
- [ ] Testes unitários `apps/accounts_receivable` — suíte completa (modelos + services + views)
- [ ] Cobertura mínima: 85% (similar ao `apps/accounting`)

---

## Sprint 15 — Backlog 🆕

### Pendências do Sprint 14 (carregadas)
- [ ] `service_orders/services.py` — ao entregar OS, criar `ReceivableDocument(origin='OS')`
- [ ] Celery beat task `task_refresh_overdue_payables` (diário 06:15)
- [ ] Celery beat task `task_refresh_overdue_receivables` (diário 06:15)
- [ ] Asaas webhook stub `POST /api/v1/accounts-payable/asaas/webhook/`
- [ ] `/financeiro/contas-receber/novo/page.tsx`
- [ ] `/financeiro/contas-pagar/[id]/page.tsx` — detalhe + histórico de baixas
- [ ] `/financeiro/contas-receber/[id]/page.tsx` — detalhe + histórico de recebimentos

### Testes AP/AR (prioridade alta)
- [ ] Testes unitários `apps/accounts_payable` — suíte completa (modelos + services + views)
- [ ] Testes unitários `apps/accounts_receivable` — suíte completa (modelos + services + views)
- [ ] Cobertura mínima: 85% (similar ao `apps/accounting`)

### Dívida Técnica Sprint 10
- [ ] Fix: teste `test_add_part_with_product_link` (nunca foi implementado)
- [ ] Fix: bulk delete signal em `ServiceOrderPart` para `recalculate_totals`
- [ ] Testes para validar fixes acima

### Banking (app `accounts_banking`)
- [ ] `BankAccount` model (nome, banco, agência, conta, saldo)
- [ ] `BankTransaction` model (lançamento bancário OFX/manual)
- [ ] `OFXImportService` — importação de extrato OFX
- [ ] Reconciliação manual AP/AR ↔ lançamentos bancários
- [ ] `CashFlowService` — fluxo de caixa projetado (AP vencimentos + AR previsões)

### Asaas Integration (completo)
- [ ] Webhook handler completo (payment_received, payment_overdue, etc.)
- [ ] Auto-baixa de `ReceivableDocument` ao receber evento Asaas
- [ ] Geração de cobrança Asaas ao criar `ReceivableDocument`

### Relatórios Financeiros
- [ ] DRE (Demonstração do Resultado) — por período fiscal
- [ ] Balanço Patrimonial
- [ ] Fluxo de Caixa Realizado vs. Projetado
- [ ] Export PDF (reportlab) + XLSX (openpyxl)
- [ ] Frontend: `/financeiro/relatorios`

---

## Sprint M5 Mobile — Backlog 🆕
> Abertura de OS no Mobile · próximo sprint

- [ ] Wizard 4 steps: Veículo (placa-fipe) → Cliente (busca inline) → Tipo OS (seguradora, sinistro) → Revisão
- [ ] Consulta de placa online + cache MMKV (últimas 50) + fallback manual offline
- [ ] Criação de OS offline (WatermelonDB) + sync ao reconectar
- [ ] Atalho "Iniciar Checklist Agora" pós-criação
- [ ] Integração EAS Build dev build (necessário para react-native-view-shot em produção)

---

## Pré-Produção — Segurança 🔒

> Detalhes completos em `docs/pre-production-security.md`

- [x] JWT secret hardcoded removido (`auth.ts`) — 2026-04-10
- [x] TLS verification habilitado nos clientes httpx — 2026-04-10
- [x] WebSocket consumer rejeita conexões não autenticadas — 2026-04-10
- [ ] **SEC-01** Rotacionar `FIELD_ENCRYPTION_KEY` + re-encriptar dados (LGPD) — **Crítico**
- [ ] **SEC-02** `AUTH_SECRET` único por app (hub ≠ dscar-web)
- [ ] **SEC-03** Confirmar `DEV_JWT_SECRET` no `.env.local` de todos os devs
- [ ] **SEC-04** Rate limiting nos endpoints DRF
- [ ] **SEC-05** `dev-credentials` provider condicional via `DEV_CREDENTIALS_ENABLED`
- [ ] **SEC-06** Restringir Swagger/OpenAPI em produção
- [ ] **SEC-07** JWT audience verification habilitada
- [ ] **SEC-08** Validação de MIME type e tamanho em upload de fotos de OS

---

## Histórico de Sprints

| Sprint | Tema | Status |
|--------|------|--------|
| 1–3 | OS, Kanban, Filtros | ✅ |
| 4 | RBAC, UX criação | ✅ |
| 5–6 | HR Backend completo | ✅ |
| 7–8 | HR Frontend completo | ✅ |
| 9 | Person↔Employee (admissão sem UUID) | ✅ |
| 10 | OS Peças + Notificações | ✅ |
| 11 | Módulo Contábil (fundação) | ✅ |
| 12 | Auth & SSO Keycloak | ✅ |
| 13 | RH↔Contabilidade + Impostos trabalhistas | ✅ |
| 14 | Contas a Pagar + Contas a Receber + OS Form web | ✅ |
| M1 | Mobile Fundação + Auth + Navegação | ✅ |
| M2 | Mobile OS Read-Only + Offline Foundation | ✅ |
| M3 | Mobile Checklist Fotográfico + Câmera + Fila Upload | ✅ |
| M4 | Mobile Checklist Itens + Editor Anotações | ✅ |
| M4.5 | Mobile Nav/Header/Filtros Redesign | ✅ |
| **15** | **Banking + Asaas + Relatórios** | 🔄 |
| **M5** | **Abertura de OS no Mobile** | 🔄 |

---

*Atualizado por: Paddock Solutions · 2026-04-12 (pós-M4 UX refinements)*
