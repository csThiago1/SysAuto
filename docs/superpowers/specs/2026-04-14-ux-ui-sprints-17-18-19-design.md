# Sprints 17, 18 e 19 — UX/UI Improvements
**Data:** 2026-04-14
**Origem:** Revisão de 3 agentes (Playwright, UI Designer, UX Researcher)
**Escopo:** 30 itens organizados em 3 sprints temáticas
**Stack:** Next.js 15 · TypeScript strict · Tailwind CSS · shadcn/ui · React Hook Form

---

## Visão Geral

| Sprint | Tema | Itens | Dependências |
|--------|------|-------|--------------|
| Sprint 17 | Design System | 10 | Nenhuma — base para as demais |
| Sprint 18 | OS Workflow | 10 | Independente (alguns reutilizam ConfirmDialog da S17) |
| Sprint 19 | Agenda + Polimento | 10 | Independente |

As sprints 17, 18 e 19 são **totalmente independentes entre si** e podem rodar em paralelo. Dentro de cada sprint, há dependências pontuais documentadas na seção "Ordem de Execução".

---

## Sprint 17 — Design System

**Objetivo:** Unificar tokens de cor, tipografia, componentes de tabela/loading e utilitários compartilhados. Esta sprint elimina inconsistências visíveis em todas as telas simultaneamente.

**Agentes primários:** `refactoring-specialist`, `ui-designer`, `frontend-developer`
**Skills:** `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`

---

### S17-C1 · Unificar cor de marca `primary-600`

**Problema:** `primary-600` está definido como `#e31b1b` no `tailwind.config.ts` (linha 48), mas o vermelho real da DS Car (`#ea0e03`) está hardcoded em pelo menos 8 arquivos como `bg-[#ea0e03]`, `text-[#ea0e03]`, `border-[#ea0e03]`, `bg-[#ea0e03]/[0.12]`. As duas cores são visivelmente diferentes. Todo CTA primário na sidebar usa um vermelho diferente do CTA no conteúdo.

**Critério de aceitação:**
- `primary-600` no `tailwind.config.ts` alterado para `#ea0e03`
- `primary-700` ajustado proporcionalmente para `#c50b02` (hover state)
- Todos os `bg-[#ea0e03]`, `text-[#ea0e03]`, `border-[#ea0e03]`, `hover:bg-red-700`, `bg-red-600` substituídos por `bg-primary-600`, `text-primary-600`, `hover:bg-primary-700`
- As opacidades arbitrárias `bg-[#ea0e03]/[0.12]` e `bg-[#ea0e03]/[0.08]` substituídas por classes CSS var-backed
- `tsc --strict` sem erros · build sem warnings

**Arquivos afetados:**
```
apps/dscar-web/tailwind.config.ts                          ← alterar primary-600 e primary-700
apps/dscar-web/src/components/Sidebar.tsx                  ← 4 ocorrências
apps/dscar-web/src/app/(app)/service-orders/page.tsx       ← botão "Nova OS"
apps/dscar-web/src/app/(app)/agenda/_components/WeekView.tsx
apps/dscar-web/src/app/(app)/agenda/_components/DayView.tsx
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx
apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx
```

**Passos de implementação:**
1. Abrir `tailwind.config.ts`, alterar `"600": "#e31b1b"` → `"600": "#ea0e03"` e `"700": "#c01212"` → `"700": "#c50b02"`
2. Executar `grep -r "#ea0e03\|red-700\|red-600\|#e31b1b" apps/dscar-web/src --include="*.tsx" --include="*.ts" -l` para listar todos os arquivos
3. Em cada arquivo, substituir o valor hardcoded pela classe do token system
4. Para `bg-[#ea0e03]/[0.12]` no Sidebar (active state): substituir por `bg-primary-600/[0.12]`
5. Para `bg-[#ea0e03]/[0.08]` no Sidebar (child active): substituir por `bg-primary-600/[0.08]`
6. Rodar `npm run build` e verificar que não há warnings de cor
7. Inspecionar visualmente Sidebar, lista de OS, página de seguradoras e WeekView para confirmar vermelho uniforme

**Agente:** `refactoring-specialist`
**Skills:** `superpowers:verification-before-completion`
**Paralelismo:** Executar primeiro — desbloqueia limpeza de tokens em S17-B4

---

### S17-C2 · Labels de formulário: 9px → `text-xs` (12px)

**Problema:** A constant `LABEL` em múltiplos arquivos define `text-[9px]` — abaixo do mínimo WCAG 2.1 de 12px para corpo de texto. Operadores que usam o sistema por horas desenvolvem fadiga visual. A escala do design system já define `text-xs` como 12px com line-height de 1rem.

