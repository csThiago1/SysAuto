# Dashboard Role-Based — Design

**Data:** 2026-04-13
**Sprint:** 16
**Status:** Aprovado para implementação

---

## Goal

Transformar o dashboard genérico em visões específicas por perfil: **Consultor** (resumo pessoal do dia) e **Gerente/Admin/Diretoria** (KPIs financeiros + produtividade da equipe).

---

## Contexto

Dashboard atual (`/dashboard/page.tsx`) usa `useDashboardStats` que chama `GET /service-orders/dashboard/stats/` e retorna apenas `{ total_open, by_status, today_deliveries }`. Precisa ser expandido para dados financeiros e por consultor.

Fontes de dados disponíveis:
- `ServiceOrder` — status, datas, `services_total`, `parts_total`, `customer_type`, `insurer`
- `ReceivableDocument` (AR) — `amount`, `competence_date`, `origin`, `status` (`paid`/`pending`)
- `ServiceOrderLabor` — `unit_price`, `quantity` (serviços por OS)

---

## Visão Consultor (role: CONSULTANT)

KPIs pessoais do dia atual:
- **Minhas OS Abertas** — OS where `assigned_to = me` and status not in (delivered, cancelled)
- **Entregas Hoje** — OS where `estimated_delivery_date = today` assigned to me
- **OS Atrasadas** — OS where `estimated_delivery_date < today` not delivered, assigned to me
- **Concluídas esta semana** — OS delivered in last 7 days assigned to me

Lista rápida: últimas 5 OS minhas em andamento (placa, cliente, status, dias na oficina).

> Nota: campo `assigned_to` pode não existir no modelo ainda. Se não existir, usar todas as OS abertas como proxy para Sprint 16.

---

## Visão Gerente/Admin/Diretoria (role: MANAGER, ADMIN, OWNER)

### Cards KPI (linha superior)
- **Faturamento Mês** — soma `ReceivableDocument.amount` onde `competence_date` no mês corrente
- **OS Entregues Mês** — count OS com `delivery_date` no mês corrente
- **Ticket Médio** — Faturamento Mês / OS Entregues Mês
- **OS Atrasadas** — count OS where `estimated_delivery_date < today` not delivered

### Gráfico: Faturamento por Tipo de Cliente
- Barras: Particular vs Seguradora
- Período: últimos 6 meses
- Dados: `ReceivableDocument` agrupado por `origin` e mês

### Gráfico: Faturamento por Seguradora (Top 5)
- Barras horizontais das 5 maiores seguradoras no mês atual
- Valor absoluto + percentual do total

### Tabela: Produtividade da Equipe
- Colunas: Consultor, OS Abertas, OS Entregues (mês), Ticket Médio
- Agrupado por `created_by` (proxy para consultor responsável)

### Lista: OS Atrasadas
- Placa, cliente, previsão de entrega, dias de atraso, status atual

---

## Backend — Extensão do Endpoint

`DashboardStatsView` retorna dados condicionais por role:

```json
// CONSULTANT
{
  "role": "consultant",
  "my_open": 4,
  "my_deliveries_today": 1,
  "my_overdue": 0,
  "my_completed_week": 6,
  "my_recent_os": [...]
}

// MANAGER / ADMIN / OWNER
{
  "role": "manager",
  "billing_month": "45800.00",
  "delivered_month": 23,
  "avg_ticket": "1991.30",
  "overdue_count": 3,
  "billing_by_type": { "insurer": "38000.00", "private": "7800.00" },
  "billing_by_insurer": [{"name": "Porto Seguro", "amount": "18000.00"}, ...],
  "billing_last_6_months": [...],
  "team_productivity": [...],
  "overdue_os": [...]
}
```

---

## Decisões

- `assigned_to` FK não existe no modelo atual → Consultor vê todas as OS abertas para Sprint 16, com nota "em breve filtrado por responsável"
- Gráficos usam shadcn/ui `Chart` component (Recharts) — já disponível no projeto
- Billing data vem de `ReceivableDocument` (AR) — importa `accounts_receivable` app no DashboardStatsView
- Se `ReceivableDocument` não tiver dados ainda, usar `services_total + parts_total` das OS entregues como fallback de billing
- `fipe_value` não entra em nenhum cálculo de faturamento
- Deductible amount (`deductible_amount`) contabilizado para OS de seguradora
