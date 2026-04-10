# Backlog — Sprint 14 (Contas a Pagar + Contas a Receber)

**Projeto:** DS Car ERP
**Sprint:** 14
**Última atualização:** 2026-04-09
**Legenda:** `[ ]` pendente · `[x]` concluído · `[~]` em progresso · `[!]` bloqueado

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

## Sprint 14 — Finalizando 🔄

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

### Backend — Integrações (Parcial)

- [x] `config/settings/base.py` — adicionar apps em `TENANT_APPS`
- [x] `config/urls.py` — registrar novas URLs
- [x] `hr/services.py` — ao fechar contracheque, criar `PayableDocument(origin='FOLHA')`
- [ ] `service_orders/services.py` — ao entregar OS, criar `ReceivableDocument(origin='OS')`
- [ ] Celery beat task `task_refresh_overdue_payables` (diário 06:15)
- [ ] Celery beat task `task_refresh_overdue_receivables` (diário 06:15)
- [ ] Asaas webhook stub `POST /api/v1/accounts-payable/asaas/webhook/`

### Frontend (Parcial)

- [x] `packages/types/src/financeiro.types.ts` — tipos AP/AR
- [x] `src/hooks/useFinanceiro.ts` — hooks TanStack Query v5
- [x] `/financeiro/contas-pagar/page.tsx` — lista + cards + RecordPaymentDialog
- [x] `/financeiro/contas-pagar/novo/page.tsx` — formulário novo título
- [x] `/financeiro/contas-receber/page.tsx` — lista + cards + RecordReceiptDialog
- [ ] `/financeiro/contas-receber/novo/page.tsx` — formulário novo título
- [ ] `/financeiro/contas-pagar/[id]/page.tsx` — detalhe + histórico de baixas
- [ ] `/financeiro/contas-receber/[id]/page.tsx` — detalhe + histórico de recebimentos
- [x] `/financeiro/page.tsx` — atualizar cards de visão geral

---

## Sprint 15 — Backlog

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

## Progresso do Sprint 14

| Área | Total | Concluído | Pendente |
|------|-------|-----------|---------|
| Backend AP | 8 | 8 | 0 |
| Backend AR | 5 | 5 | 0 |
| Backend Integrações | 6 | 3 | 3 |
| Frontend | 9 | 6 | 3 |
| **Total** | **28** | **22** | **6** |

**Taxa de conclusão do Sprint 14:** 78,6% (finalizando 2026-04-09)

---

## Sprints Anteriores — Resumo

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
| 14 | Contas a Pagar + Contas a Receber | 🔄 |

---

*Atualizado por: Paddock Solutions · 2026-04-09*
