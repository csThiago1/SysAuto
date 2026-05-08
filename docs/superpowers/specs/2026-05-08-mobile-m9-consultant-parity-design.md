# Mobile M9 — Paridade do Consultor

**Data:** 2026-05-08
**Escopo:** Trazer paridade web → mobile para o fluxo do consultor: câmera landscape, edição completa de OS (peças/serviços), agenda com criação de eventos, cadastro rápido de clientes/veículos, e Kanban visual.

---

## 1. Problema

O consultor hoje depende do PC para:
- Editar dados de uma OS (peças, serviços, valores, datas)
- Agendar veículos para entrada/entrega
- Cadastrar clientes e veículos fora do wizard de nova OS
- Ter visão geral da oficina (Kanban)

Além disso, as fotos saem em portrait (celular na vertical), quando o padrão da oficina é landscape para capturar o veículo inteiro.

---

## 2. Escopo

### Incluso
- Câmera forçada em landscape
- OS Detail: edição de dados gerais (inline)
- OS Detail: CRUD de peças (add/edit/remove)
- OS Detail: CRUD de serviços (add/edit/remove)
- OS Detail: resumo financeiro calculado
- Agenda: criar/editar eventos
- Agenda: agendar veículo (atalho)
- Agenda: visualização semana
- Cadastro: cliente standalone
- Cadastro: veículo standalone (busca placa-fipe)
- Kanban visual de OS

### Excluído
- Financeiro (contas a pagar/receber) — back-office, PC
- HR, Fiscal, Compras — back-office, PC
- Estoque write (movimentação) — almoxarife usa PC
- Estoque read-only — backlog futuro

---

## 3. Câmera Landscape Obrigatória

**Arquivo:** `apps/mobile/app/(app)/camera/index.tsx`

Ao abrir a câmera:
1. `ScreenOrientation.lockAsync(OrientationLock.LANDSCAPE_RIGHT)`
2. Ao sair (foto tirada ou cancelar): `ScreenOrientation.lockAsync(OrientationLock.PORTRAIT_UP)`
3. Botão de captura e controles adaptam ao layout landscape
4. Marca d'água renderiza corretamente (texto no lado longo da foto)

**Fallback:** Se a rotação falhar (permissão negada), captura em portrait e rotaciona via `ImageManipulator.manipulateAsync` com `[{ rotate: -90 }]`.

---

## 4. Edição Completa de OS

### 4.1 Dados Gerais Editáveis

**Tela:** `apps/mobile/app/(app)/os/[id].tsx` — tab "Geral"

Hoje os dados são read-only via `InfoRow`. Mudar para editáveis:

| Campo | Tipo | Editável |
|-------|------|----------|
| Status | StatusUpdateModal (já existe) | ✅ já funciona |
| Tipo atendimento | Picker: Particular/Seguradora | ✅ novo |
| Seguradora | Picker (lista de seguradoras) | ✅ novo (visível se tipo=seguradora) |
| Nº sinistro | TextInput | ✅ novo |
| Tipo segurado | Picker: Segurado/Terceiro | ✅ novo |
| Franquia | TextInput numérico (R$) | ✅ novo |
| Previsão de entrega | DatePicker | ✅ novo |
| Observações técnicas | TextInput multiline | ✅ novo |
| Consultor | Picker (lista de consultores) | ✅ novo |

**Fluxo de edição:**
- Campos mostram valor atual em modo visualização
- Tap em um campo: abre modo edição inline (TextInput ou Picker)
- Botão "Salvar" aparece quando há mudanças (`dirtyFields`)
- `PATCH /api/v1/service-orders/{id}/` com apenas os campos modificados
- Toast de sucesso/erro

**Hook:** `useUpdateServiceOrder(osId)` — `useMutation` com `PATCH`

### 4.2 Tab Peças (CRUD)

**Tela:** `apps/mobile/app/(app)/os/[id].tsx` — tab "Peças"

**Listar:**
- Cards com: nome da peça, tipo (Troca/Outros), quantidade, preço unitário, subtotal
- Empty state: "Nenhuma peça adicionada"

**Adicionar:**
- Botão "Adicionar Peça" → Modal com:
  - Busca por nome/código no catálogo de peças
  - Quantidade (default: 1)
  - Preço unitário
  - Tipo: Troca / Outros
  - Painel (campo texto: "Para-brisa", "Porta LE", etc.)
