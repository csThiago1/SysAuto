# Áreas do ERP — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dividir o menu do ERP em quatro áreas (Oficina, Comercial, Financeiro, Gestão), cada uma com seu menu e sua tela inicial, sem mudar nenhuma URL e com cada aba do navegador guardando a própria área.

**Architecture:** a área é um rótulo de cada item de `nav-config.ts` mais uma tabela de rota → área num arquivo novo (`areas.ts`). Um hook (`useActiveArea`) decide a área da aba: pela rota quando ela é de uma área só, senão pela última área guardada no `sessionStorage` da aba, senão pela área padrão do papel. A Sidebar, o sheet "Mais" do celular e a paleta de comandos passam a mostrar só a área ativa, com um seletor de área.

**Tech Stack:** Next.js (App Router) + TypeScript strict, next-auth, vitest + Testing Library. Só frontend (`apps/dscar-web`).

**Spec:** `docs/superpowers/specs/2026-11-25-areas-e-tempo-real-design.md`. Este plano cobre só a seção "1. Áreas". O tempo real fica para depois da mudança para a VM A1.

## Global Constraints

- As URLs não mudam: nenhuma rota é renomeada nem movida.
- A área esconde itens do menu, mas não bloqueia acesso. O filtro por papel e permissão (`visibleSections`) continua aplicado por cima, e o `middleware.ts` continua com as mesmas regras.
- Nenhum item novo no menu: telas fora do menu hoje (apontamento, capacidade, `/orcamentos`, benchmark, auditoria, configuração do motor) só ganham área na tabela de rotas.
- Celular: as abas fixas de `MOBILE_TABS` não mudam. O seletor de área entra no sheet "Mais", que continua só para MANAGER+.
- Cada aba guarda a própria área no `sessionStorage`, chave `dscar-area`. Ler e gravar sempre com try/catch, porque pode falhar em aba privada.
- TypeScript strict, sem `any`. Rótulos em PT-BR.
- Comandos rodam em `apps/dscar-web`: `npx vitest run <arquivos>`, `npx tsc --noEmit`, `npx next lint --file <arquivos>`.

## Review Focus

1. **Rota de uma área para a qual o usuário não tem permissão** (ex.: CONSULTANT sem `can_view_financial` abrindo `/financeiro` por link). Espera-se que o menu não fique vazio: mostra o seletor e a área padrão do papel. Teste na Task 2 (`useActiveArea` cai na área padrão quando a área da rota não está em `visibleAreas`).
2. **`sessionStorage` indisponível** (aba privada, bloqueio de cookies). Espera-se que o menu continue funcionando, usando a área da rota ou a padrão. Teste na Task 2.
3. **Valor inválido guardado** (ex.: `dscar-area=xyz` de uma versão antiga). Espera-se que seja ignorado. Teste na Task 2.
4. **Detalhe da OS (`/os/123`) aberto a partir do Comercial.** Espera-se que o menu continue no Comercial. Teste na Task 1 (`areaOfPath("/os/123") === null`) e na Task 2 (rota compartilhada mantém a área guardada).
5. **Raiz `/` e retorno do login.** Espera-se cair na tela inicial da área padrão do papel, sem loop de redirecionamento. Teste na Task 1 (`areaHome(defaultAreaForRole(...))`); a conferência no navegador fica na Task 5.

---

### Task 1: Áreas e tabela de rotas

**Files:**
- Create: `apps/dscar-web/src/components/dock/areas.ts`
- Modify: `apps/dscar-web/src/components/dock/nav-config.ts` (campo `area` em `NavItem` e em cada item de `NAV_SECTIONS`)
- Test: `apps/dscar-web/src/components/dock/areas.test.ts`

