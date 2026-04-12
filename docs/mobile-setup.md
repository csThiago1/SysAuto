# Mobile — Setup e Estado Funcional
# docs/mobile-setup.md — Paddock Solutions · Abril 2026
# ─────────────────────────────────────────────────────────────────────────────

## Ambiente de Desenvolvimento

| Ferramenta | Versão |
|-----------|--------|
| Node.js | 22.22.2 |
| npm | 10.9.7 |
| Expo CLI | 55.0.23 |
| Expo Go (iOS) | compatível com SDK 55 |
| macOS | Darwin 25.2.0 |

---

## Versões Resolvidas (package-lock.json)

### Core

| Pacote | Versão |
|--------|--------|
| `expo` | 55.0.14 |
| `expo-router` | 55.0.12 |
| `react-native` | 0.83.4 |
| `react` | 19.2.5 |
| `@expo/metro-config` | 55.0.15 |
| `babel-preset-expo` | 55.0.17 |

### Expo Modules

| Pacote | Versão |
|--------|--------|
| `expo-auth-session` | 55.0.13 |
| `expo-camera` | 55.0.15 |
| `expo-constants` | 55.0.13 |
| `expo-crypto` | 55.0.14 |
| `expo-file-system` | 55.0.16 |
| `expo-haptics` | 55.0.14 |
| `expo-image-manipulator` | 55.0.15 |
| `expo-linking` | 55.0.12 |
| `expo-secure-store` | 55.0.13 |
| `@expo/vector-icons` | 15.1.1 |

### React Native

| Pacote | Versão |
|--------|--------|
| `react-native-reanimated` | 4.2.1 |
| `react-native-safe-area-context` | 5.6.2 |
| `react-native-screens` | 4.23.0 |
| `react-native-worklets` | 0.7.2 |
| `react-native-web` | 0.21.2 |
| `react-native-mmkv` | 3.3.3 |
| `@react-native-community/netinfo` | 11.5.2 |

### Libs

| Pacote | Versão |
|--------|--------|
| `@nozbe/watermelondb` | 0.28.0 |
| `@tanstack/react-query` | 5.95.2 |
| `zustand` | 5.0.12 |
| `zod` | 3.24.x |

---

## Overrides no root package.json

Necessários para forçar versões compatíveis em todo o monorepo npm workspaces:

```json
"overrides": {
  "expo": "~55.0.14",
  "expo-modules-core": "~55.0.22",
  "expo-asset": "~55.0.14",
  "expo-font": "~55.0.6",
  "expo-keep-awake": "~55.0.6",
  "expo-constants": "~55.0.13",
  "expo-file-system": "~55.0.16",
  "expo-secure-store": "~55.0.13",
  "expo-camera": "~55.0.15",
  "react": "19.2.5",
  "react-dom": "19.2.5",
  "react-native": "0.83.4",
  "react-native-safe-area-context": "5.6.2",
  "react-native-screens": "4.23.0",
  "react-native-worklets": "0.7.2",
  "@types/react": "~19.2.10"
}
```

---

## Como Rodar

```bash
# A partir de apps/mobile:
node ../../node_modules/.bin/expo start --ios --clear

# Ou via script do root do monorepo:
npm run mobile:ios
```

> **Importante:** usar `node ../../node_modules/.bin/expo` diretamente, NÃO `npx expo`.
> O `npx` (e `npm exec`) escalam o CWD para o workspace root, quebrando o `projectRoot`
> do Metro — o bundler tenta resolver `grupo-dscar/.` como entry point e dá 404.

---

## metro.config.js

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;              // apps/mobile/
const monorepoRoot = path.resolve(projectRoot, '../..');  // grupo-dscar/

const config = getDefaultConfig(projectRoot);

// watchFolders: root node_modules (pacotes hoistados) + packages/ (@paddock/types)
// NÃO incluir apps/ inteiro nem backend/ — causa refresh loop com Next.js/Django
config.watchFolders = [
  path.resolve(monorepoRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'packages'),
];

