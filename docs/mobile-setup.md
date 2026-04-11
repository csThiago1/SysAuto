# Mobile Setup — DS Car App
# docs/mobile-setup.md
# Paddock Solutions · Abril 2026
# ─────────────────────────────────────────────────────────────────────────────

## Stack

| Item | Versão | Observação |
|------|--------|-----------|
| Expo SDK | 55.0.14 | Alinhado com React 19 do monorepo |
| React Native | 0.83.4 | |
| React | 19.2.5 | Deve ser igual ao `react-dom` |
| Expo Router | ~55.0.12 | File-based routing |
| react-native-reanimated | 4.2.1 | Requer `react-native-worklets` |
| react-native-worklets | 0.7.2 | Pinado via override no root |
| Zustand | 5.x | State management + persist |
| TanStack Query | 5.x | Server state / API calls |

---

## Como Rodar

### Web (browser — para desenvolvimento rápido)
```bash
cd apps/mobile
npx expo start --web --clear
# Acessa http://localhost:8081/login
```

### Simulador iOS (requer Xcode)
```bash
cd apps/mobile
npx expo start --ios --clear
# OU via script do root:
npm run mobile:ios
```

### Simulador Android (requer Android Studio)
```bash
cd apps/mobile
npx expo start --android --clear
```

### Celular físico via USB (build nativo)
```bash
# iOS
cd apps/mobile && npx expo run:ios --device

# Android
cd apps/mobile && npx expo run:android --device
```

> **Importante:** Sempre rodar a partir de `apps/mobile`, nunca da raiz do monorepo.
> Scripts convenientes no root: `npm run mobile`, `npm run mobile:web`, `npm run mobile:ios`

### Expo Go
Não funciona com SDK 55 na versão atual do Expo Go disponível na App Store.
Usar simulador ou build nativo (`expo run:ios / run:android`).

---

## Distribuição Interna (35 funcionários)

| Plataforma | Método | Custo | Processo |
|------------|--------|-------|---------|
| Android (~25) | APK via EAS Build | Grátis | EAS gera APK → link no WhatsApp → habilitar "fontes desconhecidas" uma vez |
| iOS (~10) | TestFlight | $99/ano (Apple Developer) | EAS gera build → convite por email → funcionário instala TestFlight uma vez |

```bash
# Gerar builds (quando o app estiver pronto)
npm install -g eas-cli
eas login
eas build --platform android --profile preview  # APK Android
eas build --platform ios --profile preview       # TestFlight iOS
```

---

## Problemas Encontrados e Soluções

### 1. Metro sem suporte a monorepo

**Sintoma:** `Unable to resolve "@paddock/types"`, `Unable to resolve "@react-navigation/bottom-tabs"` e outros pacotes que estão no `node_modules` da raiz.

**Causa:** O `metro.config.js` original não configurava `watchFolders` nem `nodeModulesPaths` para o monorepo.

**Solução:** `apps/mobile/metro.config.js`
```js
config.watchFolders = [path.resolve(monorepoRoot, 'packages')];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
```

> **Atenção:** `watchFolders` deve apontar apenas para `packages/`, não para o root inteiro. Assistir o root causa **refresh loop** no simulador porque o Metro detecta mudanças nas apps Next.js, backend Python, etc.

---

### 2. Dependências nativas duplicadas

**Sintoma:** `expo-doctor` reportava duplicatas de `react-native-safe-area-context`, `react-native-screens` e `react-native-worklets` com versões diferentes no `apps/mobile/node_modules` e no root `node_modules`.

**Causa:** npm workspaces hoistava versões mais novas para o root, enquanto `expo install` gravava versões mais antigas localmente no mobile.

**Solução:** Adicionar `overrides` no root `package.json` para forçar versões únicas em todo o monorepo:
```json
"overrides": {
  "react-native-safe-area-context": "5.6.2",
  "react-native-screens": "4.23.0",
  "react-native-worklets": "0.7.2"
}
```
Depois remover as cópias locais duplicadas e rodar `npm install` do root.

---

### 3. `expo-secure-store` quebrando na web

**Sintoma:** App travava ao carregar na web. `SecureStore.getItemAsync` não funciona em browser.

**Causa:** O `auth.store.ts` e `useAuth.ts` usavam `expo-secure-store` diretamente sem verificar a plataforma.

**Solução:** Usar `Platform.OS` para escolher o storage correto:
```ts
const secureStorage =
  Platform.OS === 'web'
    ? {
        getItem: (name: string) => localStorage.getItem(name),
        setItem: (name: string, value: string) => localStorage.setItem(name, value),
        removeItem: (name: string) => localStorage.removeItem(name),
      }
    : {
        getItem: (name: string) => SecureStore.getItemAsync(name),
        setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
        removeItem: (name: string) => SecureStore.deleteItemAsync(name),
      };
```

---

### 4. React e react-dom com versões diferentes

**Sintoma:** React error #527 (`args[]=19.2.0&args[]=19.2.5`) durante `expo export --platform web`. SSR falhava silenciosamente.

**Causa:** O override do root pinava `react: 19.2.0` mas `react-dom` estava em `19.2.5` (mais novo, instalado por alguma dependência transitiva). React e react-dom precisam ter versão idêntica.

