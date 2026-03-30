# QA Report — Sprint 03: Robustez, Filtros e Clientes
**Data:** 2026-03-30
**App:** `apps/dscar-web`
**QA Engineer:** Claude Code (Sonnet 4.6)

---

## Resumo Executivo

**7/9 checks passando**

| # | Check | Status |
|---|-------|--------|
| 1 | TypeScript — zero erros | ✅ Passou |
| 2 | Build Next.js | ✅ Passou |
| 3 | Rotas HTTP acessíveis | ⚠️ Aviso |
| 4 | Arquivos críticos existem e têm conteúdo | ✅ Passou |
| 5 | `apiFetch` centralizado (sem definição local) | ✅ Passou |
| 6 | `useDebounce` sem duplicatas | ✅ Passou |
| 7 | `react-error-boundary` no `package.json` | ✅ Passou |
| 8 | `<ErrorBoundary>` nas páginas | ⚠️ Aviso |
| 9 | Sem `: any` explícito novo | ✅ Passou |

---

## Detalhamento

### 1. ✅ TypeScript — zero erros

```
npx tsc --noEmit → sem output (0 erros, 0 warnings)
```

O compilador não reportou nenhum erro. `tsconfig.json` tem `"strict": true` ativo, cobrindo `noImplicitAny`, `strictNullChecks` e demais flags.

---

### 2. ✅ Build Next.js — compilação limpa

Build concluído com sucesso. Todas as 9 rotas compiladas:

```
ƒ /api/proxy/[...path]     142 B       105 kB
○ /clientes               3.85 kB     143 kB
ƒ /clientes/[id]          5.87 kB     145 kB
○ /dashboard              6.62 kB     146 kB
○ /login                  2.55 kB     121 kB
○ /os                     8.26 kB     147 kB
ƒ /os/[id]                5.93 kB     145 kB
○ /os/kanban             22.6 kB      162 kB
○ /os/nova               25.9 kB      165 kB
```

Zero erros ou warnings de compilação.

---

### 3. ⚠️ Rotas HTTP — servidor em :3001

| Rota | Esperado | Obtido | Resultado |
|------|----------|--------|-----------|
| GET /login | 200 | **500** | ❌ |
| GET /os | 302 (redirect p/ login) | 302 | ✅ |
| GET /clientes | 302 (redirect p/ login) | 302 | ✅ |

**Falha em `/login`:**

O servidor em `:3001` está rodando em modo **dev** com cache `.next` stale. O erro é:

```
Error: Cannot find module './307.js'
  at .next/server/webpack-runtime.js
  → ao carregar .next/server/app/(auth)/login/page.js
```

**Causa:** O build de produção foi executado (`npx next build`) e gerou novos chunks, mas o servidor dev em `:3001` ainda aponta para o cache antigo, que não contém o chunk `307.js` referenciado pelo novo manifesto.

**Correção:** Reiniciar o servidor de desenvolvimento após qualquer `next build`:
```bash
# Parar o servidor atual e reiniciar
npx next dev -p 3001
```
Ou rodar em modo produção com o build gerado:
```bash
npx next start -p 3001
```

**Severidade:** Baixa em desenvolvimento; não afeta o build nem o código-fonte.

---

### 4. ✅ Arquivos críticos — existem e têm conteúdo

| Arquivo | Linhas | Status |
|---------|--------|--------|
| `src/hooks/useDebounce.ts` | 10 | ✅ Existe — implementação genérica correta com `useState`/`useEffect` |
| `src/lib/api.ts` | 29 | ✅ Existe — trata 401 com `signOut`, erros de rede e mensagens do backend |
| `src/components/ErrorBoundary.tsx` | 41 | ✅ Existe — wrapper de `react-error-boundary` com fallback em PT-BR |
| `src/app/(app)/clientes/[id]/page.tsx` | 241 | ✅ Existe — tabela de OS do cliente com 5 colunas e estados de loading |
| `src/hooks/useCustomer.ts` | 11 | ✅ Existe — usa `apiFetch` de `@/lib/api`, query com `enabled: !!id` |