// Resolve pacotes do root e do próprio mobile (fallback)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Obrigatório para react-native-reanimated e react-native-worklets
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
```

---

## babel.config.js

```js
// importMetaPlugin: substitui import.meta por objeto seguro no bundle web.
// Zustand devtools usa import.meta.env.MODE — Metro/Hermes não transpila isso.
// NÃO remover este plugin.
function importMetaPlugin() { ... }

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      importMetaPlugin,
      // WatermelonDB decorators (@field, @text, @relation, etc.)
      // @nozbe/watermelondb@0.28+ não inclui mais o babel plugin próprio.
      // Usar @babel/plugin-proposal-decorators em modo legacy (Stage 1).
      // NÃO remover este plugin.
      ['@babel/plugin-proposal-decorators', { version: 'legacy' }],
    ],
  };
};
```

---

## tsconfig.json

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "experimentalDecorators": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@paddock/types": ["../../packages/types/src"]
    }
  }
}
```

---

## Workarounds Críticos — Expo Go vs Native

### 1. WatermelonDB — SQLite indisponível no Expo Go

**Problema:** Expo Go não inclui `NativeModules.WMDatabaseBridge` (SQLite). Mesmo com
`jsi: false`, o adapter SQLite tenta chamar o módulo nativo e crasha.

**Fix em `src/db/index.ts`:**

```ts
import { NativeModules, Platform } from 'react-native';

// Usa LokiJS (in-memory) no web e no Expo Go (sem WMDatabaseBridge nativo).
// Builds nativas (EAS Build / expo run:ios) usam SQLite.
const useLoki = Platform.OS === 'web' || !NativeModules.WMDatabaseBridge;

const adapter = useLoki
  ? new (require('@nozbe/watermelondb/adapters/lokijs').default)({
      schema,
      useWebWorker: false,            // React Native não tem web workers — OBRIGATÓRIO
      useIncrementalIndexedDB: false, // sem IndexedDB no RN — OBRIGATÓRIO
    })
  : new (require('@nozbe/watermelondb/adapters/sqlite').default)({
      schema,
      migrations,
      jsi: false, // JSI só com EAS Build — desabilitado para Expo Go
    });
```

**Por que `useWebWorker: false` é obrigatório:**
Sem esse flag, o LokiJS tenta usar `self` (global de web worker), que é `undefined` no
React Native, causando `TypeError: constructor is not callable`.

**Consequência:** LokiJS é in-memory — dados não persistem entre sessões no Expo Go.
Para persistência real, usar `expo run:ios` (development build com SQLite nativo).

---

### 2. react-native-mmkv — JSI indisponível no Expo Go

**Problema:** MMKV usa JSI nativo. Instanciar `new MMKV(...)` no nível do módulo
crasha com `TypeError: Cannot read property 'initializeJSI' of null`, fazendo a
rota inteira falhar ("missing default export").

**Fix em `app/(app)/busca/index.tsx`:**

```ts
// NÃO fazer: import { MMKV } + new MMKV() no nível do módulo
// FAZER: try/catch com fallback in-memory

const _memCache = new Map<string, string>();
let _mmkv: any = null;
try {
  const { MMKV } = require('react-native-mmkv');
  _mmkv = new MMKV({ id: 'search-history' });
} catch {
  // Expo Go — JSI não disponível, histórico fica só em memória
}

const searchStorage = {
  getString: (key: string) => _mmkv ? _mmkv.getString(key) : _memCache.get(key),
  set: (key: string, value: string) => {
    if (_mmkv) _mmkv.set(key, value); else _memCache.set(key, value);
  },
};
```

Em production build (EAS), o MMKV nativo é usado automaticamente.

---

### 3. expo-dev-client — REMOVIDO

Causava runtime "custom" incompatível com Expo Go.
**Não reinstalar** até precisar de development builds oficiais via EAS.

---

## Design System — Cores DS Car

Arquivo central: `src/lib/theme.ts` (espelho de `apps/dscar-web/src/app/globals.css`)

| Token | Hex | Uso |
|-------|-----|-----|
| `primary[600]` | `#e31b1b` | CTAs, ícones ativos, filtros selecionados |
| `primary[700]` | `#c01212` | Pressed/hover states |
| `secondary[950]` | `#141414` | Tab bar, backgrounds escuros |
| `accent[500]` | `#7896a7` | Cinza metálico, destaques neutros |
| `background` | `#f9fafb` | Fundo geral das telas |
| `surface` | `#ffffff` | Cards, modais |
| `border` | `#e5e7eb` | Bordas e separadores |
| `textPrimary` | `#111827` | Texto principal |
| `textSecondary` | `#6b7280` | Texto secundário |