**Solução:** Alinhar ambos no root `package.json`:
```json
"devDependencies": {
  "react": "19.2.5",
  "react-dom": "19.2.5"
},
"overrides": {
  "react": "19.2.5",
  "react-dom": "19.2.5"
}
```

---

### 5. `import.meta` quebrando o bundle web

**Sintoma:** `Uncaught SyntaxError: Cannot use 'import.meta' outside a module` na linha 164533 do bundle web. App não carregava no browser.

**Causa:** O Metro com `unstable_transformProfile=hermes-stable` não transpila `import.meta`. O Zustand devtools middleware usa `import.meta.env.MODE` (sintaxe Vite/ESM) que é inválida em bundles CommonJS do Metro.

**Solução:** Plugin Babel inline no `babel.config.js` que substitui `import.meta` por um objeto seguro antes do bundle:
```js
function importMetaPlugin() {
  return {
    visitor: {
      MetaProperty(path) {
        const { meta, property } = path.node;
        if (meta.name === 'import' && property.name === 'meta') {
          path.replaceWithSourceString('({"env":{"MODE":"development"},"url":""})');
        }
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [importMetaPlugin],
  };
};
```

---

### 6. `output: static` causando SSR desnecessário em dev

**Sintoma:** Expo Router iniciava o servidor SSR (`@expo/router-server`) em modo dev, causando erros de hidratação e o bundle `AppEntry` sendo carregado duplamente.

**Causa:** `app.json` tinha `"web": {"bundler": "metro", "output": "static"}`. O modo `static` ativa SSR/SSG, que em desenvolvimento causa conflitos com o bundle client-side.

**Solução:** Remover `"output": "static"` do `app.json` para desenvolvimento:
```json
"web": {
  "bundler": "metro"
}
```

---

### 7. Nomes de rotas no Expo Router v4

**Sintoma:** Warnings `[Layout children]: No route named "busca" exists` para todas as tabs exceto `index`.

**Causa:** No Expo Router v4, pastas sem `_layout.tsx` próprio (ex: `busca/index.tsx`) são registradas como `busca/index`, não como `busca`. Apenas pastas com `_layout.tsx` (ex: `os/`, `checklist/`) mantêm o nome curto.

**Solução:** Atualizar `_layout.tsx` e `PillTabBar.tsx` para usar os nomes completos:
```tsx
// _layout.tsx
<Tabs.Screen name="busca/index" />
<Tabs.Screen name="nova-os/index" />
<Tabs.Screen name="notificacoes/index" />
<Tabs.Screen name="perfil/index" />

// PillTabBar.tsx — TAB_CONFIG
{ routeName: 'busca/index', ... }
{ routeName: 'nova-os/index', ... }
{ routeName: 'notificacoes/index', ... }
{ routeName: 'perfil/index', ... }
```

---

### 8. `expo-dev-client` causando runtime "custom" incompatível com Expo Go

**Sintoma:** `[redirect middleware]: Unable to determine redirect location for runtime 'custom' and platform 'ios'`. Expo Go mostrava mensagem de incompatibilidade.

**Causa:** Com `expo-dev-client` instalado, o Expo registra o projeto como runtime "custom" (development build), que é incompatível com Expo Go padrão.

**Solução:** Remover `expo-dev-client` das dependências do `package.json`. Para development builds futuros usar `npx expo run:ios` / `npx expo run:android`.

---

### 9. Servidor rodando do diretório errado

**Sintoma:** `Starting project at .../grupo-dscar` (root) em vez de `.../apps/mobile`. Metro tentava resolver `../../App` que não existe no monorepo root.

**Causa:** Rodar `npx expo start` da raiz do monorepo.

**Solução:** Sempre rodar de `apps/mobile`:
```bash
cd apps/mobile && npx expo start --clear
```
Ou usar os scripts do root:
```bash
npm run mobile        # expo start
npm run mobile:web    # expo start --web
npm run mobile:ios    # expo start --ios
```

---

## Estado Atual (Abril 2026)

| Sprint | Status | Entregue |
|--------|--------|---------|
| M1 — Fundação & Auth | ✅ Completo | Login, AuthGuard, PillTabBar, stores, API client |
| M2 — OS Read-Only | 🔄 Próximo | Lista OS, detalhe, WatermelonDB |
| M3 — Checklist Fotos | ⏳ Planejado | Câmera, marca d'água, upload |
| M4 — Checklist Itens | ⏳ Planejado | Checkboxes, anotações em fotos |
| M5 — Abertura de OS | ⏳ Planejado | Wizard 4 steps, consulta placa |
| M6 — Acompanhamento | ⏳ Planejado | Status updates, notificações push |
| M7 — Assinatura Digital | ⏳ Planejado | Canvas assinatura, PDFs |
| M8 — Polish & Deploy | ⏳ Planejado | EAS Build, distribuição interna |

---

## Referências

- Roadmap completo: `docs/mobile-roadmap.md`
- Spec técnica fase 1: `docs/spec-mobile-phase1.md`
- Metro monorepo (oficial): https://docs.expo.dev/guides/monorepos/
- EAS Build: https://docs.expo.dev/build/introduction/
- TestFlight distribuição: https://docs.expo.dev/submit/ios/

---

*Paddock Solutions · paddock.solutions · Manaus, AM*
*Documento criado em: Abril 2026*
