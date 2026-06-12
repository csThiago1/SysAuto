# Wizard de Transição de Status da OS — Design

**Data:** 2026-06-12
**Autor:** Thiago Campos (brainstorm guiado com Claude Code)
**Status:** Spec aprovado, aguardando plano de implementação

---

## 1. Visão geral

### Problema
O mobile foi removido temporariamente do escopo. Sem ele, os usuários da DS Car (consultor, mecânico, gerente) precisam **completar pendências de cada transição de status da OS direto no web** — antes era papel do app: fotos com câmera + watermark, apontamentos de horas, assinaturas digitais. O sistema atual já valida pré-requisitos (`TransitionValidator` no backend, `TransitionRequirementsPanel` no frontend), mas a UI só **lista** o que falta — não ajuda a resolver.

### Objetivo
Construir um **modal-wizard** que abre quando o usuário tenta avançar uma OS para um status que tem pendências, guiando-o a resolvê-las inline (formulários, uploads, canvas de assinatura) com opção de delegar pra abas dedicadas quando for fluxo longo. Quando tudo for resolvido, um banner verde com botão grande confirma a transição.

### Fora de escopo (V1)
- Painel persistente de pendências fora do fluxo de transição (rejeitado em favor do escopo "estrito à transição").
- Indicador visual no card do Kanban (rejeitado em favor de card limpo — pendência só aparece no momento da ação).
- Watermark client-side (será aplicado no backend após upload, mantendo o fluxo atual do `useUploadPhoto`).
- Assinatura digital em pad de tablet conectado por USB (V1 usa canvas com mouse/touch).
- Aba dedicada de apontamentos no detalhe da OS (V1 resolve dentro do wizard; aba opcional em V2).

### Critérios de sucesso
1. Usuário consegue avançar uma OS com 3 pendências (1 hard + 2 soft) **sem sair do modal**.
2. Caminho feliz (sem pendências) continua transicionando direto, sem clique extra.
3. Gerente continua podendo liberar soft blocks via "Gerente presente" (credenciais) ou "Aprovação remota" (`/override-request/`).
4. Backend não muda — wizard consome o mesmo `transition_requirements` e os mesmos hooks (`useTransitionWithValidation`, `useRequestOverride`).
5. Suporta os 11 códigos que o mobile já mandava (V1) + fallback automático pra códigos novos.

---

## 2. Decisões consolidadas (brainstorming 2026-06-12)

| Pergunta | Escolha |
|---|---|
| Escopo do wizard | **A — Estrito à transição** (não é painel persistente) |
| Trigger | **B — Abre só quando `can_proceed === false`** |
| Layout do modal | **A — Modal centralizado** com forms inline + opção "Tela completa" por item |
| Captura de fotos | **A — `<input type="file" multiple accept="image/*">`** (iOS/Android disparam câmera nativa) |
| Indicador no Kanban | **D — Sem indicador** no card; pendência só revelada ao tentar mover |
| Drop no Kanban com pendência | **B — Card volta + wizard abre direto** (rollback otimista) |
| Confirmação final | **C — Banner verde "Pronto pra avançar"** com botão grande no footer |
| Override do gerente | **Reaproveita** os 2 sub-modais já existentes (motivo + credenciais) |

---

## 3. Fluxos de usuário

### 3.1 Caminho feliz (sem pendência) — comportamento atual, intocado
1. Usuário clica "Avançar Status" no header do `ServiceOrderForm` ou arrasta card no Kanban.
2. `order.transition_requirements[target].can_proceed === true`.
3. Frontend chama `POST /service-orders/:id/transition/` com `{ new_status: target }`.
4. Toast "Status atualizado". Sem modal.

### 3.2 Caminho com pendência (foco do wizard)
1. Mesmo trigger acima.
2. `can_proceed === false` (tem `hard_blocks` e/ou `soft_blocks`).
3. Frontend abre `<TransitionWizard target={target} order={order} onClose={...} />`.
4. Modal mostra checklist agrupada por severidade:
   - **Hard blocks** (vermelho ✕) — impedem transição
   - **Soft blocks** (amarelo 🔒) — podem ser superados via override do gerente
   - **Warnings** (cinza ⚠) — opcionais, não bloqueiam
