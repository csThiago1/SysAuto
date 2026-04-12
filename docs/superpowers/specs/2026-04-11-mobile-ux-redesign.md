# Mobile UX Redesign — DS Car App
**Data:** 2026-04-11
**Escopo:** Navigation fixes + Visual redesign (evolução + novo design)
**App:** `apps/mobile` (Expo SDK 55 · React Native 0.83 · Expo Router v4)

---

## 1. Problemas que este spec resolve

| # | Problema | Impacto |
|---|----------|---------|
| 1 | `PillTabBar` visível em telas de detalhe (OS detail, Checklist, Camera) | Navbar sobrepõe conteúdo |
| 2 | Back buttons usam `router.back()` sem destino explícito | Navegação imprevisível |
| 3 | Lista de OS sem hierarquia visual clara | Visual genérico, difícil de escanear |
| 4 | Navbar atual (pill escuro) sem contexto para o usuário | Sem feedback de onde está |

---

## 2. Design Aprovado

### 2.1 Novo Componente: `FrostedNavBar`

Substitui o `PillTabBar` existente. Características:

**Visual:**
- Fundo: `rgba(255,255,255,0.72)` com `backdropFilter: blur(24px) saturate(180%)`
- Borda: `1px solid rgba(255,255,255,0.6)`
- Sombra: `0 8px 32px rgba(0,0,0,0.18)`
- Border radius: 32px
- Posição: absoluta, bottom 16px, margem horizontal 12px

**Bubble deslizante (indicador do tab ativo):**
- Cor: `#e31b1b` (vermelho DS Car)
- Glow: `box-shadow: 0 0 20px rgba(227,27,27,0.5)`
- Animação: spring — `cubic-bezier(0.34, 1.56, 0.64, 1)` com 350ms
- Desliza horizontalmente entre tabs via `Animated.Value` (posição + largura)

**Tabs:**
- Ícone + label no tab ativo; só ícone nos demais
- Label aparece com animação de `maxWidth` 0→60 + `opacity` 0→1
- Ícone ativo: `rgba(255,255,255,0.95)`, escala 1.05
- Ícone inativo: `#94a3b8`

**Botão central (Nova OS):**
- Sempre vermelho sólido `#e31b1b`, não participa da animação da bubble
- Sombra: `0 4px 16px rgba(227,27,27,0.5)`
- Ligeiramente maior (48×48) que os outros tabs (44px height)

**Haptic:** `Haptics.impactAsync(ImpactFeedbackStyle.Light)` em cada toque

### 2.2 Navbar: visibilidade por tela

A navbar **aparece** apenas nas telas-raiz do tab navigator:

| Tela | Navbar |
|------|--------|
| OS List (`os/index`) | ✅ visível |
| Busca | ✅ visível |
| Nova OS | ✅ visível |
| Notificações | ✅ visível |
| Perfil | ✅ visível |
| OS Detail (`os/[id]`) | ❌ oculta |
| Checklist (`checklist/[osId]`) | ❌ oculta |
| Camera | ❌ oculta |

**Implementação:** o `(app)/_layout.tsx` passa a usar `tabBar` prop do Expo Router que checa a rota ativa. Rotas de detalhe ficam fora do grupo de tabs ou recebem `tabBarStyle: { display: 'none' }` via context.

### 2.3 Back buttons — destinos explícitos

Regra: nenhuma tela usa `router.back()` sem fallback explícito.

| Tela | Destino do back |
|------|----------------|
| OS Detail | `router.replace('/(app)/os')` |
| Checklist | `router.replace('/(app)/os/' + osId)` |
| Camera | `router.replace('/(app)/checklist/' + osId)` (já implementado) |

O back button mostra o nome da tela de origem (ex: "Ordens de Serviço"), não apenas "Voltar".

### 2.4 Header da Lista de OS — redesign

Substitui o header branco simples por um header escuro imersivo:

```
background: linear-gradient(165deg, #0f172a → #1e293b)
```

