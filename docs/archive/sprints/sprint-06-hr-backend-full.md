# Sprint 6 — HR Backend: Full (Compensation, Clock, Payroll)

**Projeto:** DS Car ERP — Módulo de RH
**Sprint:** 06
**Última atualização:** 2026-04-06
**Legenda:** `[ ]` pendente · `[x]` concluído · `[~]` em progresso · `[!]` bloqueado

**Pré-requisito:** Sprint 5 concluído (app hr criado, Employee/EmployeeDocument/SalaryHistory funcionando)

---

## Escopo — Sprint 6

### US-HR-08 — Models Compensação

- [ ] `Bonus` — bonificações pontuais/recorrentes
- [ ] `GoalTarget` — metas individuais/setor com constraint XOR (employee|department)
- [ ] `Allowance` — vales/benefícios com fluxo solicitação→aprovação→pagamento
- [ ] `Deduction` — descontos na folha (faltas, INSS, IRRF, etc.)

### US-HR-09 — Models Ponto e Escala

- [ ] `TimeClockEntry` — registro de ponto (constraint: manual exige justificativa)
- [ ] `WorkSchedule` — escala semanal (UniqueConstraint por employee+weekday+effective_from)
- [ ] Management command: seed escala padrão DS Car (6x1) para colaboradores existentes

### US-HR-10 — Model Contracheque

- [ ] `Payslip` — snapshot imutável mensal (UniqueConstraint employee+reference_month)
- [ ] Campos: base_salary, total_bonuses, total_allowances, overtime, deductions, gross_pay, net_pay
- [ ] JSONFields: bonus_breakdown, allowance_breakdown, deduction_breakdown
- [ ] Controle: is_closed, closed_at, closed_by, pdf_file_key

### US-HR-11 — Services (Regras de Negócio)

- [ ] `TimeClockService.register_clock()` — sequência válida de batidas + select_for_update
- [ ] `TimeClockService._validate_sequence()` — clock_in → break_start → break_end → clock_out
- [ ] `AllowanceService.request_allowance()` — cria solicitação
- [ ] `AllowanceService.approve_allowance()` — fluxo requested→approved
- [ ] `AllowanceService.mark_as_paid()` — fluxo approved→paid + recibo
- [ ] `AllowanceService.generate_recurring_allowances()` — automação mensal
- [ ] `PayslipService.generate_payslip()` — cálculo completo: base + bônus + vales + HE - descontos
- [ ] `PayslipService.close_payslip()` — snapshot imutável + trigger PDF async + emit_dw_event
- [ ] `PayslipService._calculate_worked_hours()` — processa TimeClockEntries aprovadas

### US-HR-12 — Serializers Compensação/Ponto/Payslip

- [ ] `BonusSerializer` + `BonusCreateSerializer`
- [ ] `GoalTargetSerializer` + `GoalTargetUpdateSerializer`
- [ ] `AllowanceSerializer` + `AllowanceRequestSerializer`
- [ ] `DeductionSerializer` + `DeductionCreateSerializer`
- [ ] `TimeClockEntrySerializer` + `TimeClockRegisterSerializer`
- [ ] `WorkScheduleSerializer`
- [ ] `PayslipSerializer` + `PayslipGenerateSerializer`

### US-HR-13 — ViewSets Compensação/Ponto/Payslip

- [ ] `BonusViewSet` — nested em `/employees/{id}/bonuses/`
- [ ] `GoalTargetViewSet` — `/hr/goals/` + actions `achieve`
- [ ] `AllowanceViewSet` — `/hr/allowances/` + actions `approve`, `pay`, `receipt`
- [ ] `DeductionViewSet` — nested em `/employees/{id}/deductions/`
- [ ] `TimeClockViewSet` — `/hr/time-clock/` + actions `daily`, `monthly`, `approve`
- [ ] `WorkScheduleViewSet` — nested em `/employees/{id}/schedules/`
- [ ] `PayslipViewSet` — `/hr/payslips/` + actions `generate`, `close`, `pdf`, `report`

### US-HR-14 — Celery Tasks

- [ ] `task_generate_recurring_allowances(tenant_schema)` — 1º dia útil do mês
- [ ] `task_check_expiring_documents(tenant_schema)` — alerta documentos vencendo (30 dias)
- [ ] `task_generate_payslip_pdf(payslip_id, tenant_schema)` — gera PDF assíncrono
- [ ] Registrar tasks em `config/celery.py` beat_schedule