5. Cada item tem:
   - Botão **"Resolver aqui"** (default) → expande `<Resolver>` apropriado pra aquele code, em form inline.
   - Botão secundário **"Abrir tela completa"** → navega pra rota dedicada (`/os/[numero]?tab=files`, etc).
6. Conforme cada item é resolvido, `onResolved(code)` é chamado. `useWizard` marca como verde otimisticamente; refetch confirma com o backend.
7. Quando **todos hard + soft** estão verdes, footer transforma em banner verde com botão grande "Avançar pra X".
8. Click → `POST /transition/` → modal fecha → toast success → OS avança.

### 3.3 Caminho de override do gerente (soft blocks)
1. Sempre que houver ≥ 1 soft block na lista, footer mostra link discreto **"🔓 Solicitar liberação do gerente"**.
2. Click abre `<OverrideRequestModal>`:
   - Textarea para o motivo (obrigatório).
   - Dois botões: **"Gerente presente"** e **"Aprovação remota"**.
3. **Gerente presente:**
   - Abre `<ManagerCredentialsModal>` (email + senha).
   - `POST /transition/` com `{ new_status, force: true, manager_email, manager_password, justification }`.
   - Backend valida + transiciona.
   - Wizard fecha, toast success.
4. **Aprovação remota:**
   - `POST /service-orders/:id/override-request/` com `{ target_status, reason }`.
   - Wizard substitui a checklist por "⏳ Aguardando aprovação do gerente".
   - User fecha o wizard.
   - Quando gerente aprova no painel `/pending-overrides`, a transição executa server-side.
   - `usePendingOverrides` (polling 30s) ou a próxima abertura da OS reflete o novo status.

### 3.4 Kanban — drop com pendência
1. Usuário arrasta card de `repair` pra `final_survey`.
2. `handleDragEnd` verifica `order.transition_requirements[final_survey].can_proceed`.
3. Se `false`:
   - **Rollback otimista**: card volta pra coluna `repair` visualmente.
   - Abre `<TransitionWizard target="final_survey" order={order} />`.
4. Se `true`: comportamento atual (POST transition, atualiza otimisticamente).

---

## 4. Mapping dos códigos de bloqueio (V1)

Cada `ValidationBlock.code` recebido do backend mapeia para um componente resolver via `resolvers/index.ts`.

| Code | Categoria | Resolver inline | "Tela completa" navega para |
|---|---|---|---|
| `VEHICLE_BASIC_DATA` | Dados | Inputs placa + marca + modelo, `PATCH /service-orders/:id/` | Aba *Abertura* → Veículo |
| `CUSTOMER_TYPE_SET` | Dados | Toggle Particular/Seguradora, `PATCH` | Aba *Abertura* → barra de tipo |
| `MILEAGE_OUT` | Dados | Input numérico KM saída, `PATCH` | Aba *Fechamento* |
| `PHOTOS_MIN_12` | Foto | `<input type="file" multiple>`, upload pra `folder=vistoria_entrada`, contador "X de 12" | Aba *Arquivos* → pasta Vistoria Entrada |
| `FINAL_PHOTOS_12` | Foto | Idem, `folder=vistoria_saida` | Aba *Arquivos* → pasta Vistoria Saída |
| `PROGRESS_PHOTO` | Foto | Input file simples, `folder=acompanhamento` | Aba *Arquivos* → pasta Acompanhamento |
| `CLIENT_SIGNATURE` | Assinatura | `<SignatureCanvas>` + link "Enviar pra cliente assinar no celular" | Aba *Fechamento* → Assinaturas |
| `SIGNATURE_APPROVAL` | Assinatura | Botão "Confirmar com minha assinatura" (usa a salva no cadastro do funcionário) | — |
| `BUDGET_PDF_INSURER` | Arquivo | `<input type="file" accept="application/pdf">`, `folder=orcamentos` | Aba *Orçamento Seguradora* |
| `EXIT_CHECKLIST` | Form | Checklist de saída embutido (acessórios, danos, etc) | Aba *Fechamento* → checklist |
| `TIMESHEET_CLOSED` | Apontamento | Lista apontamentos em aberto da OS, botão "Encerrar todos" ou "Encerrar selecionados" (consome `GET /service-orders/:id/apontamentos/` + `POST /:apontamento_id/encerrar/`) | — (não há tela dedicada no web hoje — ver open question 5) |