**Interfaces:**
- Produces (em `areas.ts`):
  - `type AreaId = "oficina" | "comercial" | "financeiro" | "gestao"`
  - `const AREAS: readonly { id: AreaId; label: string; home: string }[]`, nesta ordem e com estes valores:
    - `oficina`, "Oficina", `/os/kanban`
    - `comercial`, "Comercial", `/crm/retornos`
    - `financeiro`, "Financeiro", `/financeiro`
    - `gestao`, "Gestão", `/dashboard`
  - `isAreaId(value: unknown): value is AreaId`
  - `areaHome(area: AreaId): string`
  - `areaOfPath(pathname: string): AreaId | null`. Devolve `null` para rota compartilhada ou desconhecida.
  - `defaultAreaForRole(role: string | undefined): AreaId`. OWNER e ADMIN → `gestao`; qualquer outro papel ou `undefined` → `oficina`.
  - `sectionsForArea(role: PaddockRole, perms: ExtraPermission[], area: AreaId): NavSection[]`. É `visibleSections` com os itens filtrados pela área, descartando seções vazias.
  - `visibleAreas(role: PaddockRole, perms: ExtraPermission[]): AreaId[]`. Áreas com pelo menos um item visível, na ordem de `AREAS`.
- Produces (em `nav-config.ts`): `NavItem.area: AreaId`, obrigatório.

**Tabela de rotas de `areaOfPath`.** Prefixo no sentido de `isActiveRoute`: casa a rota igual ou a rota seguida de `/`. Vence o prefixo mais longo.

| Prefixo | Área |
|---|---|
| `/os`, `/os/kanban`, `/os/nova`, `/agenda`, `/recepcao`, `/apontamento`, `/capacidade`, `/orcamentos`, `/estoque`, `/compras`, `/oficina` | oficina |
| `/crm`, `/orcamentos-particulares`, `/comercial` | comercial |
| `/financeiro`, `/fiscal`, `/rh` | financeiro |
| `/dashboard`, `/configuracoes`, `/configuracao-motor`, `/benchmark`, `/auditoria`, `/gestao` | gestao |

São compartilhadas (devolvem `null`), e a regra vale antes da tabela:
- `/^\/os\/\d+(\/|$)/`: detalhe da OS e sub-rotas, como a vistoria;
- `/cadastros`;
- `/veiculos`;
- `/`;
- qualquer rota fora da tabela.

**Área de cada item de `NAV_SECTIONS`:**
- `dashboard` → gestao
- `os` → oficina
- `agenda` → oficina
- `orcamentos-particulares` → comercial
- `cadastros` → gestao
- `crm` → comercial
- `financeiro` → financeiro
- os itens de FISCAL e RH → financeiro
- os itens de ESTOQUE e COMPRAS → oficina
- `configuracoes` → gestao

- [ ] **Step 1: Write the failing test** em `areas.test.ts`:

```ts
describe("areaOfPath", () => {
  it("mapeia rotas de uma área só", () => {
    expect(areaOfPath("/os/kanban")).toBe("oficina");
    expect(areaOfPath("/os")).toBe("oficina");
    expect(areaOfPath("/os/nova")).toBe("oficina");
    expect(areaOfPath("/estoque/produtos/pecas")).toBe("oficina");
    expect(areaOfPath("/crm/regras")).toBe("comercial");
    expect(areaOfPath("/orcamentos-particulares/12")).toBe("comercial");
    expect(areaOfPath("/orcamentos")).toBe("oficina");
    expect(areaOfPath("/fiscal/resumo")).toBe("financeiro");
    expect(areaOfPath("/configuracoes/permissoes")).toBe("gestao");
  });
  it("rota compartilhada ou desconhecida devolve null", () => {
    expect(areaOfPath("/os/123")).toBeNull();
    expect(areaOfPath("/os/123/vistoria")).toBeNull();
    expect(areaOfPath("/cadastros/42")).toBeNull();
    expect(areaOfPath("/veiculos")).toBeNull();
    expect(areaOfPath("/")).toBeNull();
    expect(areaOfPath("/sobre")).toBeNull();
  });
  it("não confunde prefixo parcial", () => {
    expect(areaOfPath("/osx")).toBeNull();
    expect(areaOfPath("/financeiro-x")).toBeNull();
  });
});

describe("áreas e papéis", () => {
  it("área padrão do papel", () => {
    expect(defaultAreaForRole("OWNER")).toBe("gestao");
    expect(defaultAreaForRole("ADMIN")).toBe("gestao");
    expect(defaultAreaForRole("CONSULTANT")).toBe("oficina");
    expect(defaultAreaForRole(undefined)).toBe("oficina");
    expect(areaHome(defaultAreaForRole("OWNER"))).toBe("/dashboard");
  });
  it("STOREKEEPER não vê a área Financeiro", () => {
    expect(visibleAreas("STOREKEEPER", [])).not.toContain("financeiro");
    expect(visibleAreas("OWNER", [])).toEqual(["oficina", "comercial", "financeiro", "gestao"]);
  });
  it("sectionsForArea só traz itens da área", () => {
    const ids = sectionsForArea("OWNER", [], "comercial").flatMap((s) => s.items.map((i) => i.id));
    expect(ids).toEqual(["orcamentos-particulares", "crm"]);
  });
  it("todo href do menu cai na área do item ou numa rota compartilhada", () => {
    for (const s of NAV_SECTIONS) for (const item of s.items) {
      const hrefs = [item.href, ...(item.children ?? []).map((c) => c.href)].filter(Boolean) as string[];
      for (const h of hrefs) expect([item.area, null]).toContain(areaOfPath(h.split("?")[0]!));
    }
  });
  it("isAreaId rejeita lixo", () => {
    expect(isAreaId("comercial")).toBe(true);
    expect(isAreaId("xyz")).toBe(false);
    expect(isAreaId(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/components/dock/areas.test.ts`. Expected: FAIL (módulo `./areas` não existe).
- [ ] **Step 3: Implement** `areas.ts` e o campo `area` em `NavItem` e em cada item de `NAV_SECTIONS`, conforme as tabelas acima. Para evitar import circular, `areas.ts` importa `NAV_SECTIONS` e `visibleSections` de `nav-config.ts`, e `nav-config.ts` importa só o tipo `AreaId` (`import type`).
- [ ] **Step 4: Run** `npx vitest run src/components/dock/areas.test.ts src/components/dock/nav-config.test.ts` e `npx tsc --noEmit`. Expected: PASS, sem erro de tipo.
- [ ] **Step 5: Commit** `feat(dscar): áreas do ERP e tabela de rotas`

### Task 2: Área ativa por aba

**Files:**
- Create: `apps/dscar-web/src/components/dock/useActiveArea.ts`
- Test: `apps/dscar-web/src/components/dock/useActiveArea.test.tsx`

**Interfaces:**
- Consumes: `AreaId`, `areaOfPath`, `defaultAreaForRole`, `visibleAreas`, `areaHome`, `isAreaId` (Task 1).
- Produces: `useActiveArea(): { area: AreaId; areas: AreaId[]; setArea: (a: AreaId) => void }`. Hook client-side. Usa `usePathname`, `useRouter` e `useSession`; papel e permissões vêm do mesmo lugar que a Sidebar usa (`session.role`, `session.extraPermissions`).

Regra de `area`, em ordem:
1. `areaOfPath(pathname)`, se não for `null` e estiver em `areas`;
2. senão, o valor de `sessionStorage["dscar-area"]`, se `isAreaId` e estiver em `areas`;
3. senão, `defaultAreaForRole(role)`, se estiver em `areas`;
4. senão, `areas[0] ?? "oficina"`.

Leitura e gravação do storage:
- O `sessionStorage` é lido depois de montar (`useEffect`/estado), para não quebrar a hidratação. No primeiro render, a regra roda sem o passo 2.
- Quando o passo 1 decide a área, ela é gravada no storage.
- `setArea(a)` grava `a` e faz `router.push(areaHome(a))`.
- Toda leitura e gravação fica em try/catch; se der erro, segue sem storage.