**Critério de aceitação:**
- Nenhuma ocorrência de `text-[9px]` ou `text-[10px]` em labels de campos de formulário
- Labels usam `text-xs` (12px) como mínimo
- Proporção visual dos formulários mantida (não quebrar layouts)
- `tsc --strict` sem erros

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/EntrySection.tsx
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/PrazosSection.tsx
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx
apps/dscar-web/src/app/(app)/service-orders/_components/NewOSDrawer.tsx
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/CustomerSection.tsx
apps/dscar-web/src/app/(app)/cadastros/seguradoras/_components/InsurerDialog.tsx (se existir)
```

**Passos de implementação:**
1. Executar `grep -r "text-\[9px\]\|text-\[10px\]" apps/dscar-web/src --include="*.tsx" -n` para listar todas as ocorrências
2. Para cada `LABEL` constant local, alterar de `text-[9px]` → `text-xs`
3. Para `text-[10px]` em section titles (ex: ServicesTab), alterar para `text-xs`
4. Verificar visualmente que os labels não excedem a largura do campo
5. Manter `uppercase tracking-widest` — apenas o tamanho muda
6. Verificar nas 5 telas principais que o layout não quebrou

**Agente:** `refactoring-specialist`
**Skills:** `superpowers:verification-before-completion`
**Paralelismo:** Independente — pode rodar em paralelo com S17-C1

---

### S17-C4 · `<ConfirmDialog>` reutilizável

**Problema:** Três arquivos usam `window.confirm()` nativo para ações destrutivas (deletar peça, serviço, seguradora). O dialog nativo bloqueia a thread principal, é inacessível ao design system, desaparece com hover sobre a janela em alguns browsers e é estilisticamente inconsistente com o resto do UI.

**Critério de aceitação:**
- Componente `<ConfirmDialog>` criado em `src/components/ui/confirm-dialog.tsx`
- Props: `open`, `onOpenChange`, `title`, `description`, `confirmLabel` (default: "Confirmar"), `confirmVariant` (default: "destructive"), `onConfirm`, `loading`
- Usa `<AlertDialog>` do shadcn/ui internamente
- Os 3 `confirm()` nativos substituídos pelo novo componente
- Nenhum `confirm()` ou `window.confirm()` restante em `apps/dscar-web/src`

**Arquivos afetados:**
```
apps/dscar-web/src/components/ui/confirm-dialog.tsx        ← novo arquivo
apps/dscar-web/src/components/ui/index.ts                  ← exportar ConfirmDialog
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx
apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx
```

**Passos de implementação:**
1. Verificar que `@/components/ui/alert-dialog` está disponível (shadcn AlertDialog)
2. Criar `confirm-dialog.tsx`:
```tsx
interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  confirmVariant?: "destructive" | "default"
  onConfirm: () => void
  loading?: boolean
}
```
3. Implementar usando `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`
4. Exportar em `src/components/ui/index.ts`
5. Em `PartsTab.tsx`: substituir `if (!confirm("Remover esta peça?"))` por estado `confirmDeleteId` + `<ConfirmDialog>`
6. Em `ServicesTab.tsx`: mesmo padrão
7. Em `seguradoras/page.tsx`: mesmo padrão para delete de seguradora
8. Verificar que `deleteMutation.mutateAsync` em `PartsTab.tsx` tem `try/catch` (atualmente não tem — adicionar)

**Agente:** `ui-designer`
**Skills:** `superpowers:test-driven-development`
**Paralelismo:** Independente — os `confirm()` a substituir estão todos dentro da própria Sprint 17 (PartsTab, ServicesTab, seguradoras)

---

### S17-A2 · Fix `brand_color` double registration no InsurerDialog

**Problema:** Em `InsurerDialog.tsx`, tanto o `<input type="color">` quanto o `<Input>` de texto chamam `{...register("brand_color")}`. No react-hook-form, quando dois inputs registram o mesmo field name, o último DOM update vence — causando dessincronização: editar o color picker não atualiza o text field e vice-versa.

**Critério de aceitação:**
- Color picker e text input sempre mostram o mesmo valor
- Editar o color picker atualiza o text input em tempo real (debounce aceitável)
- Editar o text input atualiza o color picker quando o hex é válido (formato `#rrggbb`)
- Valor inválido no text input não quebra o formulário

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/cadastros/seguradoras/_components/InsurerDialog.tsx
```

**Passos de implementação:**
1. Substituir a dupla `register("brand_color")` por uma abordagem com `Controller` ou `watch`+`setValue`:
```tsx
const brandColor = watch("brand_color") ?? "#6b7280"

// Color picker:
<input
  type="color"
  value={brandColor}
  onChange={(e) => setValue("brand_color", e.target.value, { shouldValidate: true })}
/>

// Text input:
<Input
  value={brandColor}
  onChange={(e) => {
    const val = e.target.value
    setValue("brand_color", val, { shouldValidate: true })
  }}
/>
```
2. Adicionar validação Zod no schema: `brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()`
3. Testar: mudar color picker → text atualiza; digitar hex válido → picker atualiza; digitar hex inválido → campo marcado como inválido mas não quebra

**Agente:** `frontend-developer`
**Skills:** `superpowers:verification-before-completion`
**Paralelismo:** Independente

---

### S17-A3 · Corrigir BillingByTypeChart

**Problema:** O componente `BillingByTypeChart` exibe uma única barra azul de total por mês, mas a legenda mostra "Seguradora X%" e "Particular Y%" — implicando um split que não existe no gráfico. Isso é enganoso para o gerente que toma decisões baseado nessa visualização.

**Critério de aceitação:**
- **Opção A (preferred):** Barras agrupadas ou stacked por `seguradora` vs `particular` por mês — se a API retorna esse breakdown
- **Opção B (fallback):** Se a API só retorna total, remover a legenda split e mostrar legenda de "Faturamento Total"
- Verificar o endpoint `/api/proxy/service-orders/dashboard-stats/` ou equivalente para ver se o breakdown existe
- Nenhuma informação enganosa na tela

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/dashboard/_components/BillingByTypeChart.tsx (verificar nome exato)
apps/dscar-web/src/hooks/useDashboard.ts (verificar se retorna breakdown)
```

**Passos de implementação:**
1. Ler o componente de chart e o hook de dashboard para entender os dados recebidos
2. Se a API já retorna `billing_by_insurer` e `billing_by_particular` por mês: implementar `BarChart` com duas `Bar` (stacked ou grouped), removendo a legenda hardcoded
3. Se a API não retorna breakdown: remover a legenda split, mostrar apenas legenda "Faturamento Mensal" com cor `primary-600`
4. Adicionar tooltip no chart mostrando valor exato ao hover
5. Verificar build e tipagem

**Agente:** `frontend-developer`
**Skills:** `superpowers:verification-before-completion`
**Paralelismo:** Independente

---

### S17-A5 · Padronizar todas as tabelas para shadcn `<Table>`

**Problema:** O projeto tem dois padrões de tabela convivendo: `ServiceOrderTable` usa os componentes shadcn `<Table>/<TableHeader>/<TableRow>/<TableCell>`, enquanto `PartsTab`, `ServicesTab`, `TeamProductivityTable` e `seguradoras/page` usam `<table>` raw com estilos inline diferentes. Usuários que transitam entre a lista de OS e o detalhe de OS percebem mudança de estética.

**Critério de aceitação:**
- Todas as tabelas usam os componentes de `src/components/ui/table.tsx`
- Header styles unificados: mesma cor, tamanho de fonte e border
- Row hover states idênticos
- Sem regressão funcional (sort, click, delete inline)

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx
apps/dscar-web/src/app/(app)/dashboard/_components/TeamProductivityTable.tsx
apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx
```

**Passos de implementação:**
1. Ler `src/components/ui/table.tsx` para entender a API dos componentes
2. Para cada arquivo: substituir `<table>` → `<Table>`, `<thead>` → `<TableHeader>`, `<tr>` → `<TableRow>`, `<th>` → `<TableHead>`, `<tbody>` → `<TableBody>`, `<td>` → `<TableCell>`
3. Manter toda a lógica de negócio intacta — apenas substituir a estrutura HTML
4. Remover estilos inline que duplicam o que o shadcn já aplica (border, hover, etc.)
5. Verificar que `PartsTab` e `ServicesTab` ainda renderizam os botões de ação corretamente

**Agente:** `refactoring-specialist`
**Skills:** `superpowers:verification-before-completion`
**Paralelismo:** Independente — pode rodar em paralelo com S17-C1 e S17-C2

---

### S17-A6 · Padronizar loading states com `<TableSkeleton>`

**Problema:** Três padrões de loading coexistem:
1. `service-orders/page.tsx` → `<TableSkeleton>` (correto)
2. `PartsTab.tsx` → `<Loader2 className="animate-spin">` (diferente)
3. `seguradoras/page.tsx` → `<div>Carregando...</div>` (texto puro)

**Critério de aceitação:**
- Todas as telas com tabela usam `<TableSkeleton>` durante loading
- Telas sem tabela (ex: formulários) podem manter `<Loader2>` ou usar um `<FormSkeleton>` se necessário
- O skeleton da lista de OS (referência visual) é o padrão

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx
apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx
```