### Fallback para codes desconhecidos
- Item aparece com ícone + mensagem do backend.
- Botão "Resolver aqui" **desabilitado**, com texto explicativo "resolva via outras telas e volte aqui".
- Override do gerente continua disponível (se for soft).
- Evita travar a UI quando o backend evolui antes do frontend.

---

## 5. Arquitetura de componentes

### 5.1 Estrutura de pastas

```
apps/dscar-web/src/components/transition-wizard/
├── TransitionWizard.tsx           # modal principal (orquestra estado, abre sub-modais)
├── WizardChecklist.tsx            # lista, agrupa por severidade (hard/soft/warn)
├── WizardItem.tsx                 # 1 item: ícone + texto + ações + form expansível
├── WizardFooter.tsx               # texto neutro OU banner verde + botão; link override
├── OverrideRequestModal.tsx       # extraído do TransitionRequirementsPanel
├── ManagerCredentialsModal.tsx    # extraído do TransitionRequirementsPanel
├── useWizard.ts                   # Set<code> resolvidos otimisticamente + flags de UI
└── resolvers/
    ├── index.ts                   # CODE_TO_RESOLVER: Record<string, ResolverComponent>
    ├── DataResolver.tsx           # VEHICLE_BASIC_DATA, CUSTOMER_TYPE_SET, MILEAGE_OUT
    ├── PhotoResolver.tsx          # PHOTOS_MIN_12, FINAL_PHOTOS_12, PROGRESS_PHOTO
    ├── SignatureResolver.tsx      # CLIENT_SIGNATURE, SIGNATURE_APPROVAL
    ├── FileResolver.tsx           # BUDGET_PDF_INSURER
    ├── ChecklistResolver.tsx      # EXIT_CHECKLIST
    ├── TimesheetResolver.tsx      # TIMESHEET_CLOSED
    └── FallbackResolver.tsx       # qualquer code não mapeado
```

### 5.2 Componentes reaproveitados (sem mudanças)
- `src/components/ui/SignatureCanvas.tsx` (mobile já usa — port pra web se ainda não estiver compartilhado).
- `src/hooks/useTransitionValidation.ts` (`useTransitionWithValidation`, `useRequestOverride`, `usePendingOverrides`).
- `src/app/(app)/os/[numero]/_hooks/useServiceOrder.ts` (`useServiceOrderUpdate`).
- `src/app/(app)/os/[numero]/_hooks/useOSItems.ts` (`useUploadPhoto`).

### 5.3 Mudanças cirúrgicas em arquivos existentes

**`src/app/(app)/os/[numero]/_components/ServiceOrderForm.tsx`**
- Função `handleTransition(target)` ganha branch:
  - Se `order.transition_requirements[target]?.can_proceed === true` → chama `transitionMutation.mutateAsync(target)` (comportamento atual).
  - Senão → `setWizardTarget(target)` (state que controla abertura do `<TransitionWizard>`).
- Adiciona render condicional do `<TransitionWizard>` no nível do form.

**`src/components/kanban/KanbanBoard.tsx`**
- No `handleDragEnd`, antes do `apiFetch(/transition/)`:
  - Verifica `order.transition_requirements[newStatus]?.can_proceed`.
  - Se `false`: faz rollback otimista (não move o card), abre `<TransitionWizard target={newStatus} order={order} />` via state local.
  - Se `true`: comportamento atual.

### 5.4 Componente aposentado
- `src/app/(app)/os/[numero]/_components/TransitionRequirementsPanel.tsx` — substituído pelo wizard. Os dois sub-modais são extraídos antes da remoção.

