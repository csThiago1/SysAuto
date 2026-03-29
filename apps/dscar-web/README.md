# dscar-web — Frontend ERP DS Car

React 19 + Vite 6 + Tailwind CSS v4 + TypeScript strict.

## Rodar localmente

```bash
npm install
npm run dev        # http://localhost:3000
```

**Login em modo demo:**
- Usuário: qualquer (ex: `dory`)
- Senha: `dscar`

## Modos de operação

| Variável | Valor | Comportamento |
|---|---|---|
| `VITE_USE_MOCK_DATA` | não definido *(padrão)* | Mock data local, login local (`dscar`) |
| `VITE_USE_MOCK_DATA` | `false` | Conecta ao backend Django em `VITE_API_URL` |

Crie `.env` para configurar:

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_USE_MOCK_DATA=false
```

## Estrutura

```
src/
├── api/               # Clientes da API REST (client.ts + módulos)
│   ├── client.ts      # Fetch com JWT auto-refresh
│   ├── serviceOrders.ts
│   ├── persons.ts
│   └── vehicles.ts
├── components/        # Componentes de UI
│   ├── Kanban.tsx     # Quadro com 15 colunas (drag & transições validadas)
│   ├── LoginScreen.tsx
│   ├── ServiceOrders.tsx
│   ├── Dashboard.tsx
│   └── ...
├── hooks/             # Hooks com fallback mock → API real
│   ├── useServiceOrders.ts
│   └── usePersons.ts
├── AuthContext.tsx    # JWT auth + mock auth
├── App.tsx            # Auth guard + roteamento de views
├── types.ts           # Tipos TypeScript + VALID_TRANSITIONS
├── mockData.ts        # Dados de exemplo (50 OS geradas)
└── utils.ts           # cn(), formatCurrency(), canTransitionOSStatus()
```

## Kanban — estados e transições

O frontend espelha exatamente o `VALID_TRANSITIONS` do backend Django.
Movimentos inválidos são bloqueados no drag e no menu de status.

```
reception → initial_survey → budget → [waiting_parts | repair]
repair → [mechanic | bodywork | polishing]
mechanic → [bodywork | polishing]
bodywork → painting → assembly → polishing
polishing → washing → final_survey → ready → delivered
```

## Scripts

```bash
npm run dev        # dev server (porta 3000)
npm run build      # build de produção
npm run lint       # tsc --noEmit (typecheck)
npm run clean      # remove dist/
```
