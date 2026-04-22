# Sprint M6 Mobile — Acompanhamento de Reparos + Vistorias
**Data:** Abril 2026
**Stack:** React Native + Expo SDK 55, TypeScript strict, WatermelonDB, Zustand
**Monorepo:** /Users/thiagocampos/Documents/Projetos/grupo-dscar
**Working dir:** apps/mobile

---

## Estado Atual (pré-M6)

Sprint M5 **100% concluída**:
- Wizard Nova OS (4 steps): Step1Vehicle, Step2Customer, Step3OSType, Step4Review
- `useVehicleByPlate`: placa-fipe.apibrasil.com.br + cache MMKV (TTL 7d, max 50)
- `useCreateServiceOrder`: online (POST → WatermelonDB) + offline (`pushStatus='pending'`)
- `sync.ts pushChanges`: envia registros pending ao reconectar
- OS detail `[id].tsx`: "Avançar Status" via `VALID_TRANSITIONS` + modal bottom-sheet
- `useUpdateOSStatus`: PATCH + update WatermelonDB + invalida TanStack Query
- `OSCard`: `React.memo` com comparador explícito

---

## Arquivos Relevantes

```
apps/mobile/
├── app/(app)/os/[id].tsx               ← detalhe OS (status update funcional)
├── app/(app)/checklist/[osId].tsx      ← checklist de fotos (M3) — reutilizar
├── src/hooks/useServiceOrders.ts       ← lista + sync (60s polling)
├── src/hooks/useUpdateOSStatus.ts      ← PATCH status + WatermelonDB
├── src/hooks/useCreateServiceOrder.ts  ← criação online/offline
├── src/db/sync.ts                      ← synchronize WatermelonDB
├── src/db/models/ServiceOrder.ts       ← modelo WatermelonDB
├── src/components/os/OSStatusBadge.tsx ← getStatusLabel/Color/BackgroundColor
├── src/components/nova-os/             ← Steps 1–4 do wizard
└── src/stores/new-os.store.ts          ← wizard state

packages/types/src/index.ts             ← ServiceOrderStatus, VALID_TRANSITIONS
```

Backend endpoints relevantes:
```
GET  /api/v1/service-orders/{id}/          → detalhe completo
PATCH /api/v1/service-orders/{id}/         → atualiza status/campos
POST /api/v1/service-orders/{id}/photos/   → upload (campos: file, folder, slot)
GET  /api/v1/service-orders/{id}/photos/   → lista fotos por pasta
```

---

## Tarefas M6

### Tarefa 1 — Fotos de Acompanhamento

No detalhe da OS (`app/(app)/os/[id].tsx`), adicionar seção "Fotos de Acompanhamento":
- Botão "Adicionar Foto" → abre câmera com marca d'água (reusar fluxo M3)
- Grade de thumbnails, tap para ampliar
- Upload online com progresso ou fila offline (`pushStatus='pending'`)
- `folder: 'acompanhamento'` no POST de foto

### Tarefa 2 — Vistoria Inicial

Quando OS está em `initial_survey`, mostrar card destacado "Iniciar Vistoria de Entrada" no detalhe.

Nova tela: `app/(app)/vistoria/entrada/[osId].tsx`
1. Checklist fotográfico completo (reutilizar componentes do M3/M4):
   - 6 slots externos + 6 de detalhes — pasta `vistoria_inicial`
2. ItemChecklistGrid (reutilizar do M4)
3. Observações gerais (`TextInput` multilinha)
4. "Concluir Vistoria" → sugere `VALID_TRANSITIONS` para `budget` via `useUpdateOSStatus`

### Tarefa 3 — Vistoria Final

Quando OS está em `final_survey`, mostrar "Iniciar Vistoria de Saída" no detalhe.

Nova tela: `app/(app)/vistoria/saida/[osId].tsx`
1. Comparativo antes/depois: fotos da `vistoria_inicial` ao lado de slots para captura
   - Layout side-by-side ou swipe (react-native-reanimated)
   - Novas fotos vão para pasta `vistoria_final`
2. Checklist reduzido: confirmar reparos (checkboxes simples)
3. Observações finais
4. "Concluir Vistoria Final" → sugere transição para `ready`

### Tarefa 4 — Push Notifications

**Mobile:**
- Configurar `expo-notifications` (já disponível no Expo SDK)
- Solicitar permissão no pós-login
- Registrar Expo Push Token no backend: `PATCH /api/v1/users/push-token/`
- Listener local para notificações em foreground

**Backend (`backend/core/apps/`):**
- Novo campo `push_token` (`CharField`, nullable) no `GlobalUser`
- Nova action em `UsersViewSet` (ou endpoint dedicado) para salvar o token
- Celery task `task_send_push_notification(tenant_schema, token, title, body)`:
  ```python
  # POST https://exp.host/--/api/v2/push/send
  # { "to": token, "title": title, "body": body }
  ```
- Disparar a task no `ServiceOrderViewSet` ao mudar status

---

## Ordem de Execução

1. **Fotos de acompanhamento** — menor risco, reutiliza infra existente
2. **Vistoria inicial** — fluxo novo com peças reutilizáveis
3. **Vistoria final** — comparativo antes/depois
4. **Push notifications** — backend + mobile

---

## Padrões Obrigatórios

**Mobile:**
- TypeScript strict — sem `any`, sem `as Type`
- `StyleSheet.create` para todos os estilos
- `React.memo` em componentes de lista
- Offline-first: toda escrita vai ao WatermelonDB antes de tentar API
- Cores DS Car: vermelho `#e31b1b`, dark `#141414`, fundo `#f9fafb`

**Backend:**
- Type hints obrigatórios em funções e métodos
- `select_related`/`prefetch_related` obrigatórios quando há relações
- `logger = logging.getLogger(__name__)` — nunca `print()`
- Celery task sempre recebe `tenant_schema` como parâmetro
- `Black` + `isort` antes de commitar

**Commits:** Conventional Commits — `feat(mobile): ...` / `feat(backend): ...`

---

## Como Rodar

```bash
# Mobile
cd apps/mobile && npx expo start --clear   # Expo Go no simulador iOS

# Backend
make dev          # sobe Django + Redis + PostgreSQL
make migrate      # se houver novas migrations
```