**Passos de implementação:**
1. Localizar `<TableSkeleton>` no projeto (provavelmente em `src/components/ui/`)
2. Em `PartsTab.tsx`: substituir o `<Loader2>` pelo `<TableSkeleton rows={3} cols={5} />` ou similar
3. Em `seguradoras/page.tsx`: substituir `<div>Carregando...</div>` por `<TableSkeleton>`
4. Verificar que o skeleton tem número de colunas compatível com cada tabela

**Agente:** `frontend-developer`
**Skills:** `superpowers:verification-before-completion`
**Paralelismo:** Independente

---

### S17-M9 · Igualar painel de adicionar entre PartsTab e ServicesTab

**Problema:** Dentro da mesma OS, dois tabs adjacentes têm estilos diferentes no painel de inserção de item:
- `PartsTab`: `bg-white border border-neutral-200 rounded-lg p-4 shadow-sm`
- `ServicesTab`: `rounded-md border border-neutral-200 bg-neutral-50 p-4`

Diferenças: background, border-radius, presença de shadow. O usuário que alterna entre os tabs percebe mudança visual.

**Critério de aceitação:**
- Ambos os painéis usam exatamente o mesmo conjunto de classes
- Padrão escolhido: `bg-white border border-neutral-200 rounded-lg p-4 shadow-sm` (o do PartsTab, mais polido)

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx
```

**Passos de implementação:**
1. Localizar o div wrapper do formulário de adicionar serviço em `ServicesTab.tsx`
2. Substituir `rounded-md border border-neutral-200 bg-neutral-50 p-4` por `bg-white border border-neutral-200 rounded-lg p-4 shadow-sm`
3. Verificar visualmente que o painel de ServicesTab ficou igual ao de PartsTab

**Agente:** `refactoring-specialist`
**Skills:** nenhuma adicional
**Paralelismo:** Independente — tarefa de 5 minutos

---

### S17-M12 · Unificar `formatCurrency` em `@paddock/utils`

**Problema:** Duas implementações locais com comportamentos diferentes:
- `ManagerDashboard.tsx`: abrevia em "k" (ex: R$ 15k)
- `PartsTab.tsx`: formato completo `pt-BR` (ex: R$ 15.234,56)

Se os requisitos de formatação mudarem, precisará alterar em múltiplos locais.

**Critério de aceitação:**
- Uma função `formatCurrency(value: number, options?: { compact?: boolean }): string` em `packages/utils/src/index.ts`
- Modo padrão: formato completo `pt-BR` com símbolo `R$`
- Modo `compact: true`: abrevia valores ≥ 1000 para "k" com 1 casa decimal
- As implementações locais removidas e substituídas pelo import de `@paddock/utils`
- Outros arquivos que fazem formatação de moeda manual identificados e migrados

**Arquivos afetados:**
```
packages/utils/src/index.ts                                         ← adicionar função
apps/dscar-web/src/app/(app)/dashboard/_components/ManagerDashboard.tsx
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx
```

**Passos de implementação:**
1. Ler `packages/utils/src/index.ts` para entender o que já existe
2. Adicionar:
```typescript
export function formatCurrency(value: number, options?: { compact?: boolean }): string {
  if (options?.compact && Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}
```
3. No `ManagerDashboard.tsx`: remover a local `formatCurrency` e importar de `@paddock/utils`, passando `{ compact: true }` onde usava abreviação
4. No `PartsTab.tsx`: remover a local e importar de `@paddock/utils`
5. Rodar `grep -r "formatCurrency\|toLocaleString.*BRL\|Intl.NumberFormat.*BRL" apps/dscar-web/src --include="*.tsx" -n` para encontrar outras ocorrências e migrar

**Agente:** `refactoring-specialist`
**Skills:** `superpowers:verification-before-completion`
**Paralelismo:** Independente

---

### S17-B6 · Extrair `SECTION_TITLE` como constant compartilhada

**Problema:** A constant `SECTION_TITLE` (usada em labels de seção dentro da OS) está definida localmente em `EntrySection.tsx` e `PrazosSection.tsx`, mas `ServicesTab.tsx` usa uma variante hardcoded inline com tamanho e tracking ligeiramente diferentes (`text-[10px] tracking-wide` vs `text-[11px] tracking-widest`).

**Critério de aceitação:**
- Um arquivo `src/lib/form-styles.ts` (ou `src/constants/form.ts`) exporta:
  - `SECTION_TITLE: string` — classe para títulos de seção (`text-xs font-semibold uppercase tracking-widest text-neutral-500`)
  - `LABEL: string` — classe para labels de campo (`text-xs font-bold uppercase tracking-wide text-neutral-600 mb-1`)
- Todos os arquivos que definem essas constants localmente importam do arquivo compartilhado
- Nenhuma definição local duplicada restante

**Arquivos afetados:**
```
apps/dscar-web/src/lib/form-styles.ts                              ← novo arquivo
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/EntrySection.tsx
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/PrazosSection.tsx
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx
apps/dscar-web/src/app/(app)/service-orders/_components/NewOSDrawer.tsx
```

**Passos de implementação:**
1. Criar `src/lib/form-styles.ts` com as constants (já incorporando `text-xs` da S17-C2)
2. Para cada arquivo que define `LABEL` ou `SECTION_TITLE` localmente: remover a definição e importar do arquivo shared
3. Verificar que nenhum arquivo ficou com string inline substituindo as constants

**Agente:** `refactoring-specialist`
**Skills:** nenhuma adicional
**Paralelismo:** Executar após S17-C2 (depende do novo tamanho de fonte)

---

## Sprint 18 — OS Workflow

**Objetivo:** Melhorar o fluxo principal de trabalho dos operadores — o ciclo de vida de uma OS desde criação até entrega. Foco em clareza, redução de erros e eficiência nas tarefas mais frequentes.

**Agentes primários:** `frontend-developer`, `react-specialist`, `fullstack-developer`
**Skills:** `superpowers:test-driven-development`, `superpowers:subagent-driven-development`, `superpowers:verification-before-completion`

---

### S18-C3 · Paginação na lista de OS

**Problema:** A lista de OS exibe no footer "Mostrando X de Y registros" mas não há controles de paginação. Se há mais registros do que o `page_size` da API, os dados adicionais ficam inacessíveis silenciosamente.

**Critério de aceitação:**
- Controles de paginação visíveis abaixo da tabela quando `count > page_size`
- Componente mostra: `← Anterior`, `Página X de Y`, `Próxima →`
- URL atualizada com `?page=N` para que o estado de paginação seja bookmarkável
- O `useServiceOrders` hook aceita e passa parâmetro `page`
- `page_size` padrão: 20 registros por página

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/service-orders/page.tsx
apps/dscar-web/src/hooks/useServiceOrders.ts
apps/dscar-web/src/components/ui/pagination.tsx (verificar se existe ou criar)
```

**Passos de implementação:**
1. Verificar se shadcn `<Pagination>` está disponível em `src/components/ui/`
2. Se não: instalar via `npx shadcn@latest add pagination`
3. Em `useServiceOrders.ts`: adicionar parâmetro `page?: number` à query, incluir no endpoint `/api/proxy/service-orders/?page=N&page_size=20`
4. Em `page.tsx`:
   - Ler `useSearchParams()` para obter `page` atual (default: 1)
   - Passar `page` para `useServiceOrders`
   - Após a tabela: renderizar `<Pagination>` condicionalmente quando `data.count > 20`
   - Navegação via `router.push` com `?page=N` preservando outros query params (status, seguradora, tipo)
5. Verificar que filtros resetam para page=1 quando aplicados

**Agente:** `frontend-developer`
**Skills:** `superpowers:verification-before-completion`
**Paralelismo:** Independente

---

### S18-C5 · Controle de transição de status no formulário da OS

**Problema:** O formulário de detalhe da OS mostra o status atual como badge mas não oferece nenhum controle para avançar o status. O operador precisa ir ao Kanban ou saber que preencher um campo de data específico muda o status (hint em 9px de tamanho, âmbar, quase invisível). Esta é a tarefa mais frequente num centro automotivo.

**Critério de aceitação:**
- Botão/dropdown "Avançar Status" visível no header do formulário (ao lado do badge de status atual)
- Exibe apenas as transições permitidas para o status atual (via `order.allowed_transitions` ou `VALID_TRANSITIONS` do `@paddock/types`)
- Ao confirmar: chama `PATCH /api/proxy/service-orders/{id}/transition/` com o novo status
- Após transição bem-sucedida: invalida o cache da OS e atualiza o badge
- Transição inválida: toast com mensagem de erro clara
- Não duplica a lógica do hint âmbar dos campos de data (os campos continuam funcionando como antes)

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServiceOrderForm.tsx
apps/dscar-web/src/hooks/useServiceOrders.ts  (ou novo useOSTransition.ts)
packages/types/src/service-order.types.ts     (para VALID_TRANSITIONS — já existe)
```

**Passos de implementação:**
1. Ler `packages/types/src/service-order.types.ts` para entender `VALID_TRANSITIONS`
2. Criar hook `useOSTransition(osId: string)` que faz `PATCH /api/proxy/service-orders/{id}/transition/` com `{ status: newStatus }` e invalida a query do detalhe
3. No header de `ServiceOrderForm.tsx` (onde fica o `StatusBadge`):
   - Adicionar `<DropdownMenu>` com label "Avançar" e ícone de seta
   - Items do dropdown: `VALID_TRANSITIONS[order.status]` mapeados para labels em pt-BR (usar `STATUS_LABELS` se existir ou criar)
   - Ao selecionar: chamar `useOSTransition().mutate(newStatus)`
   - Estado loading: desabilitar o dropdown durante a mutação
4. Se `allowed_transitions` já vem da API no objeto da OS, usar esse array em vez de `VALID_TRANSITIONS` client-side
5. Verificar que os campos de data com auto-transition ainda funcionam independentemente

**Agente:** `fullstack-developer`
**Skills:** `superpowers:test-driven-development`, `superpowers:verification-before-completion`
**Paralelismo:** Independente

---

### S18-A1 · Indicador de mudanças não salvas ao trocar de tab

**Problema:** O formulário principal da OS usa React Hook Form no tab "Abertura". Quando o usuário edita campos e naveja para outro tab sem salvar, não há nenhum aviso visual. Os dados editados não são perdidos (RHF mantém state), mas o usuário não sabe que tem mudanças pendentes.

**Critério de aceitação:**
- Quando `formState.isDirty === true` (RHF), o tab "Abertura" exibe um indicador visual (ponto âmbar ou badge "•")
- O botão "Salvar" no header recebe destaque adicional (ring âmbar ou label "Salvar alterações") quando há mudanças pendentes
- Ao salvar com sucesso: indicador desaparece
- Ao cancelar (se houver botão cancelar): indicador desaparece e RHF reseta
- Comportamento não se aplica aos outros tabs (Peças, Serviços têm saves independentes)

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/ServiceOrderForm.tsx
```

**Passos de implementação:**
1. No `ServiceOrderForm.tsx`, já existe acesso ao `formState` do RHF
2. Extrair `const { isDirty } = formState`
3. No tab trigger de "Abertura": adicionar `{isDirty && <span className="w-1.5 h-1.5 rounded-full bg-warning-500 ml-1.5 inline-block" />}`
4. No botão Salvar: quando `isDirty`, adicionar `ring-2 ring-warning-400 ring-offset-1` e alterar label para "Salvar alterações"
5. Verificar que `isDirty` volta a `false` após save bem-sucedido (RHF `reset(newValues)` é chamado no `onSuccess`)

**Agente:** `react-specialist`
**Skills:** `superpowers:verification-before-completion`
**Paralelismo:** Independente

---

### S18-A4 · Edição inline no ServicesTab

**Problema:** `PartsTab.tsx` implementa edição inline com ícone de lápis: ao clicar, o item vira um formulário inline com campos editáveis e botão salvar. `ServicesTab.tsx` tem apenas delete — qualquer correção de preço ou quantidade exige apagar e recriar o serviço.

**Critério de aceitação:**
- Cada linha na tabela de serviços tem ícone de lápis (igual ao `PartsTab`)
- Clicar no lápis transforma a linha em campos editáveis: `quantity`, `unit_price`, `discount`
- Botão "✓" salva via `PATCH /api/proxy/service-orders/{id}/labor/{laborId}/`
- Botão "✕" cancela sem salvar
- Somente uma linha pode estar em edição por vez
- Comportamento idêntico ao `PartsTab` para consistência visual

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx
apps/dscar-web/src/hooks/useServiceOrders.ts (ou criar useOSLabor.ts se não existir)
```

**Passos de implementação:**
1. Ler `PartsTab.tsx` integralmente para entender o padrão de edição inline implementado
2. Replicar o padrão em `ServicesTab.tsx`:
   - Estado `editingId: string | null`
   - Estado `editForm: { quantity: number; unit_price: string; discount: string }`
   - Ao clicar no lápis: `setEditingId(labor.id)` + popular `editForm` com valores atuais
   - Ao clicar "✓": chamar hook de update + `setEditingId(null)`
   - Ao clicar "✕": `setEditingId(null)` sem salvar
3. Verificar se existe endpoint `PATCH /service-orders/{id}/labor/{laborId}/` no backend (deve existir pelo padrão do projeto)
4. Criar `useOSLaborUpdate` se não existir

**Agente:** `frontend-developer`
**Skills:** `superpowers:verification-before-completion`
**Paralelismo:** Independente

---

### S18-A7 · Renomear campos de entrega no PrazosSection

**Problema:** Os três campos de data de entrega têm nomes que se confundem:
- `delivery_date` → label "Retirada pelo cliente" (mas é campo de planejamento/agenda)
- `estimated_delivery_date` → label "Previsão de entrega" (derivado, read-only)
- `client_delivery_date` → label "Entrega ao cliente" (trigger de status "Entregue")

"Retirada pelo cliente" e "Entrega ao cliente" soam idênticos para um operador. O campo que realmente muda o status (`client_delivery_date`) não tem destaque visual suficiente.

**Critério de aceitação:**
- `delivery_date` → label "Data de retirada (agenda)" com sublabel "Aparece na agenda de agendamentos"
- `client_delivery_date` → label "Confirmar entrega" com sublabel "⚠ Preencher muda status → Entregue" em destaque (warning box, não só texto âmbar)
- A subsection que contém `client_delivery_date` tem um visual diferenciado (ex: borda warning, fundo warning-50)
- O hint é visível sem precisar ler 9px de texto âmbar

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/sections/PrazosSection.tsx
```

**Passos de implementação:**
1. Ler `PrazosSection.tsx` na íntegra
2. Alterar o label de `delivery_date` para "Data de retirada (agenda)"
3. Alterar o label de `client_delivery_date` para "Confirmar entrega ao cliente"
4. Substituir o hint âmbar `text-amber-600 text-xs` por uma callout box:
```tsx
<div className="flex items-start gap-2 rounded-md bg-warning-50 border border-warning-200 px-3 py-2 text-xs text-warning-800">
  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning-600" />
  Preencher este campo muda o status da OS para <strong>Entregue</strong>
</div>
```
5. Verificar que as mudanças não afetam a lógica de auto-transition

**Agente:** `frontend-developer`
**Skills:** nenhuma adicional
**Paralelismo:** Independente

---

### S18-M7 · Toggle R$ / % no campo de desconto

**Problema:** Os campos de desconto em `PartsTab` e `ServicesTab` aceitam apenas valor absoluto em R$. Oficinas negociam descontos em percentual. Calcular manualmente 10% de R$850 é uma carga cognitiva desnecessária para o operador.

**Critério de aceitação:**
- Ao lado do campo de desconto: select `R$` | `%`
- Quando `%` selecionado: campo aceita 0-100, mostra preview "= R$ X,XX" calculado em tempo real
- Ao salvar: valor sempre submetido como R$ absoluto (conversão client-side antes do POST/PATCH)
- Estado do toggle não persiste entre sessions (pode ser per-instance)

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/PartsTab.tsx
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ServicesTab.tsx
```

**Passos de implementação:**
1. Em cada tab, adicionar estado local `discountMode: "R$" | "%"` (default: "R$")
2. No campo de desconto, adicionar um select antes ou depois do input:
```tsx
<div className="flex items-center gap-1">
  <select value={discountMode} onChange={(e) => setDiscountMode(e.target.value as "R$" | "%")}
    className="h-8 rounded-md border border-neutral-200 text-xs px-1">
    <option>R$</option>
    <option>%</option>
  </select>
  <Input ... />
  {discountMode === "%" && unitPrice && (
    <span className="text-xs text-neutral-400">= {formatCurrency(unitPrice * qty * (discountValue/100))}</span>
  )}
</div>
```
3. Antes de submeter o form: se `discountMode === "%"`, converter `discount = unitPrice * quantity * (percentual / 100)`
4. Usar `formatCurrency` de `@paddock/utils` (entregue na S17-M12)

**Agente:** `frontend-developer`
**Skills:** nenhuma adicional
**Paralelismo:** Depende de S17-M12 para o `formatCurrency`

---

### S18-M8 · Validação de formato NF-e + tooltip no botão bloqueado

**Problema:** O campo de chave NF-e no `ClosingTab` tem `maxLength={44}` mas sem validação de formato. Uma chave copiada de PDF com espaços ou traços passa silenciosamente. Quando `canDeliver === false`, o botão de entrega é desabilitado sem explicação no ponto de interação.

**Critério de aceitação:**
- Campo NF-e valida o padrão `/^\d{44}$/` após strip de espaços e hífens
- Erro inline: "Chave NF-e deve ter 44 dígitos numéricos"
- Quando `canDeliver === false`: tooltip no botão desabilitado explicando o motivo exato
- Auto-strip de espaços e hífens ao colar (handler `onPaste`)

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/service-orders/[id]/_components/tabs/ClosingTab.tsx
```

**Passos de implementação:**
1. Ler `ClosingTab.tsx` para entender a estrutura do form e o `canDeliver` guard
2. Na validação Zod do campo `nfe_key`: adicionar `.transform(v => v.replace(/[\s\-]/g, "")).regex(/^\d{44}$/, "Chave NF-e deve ter 44 dígitos")`
3. Adicionar handler `onPaste` no input que remove espaços e hífens automaticamente
4. Para o botão desabilitado: envolver em `<TooltipProvider><Tooltip><TooltipTrigger asChild>...<TooltipContent>` com mensagem dinâmica baseada em por que `canDeliver` é false
5. Lógica de mensagem: se sem NF-e/NFS-e → "Informe a chave NF-e ou número NFS-e para continuar"; se OS não está no status correto → "A OS precisa estar no status Pronto para Entrega"

**Agente:** `frontend-developer`
**Skills:** `superpowers:verification-before-completion`
**Paralelismo:** Independente

---

### S18-M10 · Máscara de CNPJ no InsurerDialog

**Problema:** O campo CNPJ no `InsurerDialog` tem placeholder `"00.000.000/0000-00"` mas não aplica máscara. O usuário pode digitar qualquer string. A tabela exibe CNPJ sem formatação (ex: `00000000000191`).

**Critério de aceitação:**
- Input CNPJ aplica máscara automática ao digitar: `XX.XXX.XXX/XXXX-XX`
- Valor submetido ao backend: apenas dígitos (sem máscara) — backend espera apenas números
- Tabela exibe CNPJ formatado
- Validação Zod: apenas dígitos, exatamente 14 caracteres

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/cadastros/seguradoras/_components/InsurerDialog.tsx
apps/dscar-web/src/app/(app)/cadastros/seguradoras/page.tsx
```

**Passos de implementação:**
1. Verificar se o projeto já tem alguma lib de máscara (ex: `react-input-mask`, `imask`) — se não, implementar manualmente com `onChange`
2. Criar função `maskCNPJ(value: string): string`:
```typescript
function maskCNPJ(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
}
```
3. No campo CNPJ do dialog: aplicar máscara no `onChange` e submeter apenas dígitos
4. Atualizar validação Zod: `cnpj: z.string().transform(v => v.replace(/\D/g, "")).pipe(z.string().length(14, "CNPJ inválido"))`
5. Na tabela de seguradoras: criar função `formatCNPJ(digits: string)` para display

**Agente:** `frontend-developer`
**Skills:** nenhuma adicional
**Paralelismo:** Independente

---

### S18-B1 · Separar navegação de toggle no Sidebar

**Problema:** Itens de nav com `children + href` (Cadastros, Financeiro, RH) têm comportamento ambíguo: ao expandir pela primeira vez navegam para o `href` E expandem o grupo simultaneamente. Ir para Kanban a partir de estado colapsado exige 2 cliques com 2 navegações (lista de OS → Kanban).

> **Nota:** O toggle de recolher já foi corrigido numa sessão anterior. Este item trata do comportamento de navegação dupla.

**Critério de aceitação:**
- Itens com `children` usam apenas o chevron para expandir/recolher — não navegam
- O `href` do item pai é acessível apenas clicando no texto/ícone do label, não no chevron
- Ou alternativa: remover `href` dos itens pai (a rota é acessível pelo primeiro child)
- Comportamento claro e sem side effects de navegação dupla

**Arquivos afetados:**
```
apps/dscar-web/src/components/Sidebar.tsx
```

**Passos de implementação:**
1. Para itens com `children`: separar o botão em duas áreas clicáveis:
   - Área do label (ícone + texto): navega para `item.href` se existir
   - Área do chevron: apenas toggle do grupo
2. Ou, mais simples: remover `href` de todos os itens pai que têm children — o primeiro child serve como entrada (ex: "Financeiro" → o child "Visão Geral" aponta para `/financeiro`)
3. Avaliar qual abordagem melhor com o layout atual e implementar
4. Verificar que o indicador de rota ativa (`isGroupActive`) ainda funciona

**Agente:** `frontend-developer`
**Skills:** nenhuma adicional
**Paralelismo:** Independente

---

### S18-M1 · Kanban: contador por coluna + empty state + split toggle

**Problema:** O Kanban não mostra quantas OS existem em cada coluna. Colunas vazias não têm indicação visual. O toggle "Entregues" exibe também OS canceladas, misturando dois estados semanticamente opostos.

**Critério de aceitação:**
- Cada header de coluna exibe `(N)` com o count de OS naquela coluna
- Coluna vazia exibe: ícone sutil + "Nenhuma OS" centralizado
- O toggle único "Entregues" é substituído por dois checkboxes/toggles separados: "Entregues" e "Canceladas"
- Cada toggle é independente

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/service-orders/kanban/page.tsx
apps/dscar-web/src/components/kanban/KanbanColumn.tsx
apps/dscar-web/src/components/kanban/KanbanBoard.tsx
```

**Passos de implementação:**
1. Em `KanbanColumn.tsx`: adicionar prop `count: number` no header e renderizar `({count})` ao lado do título
2. Em `KanbanBoard.tsx`: calcular `count` por coluna antes de renderizar, passar para `KanbanColumn`
3. Em `KanbanColumn.tsx`: quando `cards.length === 0`, renderizar empty state no body
4. Em `kanban/page.tsx`: substituir `showDelivered` state único por `showDelivered` + `showCancelled` independentes
5. Atualizar a lógica de filtro de cards para usar os dois estados separadamente
6. Atualizar UI do toggle: dois `<Switch>` ou dois `<Checkbox>` com labels claros

**Agente:** `frontend-developer`
**Skills:** `superpowers:verification-before-completion`
**Paralelismo:** Independente

---

## Sprint 19 — Agenda + Polimento

**Objetivo:** Completar as funcionalidades do módulo de Agenda e aplicar refinamentos visuais finais em componentes secundários. Sprint de polish — sem novas features de negócio.

**Agentes primários:** `frontend-developer`, `ui-designer`
**Skills:** `superpowers:verification-before-completion`, `superpowers:requesting-code-review`

---

### S19-M2 · DayView: remover `max-w-xl`

**Problema:** `DayView.tsx` tem `max-w-xl mx-auto` como container, limitando a ~672px. Em desktops a agenda fica com ~40% da largura disponível e espaço vazio enorme. Os outros views (WeekView, MonthView) ocupam a largura total.

**Critério de aceitação:**
- DayView ocupa a mesma largura que WeekView e MonthView
- Layout interno (hora + eventos) se ajusta proporcionalmente
- Em mobile: comportamento anterior mantido (já era responsivo)

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/agenda/_components/DayView.tsx
```

**Passos de implementação:**
1. Ler `DayView.tsx` e identificar o div com `max-w-xl mx-auto`
2. Remover `max-w-xl` — manter `mx-auto` somente se necessário para centralização
3. Verificar que o grid de horas não fica excessivamente largo (adicionar `max-w-5xl` se necessário)
4. Comparar visualmente com WeekView para garantir consistência de largura

**Agente:** `frontend-developer`
**Skills:** nenhuma adicional
**Paralelismo:** Independente — todos os S19 são independentes entre si

---

### S19-M3 · Current-time indicator no WeekView e DayView

**Problema:** Calendários profissionais (Google Calendar, Outlook) exibem uma linha horizontal na hora atual para orientação visual. Sem ela, o operador precisa identificar manualmente qual slot horário corresponde ao "agora".

**Critério de aceitação:**
- Linha horizontal vermelha (cor `primary-600`) sobre o grid de horas, posicionada na hora e minuto atuais
- Pequeno círculo na interseção com a margem de horas (estilo Google Calendar)
- Posição atualizada a cada minuto via `setInterval`
- Aparece apenas se o dia visualizado for hoje
- Presente tanto em WeekView quanto em DayView

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/agenda/_components/WeekView.tsx
apps/dscar-web/src/app/(app)/agenda/_components/DayView.tsx
```

**Passos de implementação:**
1. Criar hook `useCurrentTimePosition()`:
```typescript
function useCurrentTimePosition(): number | null {
  // Retorna porcentagem (0-100) dentro do intervalo visível do grid
  // Pressuposto: grid exibe 8h–18h (horário de funcionamento DS Car)
  // Se a hora atual for antes das 8h ou depois das 18h, retorna null (linha não exibida)
  // Ajustar START_HOUR/END_HOUR se o grid mudar de intervalo
}
```
2. O hook usa `useState` + `useEffect` com `setInterval(fn, 60_000)` para atualizar a cada minuto
3. No grid de horas, adicionar `position: relative` no container
4. Renderizar a linha como `<div>` absolute posicionado com `top: ${position}%`
5. Aplicar apenas quando `isToday(currentDate)`
6. Fazer scroll automático para a linha ao abrir a view (opcional mas recomendado)

**Agente:** `frontend-developer`
**Skills:** nenhuma adicional
**Paralelismo:** Independente

---

### S19-M4 · WeekView: células clicáveis para agendamento

**Problema:** Clicar em um slot de horário vazio no WeekView não abre o SchedulingDialog. O botão "Agendar" existe no header mas abre o dialog sem data/hora pré-preenchida. O padrão de calendário é clicar no slot → dialog pré-preenchido.

**Critério de aceitação:**
- Clicar em qualquer célula de hora no WeekView abre `SchedulingDialog` com `date` e `hour` pré-preenchidos
- O cursor muda para `pointer` nas células de hora
- Hover state sutil nas células (fundo levemente destacado)
- DayView recebe o mesmo comportamento
- Não interfere com clique nos cards de OS existentes (`e.stopPropagation()` nos cards)

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/agenda/_components/WeekView.tsx
apps/dscar-web/src/app/(app)/agenda/_components/DayView.tsx
apps/dscar-web/src/app/(app)/agenda/page.tsx  (passar handler para os views)
```

**Passos de implementação:**
1. Em `agenda/page.tsx`: adicionar estado `schedulingSlot: { date: Date; hour: number } | null`
2. Passar `onSlotClick={(date, hour) => setSchedulingSlot({date, hour})}` para WeekView e DayView
3. Em `WeekView.tsx`: nas células de hora, adicionar `onClick={() => onSlotClick?.(dayDate, hour)}` + `cursor-pointer hover:bg-primary-50/30`
4. Em `SchedulingDialog`: aceitar props `initialDate?: Date` e `initialHour?: number` e pré-preencher os campos correspondentes
5. Garantir que `e.stopPropagation()` nos `CalendarEventCard` impede que o clique no card abra o SchedulingDialog

**Agente:** `frontend-developer`
**Skills:** nenhuma adicional
**Paralelismo:** Independente

---

### S19-M5 · WeekView: overflow "+N mais" quando >2 eventos por hora

**Problema:** Quando >2 OS estão agendadas na mesma hora, os cards simplesmente se empilham, quebrando o ritmo visual do grid. Não há indicação de overflow e a célula cresce assimetricamente.

**Critério de aceitação:**
- Células de hora mostram no máximo 2 cards
- Se há N > 2 eventos: mostrar 2 cards + link "+N-2 mais"
- Clicar em "+N mais" navega para DayView do mesmo dia (mantém foco na hora)
- Altura das células de hora é fixa (`min-h-[64px]`, não cresce com eventos)

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/agenda/_components/WeekView.tsx
```

**Passos de implementação:**
1. Alterar `min-h-[52px]` para `min-h-[64px]` e adicionar `overflow-hidden` no container de eventos
2. Lógica de slice: `const visibleCards = events.slice(0, 2)` + `const hiddenCount = events.length - 2`
3. Renderizar os 2 cards + quando `hiddenCount > 0`:
```tsx
<button onClick={() => navigateToDayView(date)} className="text-[10px] text-primary-600 hover:underline">
  +{hiddenCount} mais
</button>
```
4. `navigateToDayView` atualiza `currentDate` e `viewMode` para "day"

**Agente:** `frontend-developer`
**Skills:** nenhuma adicional
**Paralelismo:** Independente

---

### S19-M6 · CalendarEventCard: corrigir contraste WCAG

**Problema:** `bg-emerald-500` (#22c55e) com `text-white` atinge ratio de 2.7:1 — falha WCAG AA (mínimo 4.5:1 para texto normal, 3:1 para texto grande). Em fonte de 10px (abaixo do threshold de texto grande), a falha é mais grave.

**Critério de aceitação:**
- Cor de delivery alterada de `bg-emerald-500` para `bg-success-700` (#15803d) — ratio ≈ 5.1:1 ✓ WCAG AA
- Ou alternativamente: usar fundo claro `bg-success-100` com texto `text-success-800`
- Todas as cores de evento checadas contra WCAG AA
- Cores migradas do palette raw Tailwind para tokens do design system

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/agenda/_components/CalendarEventCard.tsx
```

**Passos de implementação:**
1. Ler o arquivo e mapear todas as combinações de cor de fundo/texto
2. Para `delivery`: `bg-emerald-500 text-white` → `bg-success-700 text-white` (ratio 5.1:1)
3. Para `entry`: `bg-blue-500 text-white` → `bg-info-600 text-white` (ratio ~4.6:1)
4. Para `scheduled_delivery`: `bg-orange-500 text-white` → `bg-warning-700 text-white`
5. Verificar all-day row: `bg-emerald-50/40` → `bg-success-50/60` (não é texto, apenas fundo)

**Agente:** `ui-designer`
**Skills:** nenhuma adicional
**Paralelismo:** Independente

---

### S19-M11 · Agenda: remover double padding

**Problema:** O layout principal da aplicação já aplica padding lateral. A página `/agenda` adiciona `p-4` interno, resultando em 40px de padding lateral no desktop — inconsistente com as demais páginas que usam `p-6 max-w-7xl mx-auto` diretamente.

**Critério de aceitação:**
- Página de agenda com mesmos espaçamentos das demais páginas (`p-6` ou padding padrão do layout)
- CalendarHeader alinhado horizontalmente com o conteúdo das outras páginas

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/agenda/page.tsx
```

**Passos de implementação:**
1. Ler a página de agenda e verificar o container externo
2. Substituir `p-4` por `p-6` (padrão das outras páginas) ou remover se o layout já providencia padding
3. Verificar visualmente que o header da agenda fica alinhado com o header da página de OS

**Agente:** `frontend-developer`
**Skills:** nenhuma adicional
**Paralelismo:** Independente

---

### S19-B2 · Sidebar tooltip: corrigir cálculo com scroll

**Problema:** O tooltip do sidebar em modo colapsado calcula sua posição com `getBoundingClientRect()` relativo ao viewport. Se a nav estiver scrollada, a posição fica deslocada porque `top` é relativo ao container (via CSS `absolute`), não ao viewport.

**Critério de aceitação:**
- Tooltip aparece corretamente alinhado ao item mesmo quando a nav está scrollada
- Sem jump ou offset visual

**Arquivos afetados:**
```
apps/dscar-web/src/components/Sidebar.tsx
```

**Passos de implementação:**
1. Em `showTooltip`, a posição calculada é `rect.top - sidebarRect.top + rect.height / 2`
2. O problema: o tooltip é `absolute` dentro do `<aside>`, mas o `<aside>` tem `overflow-hidden`. Na verdade, o `sidebarRef.current` é o `<aside>` que tem `overflow: hidden` e a `nav` interna pode ter scroll próprio
3. Corrigir calculando relativo à `nav` scrollável:
```typescript
const navEl = sidebarRef.current?.querySelector("nav")
const scrollOffset = navEl?.scrollTop ?? 0
setTooltip({
  top: rect.top - (sidebarRect?.top ?? 0) + scrollOffset + rect.height / 2,
  ...
})
```
4. Testar expandindo vários grupos de nav para forçar scroll e verificar que o tooltip alinha corretamente

**Agente:** `frontend-developer`
**Skills:** nenhuma adicional
**Paralelismo:** Independente

---

### S19-B3 · CalendarEventCard: mostrar modelo do carro

**Problema:** Em modo expandido, o card mostra placa + primeiro nome do cliente. Para nomes comuns (José, Maria) na mesma agenda, o primeiro nome não distingue entre entradas. O modelo do carro é mais único.

**Critério de aceitação:**
- Em modo expandido: mostrar `plate · make/model` (ex: "ABC1D23 · Civic") ao invés de `plate · firstName`
- Se `make` e `model` não disponíveis: fallback para `firstName` como antes
- Em modo compacto (células pequenas): manter só placa

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/agenda/_components/CalendarEventCard.tsx
packages/types/src/agenda.types.ts  (verificar se make/model estão no tipo)
```

**Passos de implementação:**
1. Verificar em `agenda.types.ts` se `make` e `model` fazem parte do tipo de evento de agenda
2. Se sim: substituir `customer_name.split(" ")[0]` por `[make, model].filter(Boolean).join(" ") || customer_name.split(" ")[0]`
3. Se não: verificar se o endpoint `GET /service-orders/calendar/` retorna esses campos. Se retornar mas o tipo não tiver, adicionar ao tipo. Se o endpoint não retornar, **esta tarefa requer mudança de backend** (adicionar `make` e `model` ao `CalendarSerializer`) — avaliar se inclui no escopo ou adia

**Dependência potencial:** backend pode precisar expor `make` e `model` no endpoint de calendário

**Agente:** `frontend-developer`
**Skills:** nenhuma adicional
**Paralelismo:** Independente

---

### S19-B4 · Tokens: migrar `emerald/violet/blue` para `success/accent/info`

**Problema:** `ManagerDashboard.tsx` usa `bg-emerald-50`, `bg-violet-50`, `bg-blue-50` para os ícones do StatCard. O design system define `success`, `accent` e `info` para esses casos semânticos. Qualquer mudança futura nos tokens do sistema não propagaria para esses componentes.

**Critério de aceitação:**
- `bg-emerald-50` → `bg-success-50`
- `bg-violet-50` → `bg-accent-100` (mais próximo semanticamente)
- `bg-blue-50` → `bg-info-50`
- `text-emerald-700` → `text-success-700`
- Verificar o output visual é praticamente idêntico (as cores são similares)

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/dashboard/_components/ManagerDashboard.tsx
apps/dscar-web/src/app/(app)/dashboard/_components/TeamProductivityTable.tsx
```

**Passos de implementação:**
1. Grep por `emerald|violet|orange-` em `apps/dscar-web/src` para identificar todas as ocorrências
2. Substituir seguindo o mapeamento semântico acima
3. Verificar visualmente no dashboard que as cores não mudaram drasticamente

**Agente:** `refactoring-specialist`
**Skills:** nenhuma adicional
**Paralelismo:** Independente

---

### S19-B5 · Dashboard STOREKEEPER: corrigir grid com 2 cards

**Problema:** O fallback do dashboard para STOREKEEPER usa `grid grid-cols-2 lg:grid-cols-4` mas renderiza apenas 2 `StatCard`. No desktop, 2 colunas ficam vazias à direita.

**Critério de aceitação:**
- Grid se adapta ao número real de cards: `grid-cols-2` (2 cards em qualquer tamanho)
- Ou: adicionar 2 cards adicionais relevantes para o STOREKEEPER (ex: "Peças em estoque baixo", "Requisições pendentes")
- Sem colunas vazias visíveis

**Arquivos afetados:**
```
apps/dscar-web/src/app/(app)/dashboard/page.tsx  (ou componente de fallback)
```

**Passos de implementação:**
1. Localizar o render do fallback no dashboard
2. Alterar `lg:grid-cols-4` para `lg:grid-cols-2` quando só 2 cards são renderizados
3. Ou adicionar 2 cards de contexto se houver dados disponíveis para STOREKEEPER

**Agente:** `frontend-developer`
**Skills:** nenhuma adicional
**Paralelismo:** Independente

---

## Ordem de Execução Recomendada

### Sprint 17 — Sequência

```
Fase 1 (paralelo): S17-C1, S17-C2, S17-C4, S17-A2, S17-A3, S17-A5, S17-A6, S17-M9, S17-M12
Fase 2 (após C2):  S17-B6  ← depende do text-xs da C2
```

### Sprint 18 — Sequência

```
Fase 1 (paralelo): S18-C3, S18-C5, S18-A1, S18-A4, S18-A7, S18-M8, S18-M10, S18-B1, S18-M1
Fase 2 (após S17-M12): S18-M7  ← usa formatCurrency de @paddock/utils
```

### Sprint 19 — Sequência

```
Paralelo total: S19-M2, S19-M3, S19-M4, S19-M5, S19-M6, S19-M11, S19-B2, S19-B3, S19-B4, S19-B5
```

---

## Checklist de Conclusão por Sprint

### Sprint 17
- [ ] `grep -r "#ea0e03\|#e31b1b\|red-700\|red-600" apps/dscar-web/src` retorna 0 resultados em arquivos TSX
- [ ] `grep -r "text-\[9px\]\|text-\[10px\]" apps/dscar-web/src` retorna 0 resultados em labels de campo
- [ ] `grep -r "window\.confirm\|confirm(" apps/dscar-web/src` retorna 0 resultados
- [ ] `<ConfirmDialog>` exportado de `src/components/ui/index.ts`
- [ ] `formatCurrency` exportado de `packages/utils/src/index.ts`
- [ ] `src/lib/form-styles.ts` existe com `LABEL` e `SECTION_TITLE`
- [ ] `npm run build` sem warnings
- [ ] `tsc --strict` sem erros

### Sprint 18
- [ ] Paginação visível na lista de OS com >20 registros
- [ ] Botão/dropdown de transição de status no header do formulário da OS
- [ ] Indicador `isDirty` visível no tab "Abertura" quando há mudanças
- [ ] Ícone de lápis funcionando em ServicesTab
- [ ] Labels de entrega sem ambiguidade em PrazosSection
- [ ] Kanban com contadores e empty states
- [ ] Toggle "Entregues" e "Canceladas" separados no Kanban
- [ ] `tsc --strict` sem erros

### Sprint 19
- [ ] DayView sem `max-w-xl`
- [ ] Linha de hora atual visível em WeekView e DayView quando hoje
- [ ] Clicar em slot no WeekView abre SchedulingDialog com data/hora pré-preenchidos
- [ ] Células com >2 eventos mostram "+N mais"
- [ ] `bg-emerald-500` removido do CalendarEventCard
- [ ] Ratio de contraste de todos os event colors ≥ 4.5:1
- [ ] `npm run build` sem warnings
- [ ] `tsc --strict` sem erros

---

*Spec gerada em 2026-04-14 · Baseada em revisão de Playwright + UI Designer + UX Researcher*
*Próximo passo: invocar `superpowers:writing-plans` para criar planos de implementação por sprint*