- `POST /api/v1/service-orders/{id}/parts/`

**Editar:**
- Tap no card da peça → mesmo modal pre-filled
- `PATCH /api/v1/service-orders/{id}/parts/{partId}/`

**Remover:**
- Swipe left no card → botão "Remover" vermelho
- ConfirmDialog: "Remover peça X?"
- `DELETE /api/v1/service-orders/{id}/parts/{partId}/`

**Hook:** `useOSParts(osId)` — query + mutations (add/edit/remove)

### 4.3 Tab Serviços (CRUD)

**Tela:** `apps/mobile/app/(app)/os/[id].tsx` — tab "Serviços"

**Listar:**
- Cards com: descrição do serviço, categoria, valor
- Empty state: "Nenhum serviço adicionado"

**Adicionar:**
- Botão "Adicionar Serviço" → Modal com:
  - Busca no catálogo de serviços (`/api/v1/service-catalog/`)
  - Ou descrição manual
  - Valor
  - Categoria (Funilaria, Pintura, Mecânica, etc.)
- `POST /api/v1/service-orders/{id}/labor-items/`

**Editar:**
- Tap no card → modal pre-filled
- `PATCH /api/v1/service-orders/{id}/labor-items/{itemId}/`

**Remover:**
- Swipe left → "Remover"
- `DELETE /api/v1/service-orders/{id}/labor-items/{itemId}/`

**Hook:** `useOSLaborItems(osId)` — query + mutations

### 4.4 Resumo Financeiro

Na tab "Geral", abaixo dos dados editáveis:

```
┌─────────────────────────────────┐
│  RESUMO FINANCEIRO              │
│  Peças           R$ 1.250,00    │
│  Serviços        R$ 2.800,00    │
│  Subtotal        R$ 4.050,00    │
│  Desconto (5%)   - R$ 202,50   │
│  ─────────────────────────────  │
│  TOTAL           R$ 3.847,50   │
└─────────────────────────────────┘
```

Valores calculados a partir dos dados da OS (read-only). Formatação BRL com `Intl.NumberFormat`.

---

## 5. Agenda Completa

### 5.1 Criar Evento

**Tela:** `apps/mobile/app/(app)/agenda/index.tsx`

Botão FAB "+" no canto inferior → Modal:
- **Tipo:** Entrada | Entrega | Retorno | Outro
- **Data:** DatePicker (default: data selecionada no calendário)
- **Hora:** TimePicker
- **Placa:** TextInput com busca por placa (autocomplete de OS existentes)
- **Cliente:** TextInput com busca por nome
- **Observação:** TextInput multiline
- `POST /api/v1/calendar/events/`

### 5.2 Editar Evento

- Tap no evento existente → mesmo modal pre-filled
- `PATCH /api/v1/calendar/events/{id}/`
- Botão "Excluir" → ConfirmDialog → `DELETE /api/v1/calendar/events/{id}/`

### 5.3 Agendar Veículo (atalho)

- Na lista de OS ou no detalhe da OS: botão "Agendar Entrada" / "Agendar Entrega"
- Abre modal de evento pre-filled com dados da OS (placa, cliente, tipo=entrada/entrega)
- Data: DatePicker (default: previsão de entrega da OS)

### 5.4 Visualização Semana

- Toggle no header da agenda: "Mês" / "Semana"
- Semana: 7 colunas com blocos horários (8h–18h)
- Eventos mostrados como blocos coloridos por tipo
- Scroll vertical nos horários
- Swipe horizontal entre semanas

**Hook:** `useCalendarEvents(dateRange)` — já existe `useCalendar`, expandir com mutations

---

## 6. Cadastro Rápido

### 6.1 Novo Cliente (standalone)

**Tela:** nova rota `apps/mobile/app/(app)/cadastro/cliente.tsx`

Acessível via:
- Menu "+" central → opção "Novo Cliente"
- Dentro da agenda ao criar evento

Campos:
- Nome completo (obrigatório)
- CPF (opcional, com máscara)
- Telefone (obrigatório, com máscara)
- Email (opcional)
- Checkbox LGPD: "Autorizo o uso dos meus dados..."

`POST /api/v1/customers/`

Toast: "Cliente cadastrado com sucesso"

### 6.2 Novo Veículo (standalone)

**Tela:** nova rota `apps/mobile/app/(app)/cadastro/veiculo.tsx`

