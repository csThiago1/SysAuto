# Sprint 13 — Abril 2026
## Integração RH↔Contabilidade + Cálculo de Impostos Trabalhistas

### Objetivo
Integrar o módulo de RH ao módulo contábil (lançamentos automáticos) e implementar o cálculo automático de INSS/IRRF/FGTS na geração de contracheques. Entrega do frontend financeiro.

### Backend

#### `apps/hr/tax_calculator.py` (CRIADO)
- Tabelas 2024/2025 (Portaria MF nº 3/2024)
- `calcular_inss(salario_bruto)` — tabela progressiva por faixas (7,5%–14%), cada faixa incide apenas sobre o valor dentro da faixa
- `calcular_irrf(salario_bruto, inss, dependentes=0)` — base = bruto − INSS − (dependentes × R$189,59), tabela progressiva com deduções fixas por faixa
- `calcular_fgts(salario_bruto)` — 8% patronal (informativo)
- `calcular_impostos(salario_bruto, dependentes)` — retorna dict com inss, irrf, fgts_informativo, total_descontos
- Todos os valores com `Decimal` + `ROUND_HALF_UP`

Tabela INSS:
| Faixa até | Alíquota |
|-----------|----------|
| R$1.412,00 | 7,5% |
| R$2.666,68 | 9,0% |
| R$4.000,03 | 12,0% |
| R$7.786,02 | 14,0% |

Tabela IRRF (após INSS):
| Faixa até | Alíquota | Dedução fixa |
|-----------|----------|-------------|
| R$2.259,20 | 0% | R$0,00 |
| R$2.826,65 | 7,5% | R$169,44 |
| R$3.751,05 | 15% | R$381,44 |
| R$4.664,68 | 22,5% | R$662,77 |
| Acima | 27,5% | R$896,00 |

#### `apps/hr/accounting_service.py` (CRIADO)
- `HRAccountingService` — publica lançamentos contábeis automáticos para eventos de RH
- `HR_ACCOUNT_MAP` — mapeamento de chaves semânticas para códigos do plano de contas DS Car:
  - `salario_bruto` → 6.1.01.001 (Despesa c/ Salários)
  - `inss_patronal` → 6.1.02.001 (Encargos Sociais)
  - `fgts` → 6.1.02.002 (FGTS)
  - `salario_liquido_pagar` → 2.1.03.001 (Salários a Pagar)
  - `inss_retido` → 2.1.03.002 (INSS a Recolher)
  - `irrf_retido` → 2.1.03.003 (IRRF a Recolher)
  - `vale_refeicao` → 6.1.03.001 (Despesa c/ Benefícios)
  - `banco` → 1.1.01.002 (Banco Bradesco C/C)
  - `bonus` → 6.1.01.002 (Bônus e Gratificações)
- `post_payslip(payslip, user)` — ao fechar contracheque: débita salário/encargos, credita salários a pagar/INSS a recolher/IRRF a recolher
- `post_allowance_payment(allowance, user)` — ao pagar vale: débita despesa benefícios, credita banco
- `post_bonus(bonus, user)` — ao registrar bônus: débita bônus, credita salários a pagar
- Todos os métodos: try/except sem propagar — RH nunca falha por erro contábil

#### `apps/hr/services.py` (MODIFICADO)
- `PayslipService.generate_payslip()` — integração automática INSS/IRRF:
  - Base tributável = salário base + bônus + HE (vales excluídos — art. 458 CLT)
  - `tributos = calcular_impostos(gross, dependentes)`
  - `deduction_breakdown` inclui INSS + IRRF + descontos manuais
  - IRRF omitido do breakdown se zero (isenção)
- `PayslipService.close_payslip()` — hook contábil pós-fechamento:
  ```python
  try:
      HRAccountingService.post_payslip(payslip, user)
  except Exception as exc:
      logger.warning("Falha ao gerar lançamento: %s", exc)
  ```
- `AllowanceService.mark_as_paid()` — hook `post_allowance_payment` idem

