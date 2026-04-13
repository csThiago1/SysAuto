# Agenda (Calendário de OS) — Design

**Data:** 2026-04-13
**Sprint:** 16
**Status:** Aprovado para implementação

---

## Goal

Criar uma tela de agenda em `/agenda` que exibe as OSs agendadas (entrada) e previstas para entrega em visualizações de mês/semana/dia, permitindo que consultores visualizem a carga de trabalho e façam agendamentos manuais.

---

## Contexto

`ServiceOrder` já possui:
- `scheduling_date` — DateTimeField: data/hora de entrada agendada do veículo
- `estimated_delivery_date` — DateField: previsão de entrega (calculada: entrada + repair_days)

Não é necessário criar novos modelos. A agenda lê esses campos existentes.

---

## Eventos na Agenda

Dois tipos de evento por OS:
1. **Entrada** (🔵): `scheduling_date` — cor azul, label "Entrada: placa/cliente"
2. **Entrega** (🟢): `estimated_delivery_date` — cor verde, label "Entrega: placa/cliente"

Clique em qualquer evento navega para `/service-orders/{id}`.

---

## Backend — Endpoint de Calendário

Novo endpoint dedicado (mais eficiente que filtrar o endpoint de lista completo):

```
GET /api/service-orders/calendar/?date_start=YYYY-MM-DD&date_end=YYYY-MM-DD
```

Retorna OS com `scheduling_date` ou `estimated_delivery_date` dentro do range.
Payload reduzido: `id, number, plate, customer_name, status, scheduling_date, estimated_delivery_date`.

---

## Frontend — Visualizações

### Mês
- Grid 7×5/6 com cabeçalho de dia da semana
- Pills coloridas nos dias com eventos
- Overflow "+ N mais" clicável para expandir

### Semana
- 7 colunas (dom–sáb), linhas de hora (07h–20h)
- Eventos posicionados por hora dentro do dia
- Entradas têm horário (scheduling_date); entregas aparecem no topo do dia

### Dia
- Coluna única com grade por hora
- Todos os eventos do dia em detalhe

---

## Agendamento Manual

- Botão "Agendar" na agenda abre `SchedulingDialog`
- Busca OS por placa/número
- Campos: data/hora entrada, dias de reparo (calcula previsão de entrega)
- PATCH `scheduling_date` + `repair_days` + `estimated_delivery_date` na OS existente
- Ou shortcut: ao criar nova OS pelo `NewOSDrawer`, campo de agendamento pré-preenchido se disparado da agenda

---

## Decisões

- **Sem nova dependência de calendário** — implementação custom com date-fns (já disponível no projeto)
- Agenda lê OS existentes — sem tabela separada de "appointments"
- `estimated_delivery_date` é DateField (sem hora) → exibido como evento all-day na agenda
- Status OS não muda ao agendar — apenas campos de data são preenchidos
- Futuro (fora do escopo Sprint 16): detecção de conflito de horários, notificações, sugestão automática de slot disponível

---

## Sidebar

Novo item "Agenda" com ícone `CalendarDays` entre "Ordens de Serviço" e "Cadastros".