> **Nunca usar roxo `#9333ea`** — era placeholder de desenvolvimento, já substituído.

---

## Estrutura de Arquivos

```
apps/mobile/
├── app/
│   ├── _layout.tsx              ← Root: DatabaseProvider > SafeArea > QueryClient > AuthGuard
│   ├── +not-found.tsx
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx
│   └── (app)/
│       ├── _layout.tsx          ← Tab navigator com PillTabBar customizada
│       ├── index.tsx            ← Redirect → os/index
│       ├── os/
│       │   ├── _layout.tsx
│       │   ├── index.tsx        ← Lista OS: filtros de status + busca + pull-to-refresh
│       │   └── [id].tsx         ← Detalhe da OS
│       ├── busca/index.tsx      ← Busca com histórico (MMKV / fallback in-memory)
│       ├── checklist/
│       │   ├── _layout.tsx
│       │   ├── index.tsx
│       │   └── [osId].tsx
│       ├── nova-os/index.tsx    ← Criação de nova OS
│       ├── notificacoes/index.tsx
│       └── perfil/index.tsx
│
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── OfflineBanner.tsx
│   │   │   └── SyncIndicator.tsx
│   │   ├── navigation/
│   │   │   ├── PillTabBar.tsx   ← Tab bar flutuante animada (Reanimated + Haptics)
│   │   │   └── GlowEffect.tsx
│   │   ├── os/
│   │   │   ├── OSCard.tsx
│   │   │   ├── OSDetailHeader.tsx
│   │   │   └── OSStatusBadge.tsx
│   │   └── ui/
│   │       ├── Badge.tsx
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       └── Text.tsx
│   ├── db/
│   │   ├── index.ts             ← Adapter detection: SQLite (native) vs LokiJS (Expo Go)
│   │   ├── schema.ts
│   │   ├── migrations.ts
│   │   ├── sync.ts              ← WatermelonDB sync com Django backend
│   │   └── models/
│   │       ├── ServiceOrder.ts
│   │       └── ServiceOrderPhoto.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useConnectivity.ts
│   │   ├── usePermission.ts
│   │   ├── useServiceOrders.ts
│   │   └── useSync.ts
│   ├── lib/
│   │   ├── api.ts
│   │   ├── constants.ts
│   │   └── theme.ts             ← Design tokens DS Car
│   └── stores/
│       ├── auth.store.ts        ← Zustand + expo-secure-store (web: localStorage)
│       └── sync.store.ts        ← Estado de sync / conectividade
│
├── assets/                      ← icon.png, splash, adaptive-icon
├── app.json
├── babel.config.js
├── eas.json
├── metro.config.js
├── package.json
└── tsconfig.json
```

---

## app.json — Pontos Importantes

```json
{
  "expo": {
    "scheme": "paddock",           // deep links
    "plugins": ["expo-router", "expo-camera", "expo-secure-store"],
    "web": { "bundler": "metro" }, // SEM "output": "static" — causa SSR desnecessário
    "experiments": { "typedRoutes": true },
    "extra": { "router": { "origin": false } }
  }
}
```

---

## EAS Build

```bash
# Development build (com módulos nativos reais: SQLite, MMKV)
eas build --profile development --platform ios

# Preview (TestFlight interno)
eas build --profile preview --platform ios
```

---

## Expo Go vs Development Build

| Feature | Expo Go | Development Build (EAS) |
|---------|---------|-------------------------|
| WatermelonDB | LokiJS in-memory | SQLite persistente |
| MMKV | Map in-memory | MMKV nativo (JSI) |
| Persistência offline | ❌ não persiste | ✅ persiste |
| expo-camera | ✅ | ✅ |
| expo-secure-store | ✅ | ✅ |
| react-native-reanimated | ✅ | ✅ |
| Como iniciar | `node ../../node_modules/.bin/expo start --ios` | EAS Build → TestFlight |