#### `config/settings/dev.py` — DevTenantMiddleware (CORRIGIDO)
- `localhost`/`127.0.0.1` agora fallback automático para `dscar.localhost`
- Sem essa correção: Django admin inacessível (models só existem no schema tenant)

### Frontend

#### Módulo Financeiro — Páginas criadas
- `/financeiro` — dashboard com cards de estatísticas
- `/financeiro/lancamentos` — lista de lançamentos contábeis
- `/financeiro/lancamentos/[id]` — detalhe do lançamento (partidas dobradas)
- `/financeiro/lancamentos/novo` — formulário de lançamento manual (partidas dobradas dinâmicas, indicador de balanceamento)
- `/financeiro/plano-contas` — árvore hierárquica do plano de contas
- `/financeiro/plano-contas/nova` — formulário de criação de conta contábil
- `/financeiro/contas-pagar` — placeholder Sprint 14
- `/financeiro/contas-receber` — placeholder Sprint 14

#### Hooks — `src/hooks/useAccounting.ts` (CRIADO)
9 hooks TanStack Query v5: `useChartOfAccounts`, `useChartOfAccountsTree`, `useAnalyticalAccounts`, `useJournalEntries`, `useJournalEntry`, `useCreateJournalEntry`, `useApproveJournalEntry`, `useReverseJournalEntry`, `useCurrentFiscalPeriod`, `useCreateChartOfAccount`

#### Sidebar — `src/components/Sidebar.tsx` (MODIFICADO)
- Menu "Financeiro" colapsável com 4 sub-itens (Lançamentos, Plano de Contas, Contas a Pagar, Contas a Receber)

#### `packages/types/src/accounting.types.ts` (CRIADO)
- Interfaces: `ChartOfAccount`, `FiscalPeriod`, `JournalEntry`, `JournalEntryLine`, `CostCenter`, etc.
- `JournalEntry.fiscal_period: string` (UUID) + `fiscal_period_label: string` — não objeto aninhado
- Labels: `ACCOUNT_TYPE_LABELS`, `NATURE_LABELS`, `ORIGIN_LABELS`

### Bugs Corrigidos

| # | Sintoma | Causa | Fix |
|---|---------|-------|-----|
| 1 | Django admin inacessível para todos os models tenant | `localhost` → schema `public`, sem tabelas TENANT_APPS | `DevTenantMiddleware` fallback `dscar.localhost` |
| 2 | `TypeError: Cannot read properties of undefined (reading 'year')` na página de detalhe do lançamento | Tipo `fiscal_period` era `FiscalPeriod` (objeto aninhado), API retorna UUID string | Corrigido em `accounting.types.ts` + detalhe usa `fiscal_period_label` |
| 3 | Criação de colaborador retorna HTTP 400 | Formulário enviava campos opcionais como `""` (DRF DateField rejeita string vazia) | Filter `v !== "" && v !== undefined` antes de construir payload |
| 4 | Contracheque gerado sem descontos | `generate_payslip` só somava `Deduction` manuais, sem INSS/IRRF automático | Criado `tax_calculator.py` + integrado em `generate_payslip` |

### Validação Numérica (R$2.000 e R$5.000)

| Salário | INSS | IRRF | Total Descontos | Líquido |
|---------|------|------|-----------------|---------|
| R$2.000,00 | R$158,82 | R$0,00 (isento) | R$158,82 | R$1.841,18 |
| R$5.000,00 | R$518,82 | R$345,50 | R$864,32 | R$4.135,68 |

### Comando setup (plano de contas)
```bash
docker exec paddock_django python manage.py setup_chart_of_accounts \
  --schema tenant_dscar --settings=config.settings.dev
# Resultado: 131 contas criadas
```

### Regras de Negócio Críticas
- Vales (refeição/transporte) **não** compõem base de INSS/IRRF (art. 458 CLT)
- Contracheque fechado → imutável; correção via lançamento compensatório
- Erro contábil → **nunca** interrompe fluxo de RH (try/except com logger.warning)
- FGTS é patronal (informativo no contracheque — não desconta do colaborador)

---
*Sprint 13 — Paddock Solutions · DS Car ERP · Abril 2026*