### US-HR-15 — DW Events

- [ ] `emit_dw_event('employee_hired', ...)` — no Employee.save() ao criar
- [ ] `emit_dw_event('employee_terminated', ...)` — no terminate action
- [ ] `emit_dw_event('salary_adjusted', ...)` — no SalaryHistory.save()
- [ ] `emit_dw_event('bonus_created', ...)` — no Bonus.save()
- [ ] `emit_dw_event('goal_achieved', ...)` — na action achieve
- [ ] `emit_dw_event('allowance_paid', ...)` — no mark_as_paid
- [ ] `emit_dw_event('time_clock_registered', ...)` — no register_clock
- [ ] `emit_dw_event('payslip_closed', ...)` — no close_payslip

### US-HR-16 — Migrations

- [ ] `makemigrations hr` — migration 0002 com todos os novos models
- [ ] Validar constraints: XOR goal, manual_entry_requires_justification, unique_payslip_per_month

### US-HR-17 — Testes Sprint 6

- [ ] `test_time_clock_service.py` — sequências válidas/inválidas, manual sem justificativa
- [ ] `test_allowance_service.py` — fluxo completo, pular etapa (erro), recurring
- [ ] `test_payslip_service.py` — cálculo base + bônus + vales - descontos = net
- [ ] `test_goal_views.py` — achieve cria Bonus automático
- [ ] `test_payslip_views.py` — generate, close, imutabilidade após fechamento
- [ ] QA Pass: todos os endpoints via Swagger + permissões SELF/MANAGER/ADMIN

---

## API Endpoints — Sprint 6

```
GET    /api/v1/hr/employees/{id}/bonuses/             → bonificações
POST   /api/v1/hr/employees/{id}/bonuses/             → lançar bonificação

GET    /api/v1/hr/goals/                              → todas as metas
POST   /api/v1/hr/goals/                              → criar meta
PATCH  /api/v1/hr/goals/{id}/                         → atualizar progresso
POST   /api/v1/hr/goals/{id}/achieve/                 → marcar como atingida (gera bônus)

GET    /api/v1/hr/employees/{id}/allowances/          → vales do colaborador
POST   /api/v1/hr/allowances/request/                 → solicitar vale
POST   /api/v1/hr/allowances/{id}/approve/            → aprovar
POST   /api/v1/hr/allowances/{id}/pay/                → marcar como pago + recibo

GET    /api/v1/hr/employees/{id}/deductions/          → descontos
POST   /api/v1/hr/employees/{id}/deductions/          → lançar desconto

POST   /api/v1/hr/time-clock/                         → registrar ponto
GET    /api/v1/hr/time-clock/daily/{date}/            → espelho do dia
GET    /api/v1/hr/time-clock/monthly/{month}/         → relatório mensal
POST   /api/v1/hr/time-clock/{id}/approve/            → aprovar ajuste manual

GET    /api/v1/hr/employees/{id}/schedules/           → escalas
POST   /api/v1/hr/employees/{id}/schedules/           → definir escala

POST   /api/v1/hr/payslips/generate/                  → gerar contracheque
POST   /api/v1/hr/payslips/{id}/close/                → fechar (imutável + PDF)
GET    /api/v1/hr/payslips/{id}/pdf/                  → download PDF
GET    /api/v1/hr/payslips/report/{month}/            → relatório consolidado
```

---

## Regras Críticas — Nunca Violar

1. CPF, RG, PIX, telefone → sempre `EncryptedField`
2. Contracheque fechado → imutável
3. Ponto manual → justificativa obrigatória + aprovação do gestor
4. Documentos → soft delete apenas
5. Desligamento → `status='terminated'`, dados retidos 5-10 anos
6. Multitenancy → todas as queries via `schema_context`
7. Salário → nunca negativo (validação serializer + service)
8. Vale → fluxo requested→approved→paid (sem pulo)
9. Meta atingida → gera Bonus automático
10. source='biometric' → bloqueado (erro amigável)

---

## Definição de Pronto (DoD)

- [ ] `make lint` passa (Black + isort)
- [ ] `make typecheck` passa (mypy)
- [ ] `pytest apps/hr/` — 100% passando, cobertura ≥80%
- [ ] Migrations aplicadas sem erros
- [ ] QA Pass: todos os endpoints testados via Swagger
- [ ] Regras críticas todas cobertas por testes
