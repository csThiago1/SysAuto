# Wizard de Resolucao de Pendencias — Spec

**Data:** 2026-05-11
**Escopo:** Mobile (React Native / Expo Router)
**Dependencias backend:** Nenhuma — usa endpoints existentes

---

## Problema

O usuario tenta avancar o status de uma OS e descobre que tem pendencias (fotos, dados do cliente, checklist). O `TransitionRequirementsSheet` atual lista os bloqueios com botoes que navegam para telas separadas. O usuario se perde entre camera, formulario de edicao e checklist, sem saber se ja resolveu tudo. Nao ha uma experiencia guiada para completar os requisitos.

## Solucao

Uma tela full-screen "Resolver Pendencias" que funciona como checklist interativo. O usuario ve todos os itens pendentes, resolve cada um inline ou via navegacao (camera, checklist), e ao retornar a tela revalida automaticamente. Quando tudo esta completo, o botao "Avancar" habilita.

---

## Arquitetura

### Fluxo do usuario

```
GeneralTab: [Avancar Status]
  -> StatusUpdateModal (escolhe status destino)
  -> Busca validation = order.transition_requirements[target]
  -> Se tem hard_blocks ou soft_blocks:
      -> router.push('/(app)/os/resolver/[osId]?target=<status>')
  -> Se validation.can_proceed e sem bloqueios:
      -> Executa transicao direto (comportamento atual mantido)
```

### Ponto de integracao

A mudanca acontece no `os/[id].tsx`, no callback `handleSelectStatus`. Hoje ele abre o `TransitionRequirementsSheet`. O novo fluxo:

1. Se `can_proceed` e sem hard/soft blocks -> transicao direta (como hoje)
2. Se tem bloqueios -> navega para tela de resolucao em vez de abrir o sheet
3. O `TransitionRequirementsSheet` continua existindo como fallback e para o fluxo de override com credenciais de gerente

---

## Componentes

### 1. Tela `app/(app)/os/resolver/[osId].tsx`

Nova rota full-screen dentro do Stack (sem tab, `href: null` no layout).

**Props via search params:**
- `osId` — ID da OS
- `target` — status destino (ex: `initial_survey`)

**Comportamento:**
- No mount, busca detalhe da OS via `useServiceOrder(osId)` para obter `transition_requirements[target]`
- Renderiza header com: botao voltar, "OS #N", status destino
- Lista de `ResolutionItem` para cada bloco (hard primeiro, depois soft, depois warnings)
- Itens ja resolvidos (nao presentes nos bloqueios) aparecem com check verde
- Pull-to-refresh chama `refetch()` que revalida as pendencias
- Auto-revalida ao retornar de navegacao (camera, checklist) via `useFocusEffect`
- Botao fixo no rodape: "Avancar para [Status]"
  - Desabilitado enquanto tem hard_blocks
  - Se so tem soft_blocks: texto muda para "Solicitar Liberacao"

**Secoes da tela:**
```
[Header: <- OS #6  |  Vistoria Inicial]

OBRIGATORIO (hard_blocks)
  [x] Placa informada                     (resolvido)
  [x] Marca/modelo preenchidos            (resolvido)
  [ ] Tipo de cliente definido            [Definir]
  [ ] Cliente vinculado                   [Vincular]

REQUER APROVACAO (soft_blocks)
  [ ] 12 fotos de vistoria               [Abrir camera]

RECOMENDADO (warnings)
  [ ] Ano do veiculo                      [Preencher]
  [ ] Cor do veiculo                      [Preencher]

──────────────────────────────────────────
[  Avancar para Vistoria Inicial  ]  (desabilitado)
```

### 2. Componente `ResolutionItem`

Cada pendencia no checklist.

**Props:**
```typescript
interface ResolutionItemProps {
  block: ValidationBlock;
  type: 'hard' | 'soft' | 'warn';
  resolved: boolean;
  onAction: () => void;
  actionLabel: string;
  actionIcon: keyof typeof Ionicons.glyphMap;
}
```

**Visual:**
- Icone esquerdo: check verde (resolvido) ou circulo vazio (pendente) ou cadeado amarelo (soft)
- Texto da mensagem (do `block.message`)
- Botao de acao a direita (chip com label + seta)
- Fundo sutil: verde quando resolvido, transparente quando pendente

**Tipos de acao por codigo:**

| Codigo | Tipo de acao | Comportamento |
|--------|-------------|---------------|
| `VEHICLE_BASIC_DATA` | Inline expandivel | Expande campos: placa, marca, modelo inline |
| `CUSTOMER_TYPE_SET` | Inline expandivel | Dropdown: Seguradora / Particular |
| `CUSTOMER_LINKED` | Inline expandivel | Campo de busca/selecao de cliente |
| `INSURER_DATA` | Inline expandivel | Campo de selecao de seguradora |
| `MILEAGE_OUT` | Inline expandivel | Campo numerico de km |
| `PHOTOS_MIN_12` | Navegacao | `router.push('/(app)/vistoria/entrada/[osId]')` |
| `FINAL_PHOTOS_12` | Navegacao | `router.push('/(app)/vistoria/saida/[osId]')` |
| `PROGRESS_PHOTO` | Navegacao | `router.push('/(app)/camera')` com params |
| `EXIT_CHECKLIST` | Navegacao | `router.push('/(app)/checklist/[osId]')` |
| `BUDGET_PDF_INSURER` | Navegacao | `router.push('/(app)/camera')` com params |
| `CLIENT_SIGNATURE` | Modal inline | Abre `SignatureCanvas` em modal na propria tela |
| `SIGNATURE_APPROVAL` | Modal inline | Abre `SignatureCanvas` em modal na propria tela |
| `PARTS_EXIST` | Navegacao | `router.back()` + seta para aba Pecas |
| `BUDGET_ITEMS_PRIVATE` | Navegacao | `router.back()` + seta para aba Pecas |
| `PARTS_OR_LABOR_EXIST` | Navegacao | `router.back()` + seta para aba Pecas |