---

### 5. ✅ `apiFetch` centralizado

Nenhum dos hooks define `apiFetch` localmente. Todos importam da fonte única `@/lib/api`:

```
useServiceOrders.ts:3:  import { apiFetch } from "@/lib/api";
useCustomers.ts:3:      import { apiFetch } from "@/lib/api";
useCustomer.ts:2:       import { apiFetch } from "@/lib/api";
```

---

### 6. ✅ `useDebounce` sem duplicatas

```
src/hooks/useDebounce.ts:3: export function useDebounce<T>(value: T, delay: number): T {
```

Apenas uma definição em todo o projeto. Nenhuma cópia local nos hooks ou páginas.

---

### 7. ✅ `react-error-boundary` instalado

```json
"react-error-boundary": "^4.1.2"
```

Presente em `package.json` como dependência de produção. Uso confirmado em `src/components/ErrorBoundary.tsx`.

---

### 8. ⚠️ `<ErrorBoundary>` nas páginas

**Páginas protegidas (4/7):**

| Página | Status |
|--------|--------|
| `/os/page.tsx` | ✅ `<ErrorBoundary>` envolve `<OSListInner>` |
| `/clientes/page.tsx` | ✅ `<ErrorBoundary>` envolve o conteúdo |
| `/dashboard/page.tsx` | ✅ `<ErrorBoundary>` presente |
| `/os/kanban/page.tsx` | ✅ `<ErrorBoundary>` presente |

**Páginas sem proteção (3/7):**

| Arquivo | Problema |
|---------|----------|
| `src/app/(app)/clientes/[id]/page.tsx` | ❌ Sem `<ErrorBoundary>` |
| `src/app/(app)/os/[id]/page.tsx` | ❌ Sem `<ErrorBoundary>` |
| `src/app/(app)/os/nova/page.tsx` | ❌ Sem `<ErrorBoundary>` |

**Impacto:** Um erro de fetch ou de renderização nessas páginas causará crash da UI inteira sem fallback amigável. As páginas de detalhe (`[id]`) são as mais críticas pois dependem de dados externos.

**Correção sugerida para `clientes/[id]/page.tsx`:**
```tsx
// Extrair o corpo atual para ClienteDetailContent
// e envolver com ErrorBoundary no export default:
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function ClienteDetailPage({ params }: ClienteDetailPageProps) {
  return (
    <ErrorBoundary>
      <ClienteDetailContent params={params} />
    </ErrorBoundary>
  );
}
```
Aplicar o mesmo padrão em `os/[id]/page.tsx` e `os/nova/page.tsx`.

---

### 9. ✅ Sem `: any` explícito

```bash
grep -rn ": any" src/hooks/ src/lib/ src/components/ src/app/ → nenhum resultado
```

Zero ocorrências de `: any` em qualquer arquivo de hooks, lib, components ou app. Consistent com `strict: true` no tsconfig.

---

## Resumo de Ações Necessárias

| Prioridade | Item | Ação |
|-----------|------|------|
| Alta | `<ErrorBoundary>` em 3 páginas | Adicionar wrapper em `clientes/[id]`, `os/[id]`, `os/nova` |
| Baixa | Servidor dev com cache stale | `npx next dev -p 3001` ou `npx next start -p 3001` após build |

---

## Conclusão

Sprint 03 em excelente estado técnico: TypeScript sem erros, build limpo, 3 hooks com `apiFetch` centralizado, `useDebounce` sem duplicatas e zero uso de `: any`. Os dois avisos são pontuais: o `<ErrorBoundary>` faltando em 3 páginas de detalhe/formulário (risco de UX em produção) e o servidor dev em :3001 com cache desatualizado (não afeta código-fonte). O primeiro item deve ser corrigido antes do deploy de produção.

**Score final: 7/9 checks passando | 2 avisos | 0 falhas de compilação**