**Estrutura:**
```
┌─────────────────────────────┐
│ 9:41                   ●●●  │  ← status bar area
│                             │
│ Bom dia, Thiago 👋          │  ← greeting (nome do usuário)
│ DS Car                      │  ← nome da empresa (tenant)
│                             │
│ [12 Abertas] [3 Prontas] [2⚠]│  ← stat chips
└─────────────────────────────┘
```

- `greeting`: `session.user.name` (primeiro nome)
- `appName`: `session.activeCompany` display name
- Stat chips: contagens vindas do hook `useServiceOrders` (abertas, prontas, atrasadas)
- "Atrasadas": OS com `status !== 'delivered' && status !== 'cancelled'` abertas há > 5 dias

### 2.5 Cards de OS — redesign

**Borda esquerda colorida por status** (4px, border-radius 2px):

| Status | Cor |
|--------|-----|
| reception, initial_survey, final_survey | `#3b82f6` (azul) |
| budget, waiting_approval, waiting_parts | `#f59e0b` (âmbar) |
| approved, in_progress | `#22c55e` (verde) |
| ready | `#10b981` (teal) |
| delivered | `#94a3b8` (cinza) |
| cancelled | `#ef4444` (vermelho) |

**Layout do card (sem border externo, só sombra):**
```
[borda] [num]  [tempo atrás]
        [placa monospace]
        [cliente · veículo]
        [badge status]  [valor R$]
```

- `box-shadow: 0 2px 10px rgba(0,0,0,0.06)` — sem `border: 1px solid`
- Border radius: 16px
- Padding: 14px 16px

---

## 3. Arquitetura de Componentes

### Novos / modificados

```
src/components/navigation/
  FrostedNavBar.tsx          ← NOVO — substitui PillTabBar
  GlowEffect.tsx             ← mantém (reutilizado no bubble)

app/(app)/_layout.tsx        ← MODIFICA — usa FrostedNavBar, lógica de visibilidade

app/(app)/os/index.tsx       ← MODIFICA — novo header escuro + cards redesenhados
app/(app)/os/[id].tsx        ← MODIFICA — back button explícito
app/(app)/checklist/[osId].tsx ← MODIFICA — back button explícito
```

### `FrostedNavBar` — props

```typescript
interface FrostedNavBarProps {
  state: TabNavigationState;       // do Expo Router
  descriptors: TabDescriptors;
  navigation: NavigationHelpers;
}
```

Internamente mantém `Animated.Value` para posição e largura da bubble, recalcula nos itens visíveis (exclui rotas ocultas: os, checklist, camera).

---

## 4. Animações

| Elemento | Animação | Duração | Easing |
|----------|----------|---------|--------|
| Bubble position | spring slide | 350ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| Bubble width | spring expand | 350ms | mesmo |
| Label opacity | fade in/out | 200ms | `ease` |
| Label maxWidth | expand/collapse | 300ms | spring |
| Icon scale | 1 → 1.05 (ativo) | 200ms | ease |
| Tap press | scale 1 → 0.92 → 1 | 150ms | spring |

---

## 5. O que NÃO muda neste sprint

- Telas de Checklist (fotográfico + itens) — já entregues no Sprint M4
- Tela de Camera — só o back button muda
- Tela de Perfil — só visual menor (sem redesign)
- Backend — nenhuma mudança
- Paleta de cores primárias (`#e31b1b`) — mantida
- Sistema de tipografia (`Text` variants) — mantido

---

## 6. Critérios de Aceite

- [ ] Navbar não aparece nas telas de detalhe (OS detail, checklist, camera)
- [ ] Back button sempre navega para destino correto, exibe nome da tela de origem
- [ ] Bubble desliza com animação spring ao trocar tab
- [ ] Label visível só no tab ativo, some com animação nos demais
- [ ] Glow vermelho visível no tab ativo
- [ ] Navbar translúcida — conteúdo visível através dela
- [ ] Header da lista de OS escuro com greeting + nome da empresa + 3 stats
- [ ] Cards com borda colorida de status (sem border externo)
- [ ] Haptic feedback em cada toque no navbar
- [ ] Funciona em iOS e Android
