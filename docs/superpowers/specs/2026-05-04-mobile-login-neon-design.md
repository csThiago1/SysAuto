# Mobile Login — Design Neon (estilo Keycloak)

**Data:** 2026-05-04
**Escopo:** Reescrever a tela de login mobile com visual neon idêntico ao tema Keycloak

---

## 1. Problema

A tela de login mobile atual (`apps/mobile/app/(auth)/login.tsx`) tem fundo claro (#f9fafb) e visual genérico, completamente desalinhado do tema Keycloak (fundo #0a0a0a, listras neon #cc4444 animadas, labels mono, glow vermelho) e do design system dark do app.

---

## 2. Design

### Layout

Tela fullscreen, fundo #0a0a0a, sem scroll. Elementos centralizados verticalmente:

```
┌─────────────────────────────┐
│  ~~~~ listras neon ~~~~     │
│                             │
│       [Logo DS Car]         │
│       ── divider ──         │
│                             │
│    Bem-vindo de volta       │
│  ACESSE SUA CONTA PARA...  │
│                             │
│  E-MAIL                    │
│  [________________]         │
│                             │
│  SENHA                     │
│  [________________]         │
│                             │
│  [     ENTRAR      ]        │
│                             │
│    PADDOCK SOLUTIONS        │
│  ~~~~ listras neon ~~~~     │
└─────────────────────────────┘
```

### Listras Neon

- 6 linhas horizontais + 4 linhas verticais
- Cada listra: `View` com `LinearGradient` (transparent → #cc4444 → #ff4444 → #cc4444 → transparent)
- Espessura: 0.5px (horizontal) / largura 0.5px (vertical)
- Animação: `Animated.loop` com `translateX` (horizontal) ou `translateY` (vertical)
- Duração: 3.5s–5s com delays variados
- Opacity: 0.5–0.7
- Shadow: glow sutil via `shadowColor: '#cc4444'`

### Logo

- Usar imagem existente: `assets/logo-dscar.png` (ou a que existir no projeto mobile)
- Aplicar `tintColor: '#fff'` para inverter (logo branca em fundo escuro)
- Largura: ~180px
- Abaixo: divider 40×2px com gradiente vermelho

### Textos

- "Bem-vindo de volta" — 15px, weight 600, cor rgba(255,255,255,0.85)
- "ACESSE SUA CONTA PARA CONTINUAR" — Typography.labelMono, cor rgba(255,255,255,0.25)

### Inputs

- Background: rgba(255,255,255,0.04)
- Border: 1px solid #222
- BorderRadius: 9px
- Height: 46px
- Color texto: #fff
- Placeholder: #333
- Focus: borderColor #ea0e03, background rgba(234,14,3,0.04), shadow 0 0 0 3px rgba(234,14,3,0.08)
- Labels: Typography.labelMono (#cc4444, 10px, mono, uppercase)

### Botão "ENTRAR"

- Background: LinearGradient(135deg, #ea0e03, #c50b02)
- Height: 48px
- BorderRadius: 9px
- Shadow: 0 0 24px rgba(234,14,3,0.35)
- Texto: #fff, 14px, weight 700, letterSpacing 0.4

### Erro

- Background: SemanticColors.error.bg
- Border: 1px solid SemanticColors.error.border
- Texto: SemanticColors.error.color
- BorderRadius: 8px

### Footer

- "PADDOCK SOLUTIONS"
- Typography.labelMono style
- Cor: rgba(255,255,255,0.15)
- Posicionado com `marginTop: 'auto'`

### Hint Dev

- Manter o hint "__DEV__: qualquer email + paddock123" abaixo do footer
- Cor rgba(255,255,255,0.1)

---

## 3. Implementação

### Componente `NeonLines`

Criar componente reutilizável `apps/mobile/src/components/ui/NeonLines.tsx` que renderiza as listras animadas. Recebe prop opcional `count` (default 10 linhas totais: 6h + 4v).

Cada listra é um `Animated.View` com:
- Posição absoluta, top/left randomizados por config
- `Animated.loop` + `Animated.timing` para translate
- `LinearGradient` da expo-linear-gradient para o gradiente

### Arquivo modificado

`apps/mobile/app/(auth)/login.tsx` — reescrita completa mantendo:
- Mesmo fluxo de auth (useAuth hook, loginDev)
- Mesmo store (useAuthStore)
- Mesma lógica de erro e loading

---

## 4. Padrões

- **DS-L1:** Login usa tokens de `@/constants/theme` (SemanticColors, Typography, Colors) — nunca hardcodar cores
- **DS-L2:** `NeonLines` é reutilizável — pode ser usado em splash screen ou onboarding futuro
- **DS-L3:** Inputs seguem o padrão do tema Keycloak (fundo sutil, border #222, glow vermelho no focus)