### 5.5 Princípio chave
**Cada resolver é uma caixa-preta com a mesma interface:**

```ts
interface ResolverProps {
  block: ValidationBlock;        // { code, message }
  order: ServiceOrder;           // contexto da OS
  onResolved: (code: string) => void;  // callback otimista
}
```

Adicionar suporte a um novo code = criar 1 componente + adicionar 1 linha em `resolvers/index.ts`. Nenhuma mudança no Wizard, no Footer ou em qualquer outro lugar.

---

## 6. Data flow

### 6.1 Origem dos `transition_requirements`
Já vem hoje em `order.transition_requirements: Record<ServiceOrderStatus, ValidationResult>` no `ServiceOrderDetailSerializer`. Cache backend de 60s com key incluindo `updated_at` (invalidado automaticamente quando a OS muda).

### 6.2 Resolver → invalidate → refetch
1. Resolver chama hook (ex: `useUploadPhoto.mutate(file)`).
2. `onSuccess` do hook chama `queryClient.invalidateQueries(["service-orders", id])`.
3. Refetch automático de `useServiceOrder(id)`.
4. Backend retorna `order` com `transition_requirements` atualizado.
5. `<TransitionWizard>` re-renderiza com lista nova.

### 6.3 Estado otimista (`useWizard`)
- Hook mantém um `Set<BlockCode>` de items resolvidos nessa sessão.
- Resolver chama `onResolved(code)` imediatamente após `mutateAsync` succeed (antes do refetch).
- Item fica verde na hora — UX percebido instantâneo.
- Quando refetch confirma, backend e local estão sincronizados.
- Reset do Set ao fechar/reabrir o wizard.

### 6.4 Transição final
- Banner aparece quando `resolvedSet ∪ backendResolved cobre todos os hard+soft`.
- Click no botão "Avançar pra X" → `useTransitionWithValidation.mutate({ new_status: target })`.
- **200 OK** → modal fecha → toast success → `invalidateQueries(["service-orders"])` atualiza kanban + lista.
- **422 com novos blocks** (race condition) → wizard repopula com response → toast "Algo mudou, revisa os itens".

### 6.5 Override remoto — sincronização
- `usePendingOverrides` já existe com `refetchInterval: 30000`.
- Quando gerente aprova no painel `/pending-overrides`, a transição executa server-side.
- Cache da OS é invalidado no próximo refetch (até 30s).
- V2 (fora do escopo): notificação via WebSocket pra feedback instantâneo.

### 6.6 Edge cases mapeados
| Caso | Comportamento |
|---|---|
| Resolver falha (rede/validação) | Try/catch local, toast vermelho no item, mantém pendente, não afeta outros |
| User fecha wizard no meio | Items resolvidos persistem no backend; Set otimista perdido; reabertura puxa lista atualizada |
| 2 usuários no mesmo OS | Cache backend de 60s pode ter delay; race no transition retorna 422 com novos blocks |
| Code desconhecido | `FallbackResolver` mostra item sem botão; override continua disponível |

---

## 7. Estratégia de migração (5 fases, cada uma deployable sozinha)

| Fase | Conteúdo | Risco | Cobertura de codes |
|---|---|---|---|
| **1. Refactor** | Extrai `OverrideRequestModal` + `ManagerCredentialsModal` do `TransitionRequirementsPanel.tsx` pra arquivos próprios. Zero mudança visual. | Mínimo | — |
| **2. Wizard mínimo** | Cria casca do `TransitionWizard` + `WizardItem` + `WizardFooter` + `FallbackResolver` + `DataResolver`. Conecta no `ServiceOrderForm` + `KanbanBoard`. `TransitionRequirementsPanel` continua vivo em paralelo. | Médio | `VEHICLE_BASIC_DATA`, `CUSTOMER_TYPE_SET`, `MILEAGE_OUT` |
| **3. Foto + assinatura** | `PhotoResolver` + `SignatureResolver`. | Médio-alto (uploads, canvas) | Adiciona 5 codes |
| **4. Resolvers menores** | `TimesheetResolver` + `ChecklistResolver` + `FileResolver`. | Baixo | Adiciona 3 codes |
| **5. Cleanup** | Deleta `TransitionRequirementsPanel.tsx`. PR de remoção. | Mínimo | — |