Acessível via:
- Menu "+" central → opção "Novo Veículo"

Fluxo:
1. Input placa → busca placa-fipe (mesmo do wizard OS)
2. Auto-fill: marca, modelo, ano, cor
3. Campos manuais adicionais: chassi, KM
4. Vincular a cliente existente (busca por nome)

`POST /api/v1/vehicles/` (ou endpoint equivalente)

### 6.3 Menu "+" Expandido

O botão central "+" da tab bar hoje vai direto pra "Nova OS". Mudar para um menu de ações rápidas:

```
┌──────────────────────┐
│  Nova OS             │
│  Novo Cliente        │
│  Novo Veículo        │
│  Agendar Entrada     │
└──────────────────────┘
```

Bottom sheet com 4 opções. Tap em qualquer uma navega pra tela correspondente.

---

## 7. Kanban Visual

**Tela:** nova rota `apps/mobile/app/(app)/kanban/index.tsx`

Acessível via: nova tab na navegação (substitui ou adiciona ao lado de OS list)

**Colunas (status agrupados):**
| Coluna | Status inclusos |
|--------|----------------|
| Recepção | reception, initial_survey |
| Orçamento | budget, waiting_auth |
| Autorizado | authorized, waiting_parts |
| Em Reparo | repair, mechanic, bodywork, painting, assembly |
| Vistoria | polishing, washing, final_survey |
| Pronto | ready |
| Entregue | delivered |

**Card do Kanban:**
```
┌────────────────────┐
│ OS #1234           │
│ QZA4C43 · Onix     │
│ João Silva         │
│ 🕐 12 dias         │
└────────────────────┘
```

- Scroll horizontal entre colunas
- Badge com contagem no header de cada coluna
- Tap no card → navega pro detalhe da OS
- Puxar pra baixo atualiza (pull-to-refresh)
- Cards ordenados por data de entrada (mais antigos no topo = urgentes)

**Hook:** `useKanbanOS()` — busca todas as OS ativas, agrupa por status

---

## 8. Ordem de Execução

```
Sprint M9a — Câmera + Edição de OS (~3 dias)
─────────────────────────────────────────
1. Câmera landscape obrigatória
2. Hook useUpdateServiceOrder (PATCH OS)
3. OS Detail: dados gerais editáveis
4. Hook useOSParts (CRUD peças)
5. Tab Peças: CRUD completo
6. Hook useOSLaborItems (CRUD serviços)
7. Tab Serviços: CRUD completo
8. Resumo financeiro na tab Geral

Sprint M9b — Agenda + Cadastro + Kanban (~3 dias)
─────────────────────────────────────────
9. Agenda: criar evento (modal + POST)
10. Agenda: editar/excluir evento
11. Agenda: agendar veículo (atalho da OS)
12. Agenda: visualização semana
13. Cadastro: cliente standalone
14. Cadastro: veículo standalone (placa-fipe)
15. Menu "+" expandido (bottom sheet com 4 ações)
16. Kanban: tela com colunas horizontais
17. Kanban: hook useKanbanOS + cards
```

---

## 9. Dependências Técnicas

| Dependência | Task | Descrição |
|-------------|------|-----------|
| `expo-screen-orientation` | 1 | Já instalado (M7) |
| `@react-native-community/datetimepicker` | 3, 9 | DatePicker/TimePicker nativo |
| `react-native-swipeable-item` ou gesture | 5, 7 | Swipe-to-delete em cards |
| Backend: PATCH /service-orders/{id}/ | 2-3 | Já existe |
| Backend: CRUD /service-orders/{id}/parts/ | 4-5 | Já existe |
| Backend: CRUD /service-orders/{id}/labor-items/ | 6-7 | Já existe |
| Backend: CRUD /calendar/events/ | 9-11 | Já existe |
| Backend: POST /customers/ | 13 | Já existe |

---

## 10. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Câmera landscape pode não funcionar em todos os Android | Médio | Fallback: rotação via ImageManipulator |
| OS Detail fica muito pesado com edição + tabs | Médio | Lazy loading por tab, componentes separados |
| Kanban com muitas OS (50+) pode ser lento | Baixo | Virtualizar com FlatList horizontal + limitação por página |
| TimePicker nativo inconsistente entre iOS/Android | Baixo | Usar @react-native-community/datetimepicker |

---

*Paddock Solutions · paddock.solutions · Manaus, AM*