- [ ] **Step 1: Write the failing test** com `renderHook`, mockando `next/navigation` (pathname controlável, `useRouter().push` espião) e `next-auth/react` (papel controlável). Casos:
  - `"/crm/retornos"`, OWNER → `area === "comercial"` e `sessionStorage.getItem("dscar-area") === "comercial"`.
  - `"/os/123"`, com `dscar-area = "comercial"` gravado antes → `"comercial"`.
  - `"/os/123"`, sem nada gravado, OWNER → `"gestao"`; CONSULTANT → `"oficina"`.
  - `"/os/123"`, com `dscar-area = "xyz"` → área padrão do papel.
  - `"/financeiro"`, CONSULTANT sem `can_view_financial` → `"oficina"`, e `areas` não contém `"financeiro"`.
  - `sessionStorage.getItem` e `setItem` lançando erro (`vi.spyOn(Storage.prototype, ...)`), em `"/os/123"` com OWNER → `"gestao"`, sem exceção.
  - `setArea("financeiro")` → `push("/financeiro")` e storage `"financeiro"`.
  - Limpar o `sessionStorage` em `beforeEach`.
- [ ] **Step 2: Run** `npx vitest run src/components/dock/useActiveArea.test.tsx`. Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implement** `useActiveArea` conforme a regra acima.
- [ ] **Step 4: Run** o mesmo comando. Expected: PASS.
- [ ] **Step 5: Commit** `feat(dscar): área ativa guardada por aba`

### Task 3: Menu por área (Sidebar, celular, paleta)