---

## 8. Estratégia de testes

### 8.1 Unit (vitest + testing-library)
- Cada resolver isolado: mock do hook, simula `onResolved`, verifica payload correto.
- `resolvers/index.ts` map: code conhecido retorna componente certo; code desconhecido retorna `FallbackResolver`.
- `useWizard`: marca como resolvido otimisticamente, refetch reconcilia, fechar zera o Set.

### 8.2 Integration (testing-library)
- Wizard com 3 blocks (1 hard + 2 soft): resolve todos → footer vira banner → click avança.
- Wizard com 1 hard sem resolver: `FallbackResolver` desabilitado, override funciona.
- Override do gerente — caminho presente: modal motivo → credenciais → mutate com `force: true` → success.
- Override do gerente — caminho remoto: mutate `/override-request/` → modal mostra "aguardando" → fechar.
- Race condition — 422 ao avançar: wizard repopula lista, toast.
- Kanban drag com pendência: rollback otimista + wizard abre com target = coluna alvo.

### 8.3 E2E (Playwright, contra staging)
- Smoke test do caminho feliz: login → abrir OS sem pendências → avançar → status mudou.
- Wizard completo: login → abrir OS com `VEHICLE_BASIC_DATA` → wizard abre → preenche → confirma → transição executada.

### 8.4 Débito técnico identificado
- Setup do vitest está quebrado em produção (`@testing-library/dom` não resolve). **Fix obrigatório antes do PR 1.**
- `eslint-config-next` aponta pra Next 15 mas projeto está em Next 16 — fix paralelo a este projeto.

---

## 9. Open questions (a confirmar antes da implementação)

1. **`SignatureCanvas`** — está em `apps/mobile/` (React Native) ou já existe versão web em `packages/ui/`? Se for só mobile, vamos portar pra `apps/dscar-web/src/components/ui/SignatureCanvas.tsx`.
2. **"Tela completa"** das fotos — preferimos navegar pra `/os/[numero]?tab=files` (mesma página, troca de tab) ou rota dedicada `/os/[numero]/arquivos`? A primeira preserva contexto e estado do form.
3. **Watermark** — backend já aplica nas fotos uploadadas via mobile? Se sim, mesma rota; se não, fica como débito separado.
4. **`SIGNATURE_APPROVAL`** — onde está armazenada a assinatura do funcionário hoje no backend? `Employee.signature_url`? Confirmar campo antes de implementar.
5. **Apontamento de horas no web** — não existe interface dedicada (só mobile). O `TimesheetResolver` vai ser **a primeira UI web pra apontamento**. Decisão: implementar listagem + ação "encerrar" mínima dentro do wizard agora, e em V2 fazer uma aba dedicada `/os/[numero]?tab=apontamentos` se for necessário. Vai exigir tipos `Apontamento` em `@paddock/types` (mobile já tem).

---

## 10. Apêndices

### 10.1 Referências
- Brainstorming visual: `.superpowers/brainstorm/99436-1781278055/content/` (7 telas: stepbystep-v2, codes-mapping, architecture, data-flow, migration-tests)
- Componente existente: `apps/dscar-web/src/app/(app)/os/[numero]/_components/TransitionRequirementsPanel.tsx`
- Backend validator: `backend/core/apps/service_orders/transition_validator.py`
- Mobile resolver (referência): `apps/mobile/app/(app)/os/resolver/[osId].tsx`
- Hooks reaproveitados: `apps/dscar-web/src/hooks/useTransitionValidation.ts`

### 10.2 Tabela de status da OS
17 status com transições definidas em `packages/types/`: `reception → initial_survey → budget → waiting_auth → authorized → waiting_parts → repair → mechanic → bodywork → painting → assembly → polishing → washing → final_survey → ready → delivered`, mais `cancelled` terminal.