### 3. Componente `InlineField`

Para itens com acao inline (dados do veiculo, tipo de cliente, km).

**Comportamento:**
- Estado colapsado: mostra o item como pendente com botao "Preencher"
- Estado expandido: mostra campo(s) de input com botao "Salvar"
- Ao salvar: chama PATCH na API da OS, revalida pendencias
- Feedback: toast de sucesso, item marca como resolvido

**Campos por codigo:**

| Codigo | Campos | Endpoint |
|--------|--------|----------|
| `VEHICLE_BASIC_DATA` | placa (text), marca (text), modelo (text) | `PATCH /service-orders/{id}/` |
| `CUSTOMER_TYPE_SET` | customer_type (picker: insurer/private) | `PATCH /service-orders/{id}/` |
| `CUSTOMER_LINKED` | customer (search/select) | `PATCH /service-orders/{id}/` |
| `INSURER_DATA` | insurer (picker), casualty_number (text) | `PATCH /service-orders/{id}/` |
| `MILEAGE_OUT` | mileage_out (numeric) | `PATCH /service-orders/{id}/` |

### 4. Secao de Soft Blocks (override)

Quando existem soft_blocks:
- Aparecem na secao "REQUER APROVACAO"
- Cada item tem icone de cadeado amarelo
- Botao principal muda de "Avancar" para "Solicitar Liberacao"
- Ao clicar, abre modal de override (reutiliza logica existente do `TransitionRequirementsSheet` modos override/manager)
- Se `has_pending_override`, mostra banner "Aguardando aprovacao do gerente"

---

## Revalidacao automatica

A tela precisa saber quando pendencias foram resolvidas:

1. **`useFocusEffect`** — ao retornar de camera/checklist/vistoria, chama `refetch()` no hook de detalhe da OS
2. **Pull-to-refresh** — usuario pode puxar manualmente
3. **Apos salvar inline** — PATCH retorna OS atualizada, invalida query cache

O backend recalcula `transition_requirements` em cada GET do detalhe da OS, entao qualquer `refetch()` traz os bloqueios atualizados.

---

## Integracao com GeneralTab

Na `GeneralTab`, a secao de pendencias tambem aparece como preview:

```
PARA AVANCAR
  3 pendencias para Vistoria Inicial
  [Resolver pendencias ->]
```

Essa secao:
- So aparece se existem hard_blocks ou soft_blocks para o proximo status valido
- O proximo status e determinado pelo primeiro item de `VALID_TRANSITIONS[currentStatus]`
- Toque no botao navega para a mesma tela de resolucao
- Se nao tem pendencias, nao mostra nada (botao "Avancar Status" ja basta)

---

## Registros de rota

No `app/(app)/_layout.tsx`, adicionar:
```tsx
<Tabs.Screen name="os/resolver" options={{ href: null }} />
```

No `app/(app)/os/_layout.tsx`, adicionar:
```tsx
<Stack.Screen name="resolver/[osId]" options={{ headerShown: false }} />
```

Criar a pasta `app/(app)/os/resolver/[osId].tsx`.

---

## Estrutura de arquivos

```
app/(app)/os/resolver/[osId].tsx          <- Tela principal do wizard
src/components/os/ResolutionItem.tsx       <- Item individual do checklist
src/components/os/InlineField.tsx          <- Campos expandiveis inline
src/components/os/PendingRequirements.tsx  <- Secao "Para avancar" na GeneralTab
```

---

## O que NAO muda

- **StatusUpdateModal** — continua igual (selecao de status destino)
- **TransitionRequirementsSheet** — mantido como componente, usado apenas para o fluxo de override (credenciais de gerente)
- **Backend** — nenhum endpoint novo; usa GET detalhe da OS (`transition_requirements`), PATCH para edicao, POST transition para avancar
- **Camera, Vistoria, Checklist** — telas existentes nao mudam; o wizard apenas navega para elas

---

## Casos de borda

1. **OS sem pendencias** — transicao direta, wizard nao abre
2. **Todas pendencias resolvidas durante o wizard** — botao habilita automaticamente apos refetch
3. **Override pendente** — mostra banner informativo, desabilita botao ate aprovacao
4. **Offline** — dados do WatermelonDB podem estar desatualizados; ao tentar avancar, backend rejeita e retorna bloqueios atualizados via erro
5. **Usuario volta sem resolver tudo** — nenhum estado perdido, ao reabrir a tela revalida do zero
6. **Multiplas pendencias com mesmo label** (ex: 2x "Editar OS") — agrupa visualmente, cada um com seu codigo unico