**Files:**
- Create: `apps/dscar-web/src/components/dock/AreaSwitcher.tsx`
- Modify: `apps/dscar-web/src/components/dock/Sidebar.tsx`. Remover a constante `OFICINA` e o bloco "Oficina"/"Gestão" (linhas ~37 e ~125–171). No lugar, o seletor e os itens de `sectionsForArea(role, perms, area)`.
- Modify: `apps/dscar-web/src/components/dock/MobileTabBar.tsx`. `rest` passa a ser `sectionsForArea(...).flatMap(s => s.items)` (ainda só para MANAGER+). O `AreaSwitcher` entra no sheet "Mais", acima de "Módulos", também só para MANAGER+.
- Modify: `apps/dscar-web/src/components/CommandPalette.tsx`. A lista passa a vir de `sectionsForArea(role, perms, area)` em vez do filtro próprio por `minRole`. Com isso a paleta também passa a respeitar `requiredPermission`, como a Sidebar.
- Test: `apps/dscar-web/src/components/dock/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `useActiveArea` (Task 2); `AREAS`, `sectionsForArea` (Task 1).
- Produces: `AreaSwitcher(props: { area: AreaId; areas: AreaId[]; onChange: (a: AreaId) => void; className?: string }): React.ReactElement`. Grupo de botões com `role="tablist"`/`role="tab"` e `aria-selected` na área ativa, rótulos de `AREAS`. Só desenha as áreas de `areas`. Visual no estilo atual do menu (`text-[13px]`, `rounded-sm`, `bg-muted/60` na ativa), sem tela nova para aprovar.

- [ ] **Step 1: Write the failing tests** em `Sidebar.test.tsx`. O teste atual continua: STOREKEEPER em `/os/kanban`, Kanban aceso, Financeiro ausente, sem "Nova OS". Acrescentar, tornando `usePathname` e o papel do mock controláveis por teste:
  - OWNER em `/os/kanban`: `getByRole("tab", { name: "Oficina" })` com `aria-selected="true"`; existe link "Kanban"; não existe link "Retornos".
  - OWNER em `/crm/retornos`: tab "Comercial" selecionada; existe link "Retornos"; não existe link "Kanban".
  - STOREKEEPER: `queryByRole("tab", { name: "Financeiro" })` não existe.
  - OWNER, clique na tab "Financeiro" → `push("/financeiro")`.
- [ ] **Step 2: Run** `npx vitest run src/components/dock/Sidebar.test.tsx`. Expected: os casos novos FAIL.
- [ ] **Step 3: Implement** `AreaSwitcher` e as mudanças em Sidebar, MobileTabBar e CommandPalette. O botão "Nova OS" e o placar continuam como estão, em todas as áreas.
- [ ] **Step 4: Run** `npx vitest run src/components/dock src/components/CommandPalette*` (se houver teste da paleta) e `npx tsc --noEmit`. Expected: PASS. Rodar também `MobileTabBar.test.tsx`: se ele afirmar algo sobre a lista completa de módulos no "Mais", ajustar a expectativa para a área ativa.
- [ ] **Step 5: Commit** `feat(dscar): menu mostra só a área ativa, com seletor de área`

### Task 4: Telas iniciais das áreas e entrada pela raiz

**Files:**
- Create: `apps/dscar-web/src/app/(app)/oficina/page.tsx`, `apps/dscar-web/src/app/(app)/comercial/page.tsx` e `apps/dscar-web/src/app/(app)/gestao/page.tsx`. Cada um é um server component que só faz `redirect(areaHome("<área>"))`. `/financeiro` já existe e não muda.
- Modify: `apps/dscar-web/src/app/(app)/page.tsx`. `const session = await auth()`, depois `redirect(areaHome(defaultAreaForRole(session?.role)))`. Mesmo padrão de `auth()` de `os/[numero]/page.tsx`.
- Modify: `apps/dscar-web/src/middleware.ts:33`. O redirecionamento de usuário logado em página de login passa de `/dashboard` para `/`. A linha 57 (sem permissão para abrir OS → `/dashboard`) não muda.

**Interfaces:**
- Consumes: `areaHome`, `defaultAreaForRole` (Task 1).

- [ ] **Step 1: Write the failing test** `apps/dscar-web/src/app/(app)/page.test.ts`. Mockar `@/lib/auth` (`auth` devolvendo `{ role }`) e `next/navigation` (`redirect` espião que lança, como o real). Casos:
  - OWNER → `redirect("/dashboard")`;
  - CONSULTANT → `redirect("/os/kanban")`;
  - sessão `null` → `redirect("/os/kanban")`.
- [ ] **Step 2: Run** `npx vitest run "src/app/(app)/page.test.ts"`. Expected: FAIL (hoje sempre redireciona para `/dashboard`).
- [ ] **Step 3: Implement** as quatro páginas e a linha do middleware.
- [ ] **Step 4: Run** o teste, `npx tsc --noEmit` e `npx next lint --file` nos arquivos tocados. Expected: PASS.
- [ ] **Step 5: Commit** `feat(dscar): telas iniciais por área e entrada pela área do papel`

### Task 5: Conferência no navegador e PR

**Files:** nenhum código novo, só a verificação.

- [ ] **Step 1:** Subir o frontend (`npm run dev` em `apps/dscar-web`, porta 3001) com o backend local do docker (`paddock_django`). Entrar com o admin do seed (`backend/core/setup_tenant.py`).
- [ ] **Step 2:** Duas abas:
  - Aba A em `/os/kanban`: o menu mostra Oficina.
  - Aba B: seletor → Comercial, cai em `/crm/retornos`.
  - Na aba B, abrir uma OS pelo endereço (`/os/<numero>`): o menu continua Comercial.
  - Voltar à aba A e recarregar: continua Oficina.
- [ ] **Step 3:**
  - `/` com o admin cai na tela inicial da área do papel.
  - `/oficina`, `/comercial` e `/gestao` redirecionam para a tela inicial certa.
  - `/confirmar-checklist` e `/convite/<token>` continuam abrindo como antes.
- [ ] **Step 4:** Celular (`resize_window` mobile), com um usuário MANAGER+: o "Mais" mostra o seletor e só os módulos da área ativa; as abas fixas não mudaram.
- [ ] **Step 5:** Rodar `npx vitest run` (suíte do dscar-web) e `npx tsc --noEmit`. Abrir o PR contra `main`, com capturas das duas abas e do celular.
