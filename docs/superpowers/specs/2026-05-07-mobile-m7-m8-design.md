# Mobile M7 + M8 — Assinatura Digital, Documentos, Build & Polish

**Data:** 2026-05-07
**Escopo:** Sprint M7 (assinatura digital + documentos no mobile) e Sprint M8 (polish visual + build de produção + distribuição interna)

---

## 1. Problema

O app mobile DS Car cobre M1–M6 (auth, OS, checklist, câmera, wizard, vistorias, push) + UX primitives + auditoria de acessibilidade. Faltam dois marcos para lançamento interno (~30 colaboradores):

1. **Assinatura digital** — funcionários precisam assinar uma vez no perfil (reutilizada em documentos), clientes assinam na vistoria de entrada e na entrega do veículo
2. **Documentos** — consultor precisa visualizar e compartilhar PDFs (OS, garantia, recibo) direto do celular via WhatsApp, sem PC
3. **Build de produção** — EAS Build, OTA updates, CI/CD, Sentry, distribuição interna
4. **Polish visual** — itens pendentes do Round 2 (glass cards, animações, tab fotos)

---

## 2. Escopo

### Incluso (M7)
- Componente `SignatureCanvas` reutilizável
- Campo `signature_image` no modelo `Employee` (backend)
- Tela de assinatura no perfil do funcionário (captura única)
- Assinatura do cliente na vistoria de entrada
- Assinatura do cliente na entrega do veículo
- Tab/seção "Documentos" no detalhe da OS (lista, visualização, compartilhamento)

### Incluso (M8)
- Glass cards em Agenda, Notificações e Perfil
- Tab Fotos no OS detail (grid agrupada por pasta)
- Animações de transição entre telas
- Sentry básico (crash reporting + breadcrumbs)
- EAS Build (3 profiles: development, preview, production)
- EAS Update (OTA)
- CI/CD GitHub Actions
- Distribuição interna (APK + TestFlight + QR Code)

### Excluído
- Geração de PDF no device (backend WeasyPrint continua sendo a fonte)
- Performance monitoring Sentry (session replay, traces)
- Publicação em App Store / Google Play
- Testes E2E com Detox/Maestro (backlog pós-lançamento)

---

## 3. M7 — Assinatura Digital

### 3.1 Componente SignatureCanvas

Componente reutilizável para captura de assinatura por toque na tela.

**Arquivo:** `apps/mobile/src/components/ui/SignatureCanvas.tsx`

**Dependência:** `react-native-signature-canvas` (ou implementação custom com `react-native-svg` + `PanResponder` se a lib tiver problemas com Expo Go)

**Props:**
```typescript
interface SignatureCanvasProps {
  onSave: (base64Png: string) => void
  onClear?: () => void
  initialImage?: string       // preview de assinatura existente
  height?: number             // default: 200
  disabled?: boolean
  penColor?: string           // default: Colors.textPrimary (#fff)
  backgroundColor?: string    // default: 'transparent'
}
```

**Comportamento:**
- Canvas com fundo transparente e borda `Colors.border`
- Traço suave (stroke width 2-3px, branco sobre fundo escuro)
- Botão "Limpar" (canto inferior esquerdo) — reseta o canvas
- Botão "Confirmar" (canto inferior direito) — exporta PNG base64 via `onSave`
- Preview mode: se `initialImage` fornecido e `disabled=true`, mostra a imagem sem interação
- Haptic feedback ao confirmar (`Haptics.notificationAsync(Success)`)

### 3.2 Backend — Campo de Assinatura no Employee

**Arquivo:** `backend/core/apps/hr/models.py`

Adicionar ao modelo `Employee`:
```python
signature_image = models.ImageField(
    upload_to='employees/signatures/',
    blank=True,
    null=True,
    help_text="Assinatura digital do funcionário (PNG transparente)",
)
```

**Endpoint:** `POST /api/v1/hr/employees/{id}/upload_signature/` (multipart/form-data) — padrão consistente com `upload_logo` das seguradoras. Aceita PNG transparente, salva em `MEDIA_ROOT/employees/signatures/` (dev) ou S3 (prod).

**Migration:** `python manage.py makemigrations hr && python manage.py migrate_schemas`

**PDF Engine:** O template WeasyPrint de documentos deve buscar `employee.signature_image.url` (ou base64 inline) ao montar o bloco de assinatura do responsável.

### 3.3 Fluxo — Assinatura do Funcionário no Perfil

**Tela:** `apps/mobile/app/(app)/perfil/index.tsx`

Nova seção "Minha Assinatura" abaixo dos dados do perfil:

```
┌─────────────────────────────────┐
│  MINHA ASSINATURA               │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │   [preview da assinatura] │  │
│  │                           │  │
│  └───────────────────────────┘  │
│  [ Alterar Assinatura ]         │
└─────────────────────────────────┘
```

- Se não tem assinatura: mostra placeholder "Assine abaixo" + canvas aberto
- Se já tem: mostra preview (Image do URL) + botão "Alterar"
- Ao salvar: `PATCH /api/v1/hr/employees/{id}/` com `signature_image` (base64 ou multipart)
- Toast: "Assinatura salva com sucesso"
- A assinatura do funcionário é capturada **uma única vez** e reutilizada automaticamente em todos os documentos gerados pelo backend

### 3.4 Fluxo — Assinatura do Cliente na Vistoria de Entrada

**Tela:** `apps/mobile/app/(app)/vistoria/entrada/[osId].tsx`

Após o ConfirmDialog de "Concluir Vistoria de Entrada" (já existente):

1. Usuário confirma no ConfirmDialog
2. Abre tela/modal de assinatura do cliente: `SignatureCanvas` + campo "Nome do cliente" (pre-filled da OS)
3. Cliente assina na tela do celular
4. Ao confirmar:
   - `POST /api/v1/signatures/capture/` com:
     - `service_order_id`: ID da OS
     - `document_type`: `"OS_OPEN"` (ou novo tipo `"VISTORIA_ENTRADA"`)
     - `method`: `"CANVAS_TABLET"`
     - `signer_name`: nome do cliente
     - `signature_png_base64`: PNG da assinatura
   - Transição de status para `budget` (como já faz hoje)
   - Toast: "Vistoria concluída — assinatura registrada"
5. Se cliente não quiser assinar: botão "Pular" (assinatura fica pendente, status avança)

### 3.5 Fluxo — Assinatura do Cliente na Entrega

**Tela:** `apps/mobile/app/(app)/os/[id].tsx`

Na transição para status `delivered`:

1. Botão "Entregar Veículo" (visível quando status permite transição para `delivered`)
2. Abre tela/modal de assinatura: `SignatureCanvas` + campo "Nome" (pre-filled) + checkbox "Confirmo o recebimento do veículo em boas condições"
3. Cliente assina
4. Ao confirmar:
   - `POST /api/v1/signatures/capture/` com `document_type: "OS_DELIVERY"`
   - `PATCH` status → `delivered` (preenche `delivered_at` automaticamente)
   - Toast: "Veículo entregue — assinatura registrada"
5. Botão "Pular assinatura" caso cliente não esteja presente (permite entregar sem assinatura, mas logga warning)

### 3.6 Documentos — Visualização e Compartilhamento

**Tela:** Nova seção/tab "Documentos" no detalhe da OS (`apps/mobile/app/(app)/os/[id].tsx`)

**API:** `GET /api/v1/documents/?service_order={id}` (endpoint existente no app `documents/`)

**Lista de documentos:**
```
┌─────────────────────────────────┐
│  DOCUMENTOS                     │
│                                 │
│  📄 Ordem de Serviço #1234     │
│     Gerado em 05/05/2026        │
│     [Visualizar]  [Compartilhar]│
│                                 │
│  📄 Termo de Garantia           │
│     Gerado em 05/05/2026        │
│     [Visualizar]  [Compartilhar]│
│                                 │
│  📄 Recibo de Quitação          │
│     Gerado em 06/05/2026        │
│     [Visualizar]  [Compartilhar]│
│                                 │
│  [ + Gerar Documento ]          │
└─────────────────────────────────┘
```

**Visualizar:**
1. Download PDF via `expo-file-system` → `FileSystem.downloadAsync(url, localPath)`
2. Abre com `expo-sharing` (share sheet nativo) — no iOS abre o viewer de PDF inline
3. Alternativa: `WebView` com URL do PDF para preview inline sem download

**Compartilhar:**
1. Download PDF para cache local
2. `Sharing.shareAsync(localPath, { mimeType: 'application/pdf' })`
3. Abre share sheet: WhatsApp, Email, AirDrop, etc.

**Gerar Documento:**
1. Botão "Gerar Documento" → picker de tipo (OS Report, Garantia, Recibo, Quitação)
2. `POST /api/v1/documents/generate/` com `{ service_order_id, document_type }`
3. Loading spinner enquanto backend gera
4. Ao completar: documento aparece na lista + Toast "Documento gerado"

**Hook:** `useOSDocuments(osId)` — TanStack Query, refetch on focus

---

## 4. M8 — Polish Visual + Build de Produção

### 4.1 Glass Cards — Agenda, Notificações, Perfil

Aplicar padrão glass morphism consistente nas telas secundárias que ainda usam estilo flat.

**Agenda (`apps/mobile/app/(app)/agenda/index.tsx`):**
- Cards de eventos com `Card` component existente
- Adicionar `borderTopColor: Colors.borderGlintTop` (glint glass)
- Day headers com `Typography.labelMono`
- Seleção de data com `backgroundColor: Colors.brandTint, borderColor: Colors.brand`
- Empty state com ícone `Ionicons calendar-outline`

**Notificações (`apps/mobile/app/(app)/notificacoes/index.tsx`):**
- Cards com glass style (substituir cards flat)
- Ícone por tipo de notificação (status change, foto, checklist)
- Usar `Text` de `@/components/ui/Text` (não RN nativo)
- Corrigir texto "tenant" → "Atualizações de status das ordens de serviço"
- Empty state com ícone `Ionicons notifications-off-outline`

**Perfil (`apps/mobile/app/(app)/perfil/index.tsx`):**
- Avatar com border glass + `Shadow.sm`
- Seções organizadas com `SectionDivider`
- Versão do app no rodapé (`expo-constants` → `Constants.expoConfig?.version`)
- Seção "Minha Assinatura" (parte do M7)

### 4.2 Tab Fotos no OS Detail

**Tela:** `apps/mobile/app/(app)/os/[id].tsx`

Nova tab "Fotos" no `SegmentedControl` existente:

- Grid de fotos (3 colunas) agrupadas por pasta:
  - `checklist_entrada` — Checklist de Entrada
  - `vistoria_inicial` — Vistoria Inicial
  - `acompanhamento` — Acompanhamento
  - `vistoria_final` — Vistoria Final
- Cada seção: header com nome da pasta + contador de fotos
- Tap na foto: abre fullscreen com zoom (pinch-to-zoom) + botão compartilhar
- Compartilhar foto individual: `expo-sharing`

### 4.3 Animações de Transição

**Configuração:** `apps/mobile/app/(app)/_layout.tsx`

- Stack screens: `animation: 'slide_from_right'` (padrão iOS)
- Tab switch: fade transition via `SegmentedControl` animated (já parcialmente implementado)
- Modal screens (camera, photo-editor): `presentation: 'modal'` com `animation: 'slide_from_bottom'`

### 4.4 Sentry — Crash Reporting Básico

**Pacote:** `@sentry/react-native`

**Setup:**
- Init em `apps/mobile/app/_layout.tsx`:
  ```typescript
  import * as Sentry from '@sentry/react-native'
  Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN })
  ```
- Wrap root layout com `Sentry.wrap()`
- Breadcrumbs automáticos (navigation, console, network)
- Sem performance monitoring (mantém bundle leve)
- Source maps via EAS Build (auto-configurado pelo `@sentry/react-native`)

**Variável:** `EXPO_PUBLIC_SENTRY_DSN` no `.env` e no EAS secrets

### 4.5 EAS Build — 3 Profiles

**Arquivo:** `apps/mobile/eas.json`

```json
{
  "cli": { "version": ">= 14.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" },
      "channel": "preview"
    },
    "production": {
      "autoIncrement": true,
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "...", "ascAppId": "...", "appleTeamId": "..." }
    }
  }
}
```

**Profiles:**
- `development` — dev client com Expo DevTools
- `preview` — APK direto (Android) + TestFlight (iOS) para time interno
- `production` — release final assinada (futuro, quando/se publicar nas lojas)

### 4.6 EAS Update (OTA)

**Pacote:** `expo-updates` (já incluído no Expo SDK)

**Configuração em `app.json`:**
```json
{
  "updates": {
    "url": "https://u.expo.dev/<project-id>",
    "fallbackToCacheTimeout": 0
  },
  "runtimeVersion": { "policy": "appVersion" }
}
```

- Canal `preview`: updates automáticos para builds de preview
- Canal `production`: updates controlados
- 90% das mudanças (JS/assets) chegam via OTA sem reinstalar
- Builds nativos novos apenas ao mudar dependências nativas (~a cada 2-3 meses)

### 4.7 CI/CD — GitHub Actions

**Arquivo:** `.github/workflows/mobile-build.yml`

**Trigger:** Push na `main` com changes em `apps/mobile/**`

**Jobs:**
1. **lint-typecheck:**
   - `cd apps/mobile && npx tsc --noEmit`
   - `cd apps/mobile && npx eslint .`

2. **eas-build** (se houve mudança nativa):
   - `npx eas-cli build --platform all --profile preview --non-interactive`
   - Artefatos: APK + TestFlight build

3. **eas-update** (se só JS/assets mudaram):
   - `npx eas-cli update --branch preview --message "$(git log -1 --pretty=%s)"`
   - OTA update publicado automaticamente

**Secrets no GitHub:**
- `EXPO_TOKEN` — token de acesso EAS
- `SENTRY_AUTH_TOKEN` — para upload de source maps

### 4.8 Distribuição Interna

**Android:** APK gerado pelo EAS Build (profile `preview`), distribuído por link no grupo de WhatsApp da equipe. Instalação: habilitar "fontes desconhecidas" uma vez.

**iOS:** TestFlight — convite por email, funcionário instala pelo app TestFlight. Builds válidos por 90 dias, renovados automaticamente pelo CI/CD.

**QR Code:** Gerar QR Code com link universal que detecta plataforma:
- Android → link direto para APK (ou página com instruções)
- iOS → link do TestFlight
- Imprimir e colocar na recepção + refeitório da oficina

---

## 5. Ordem de Execução

```
Sprint M7 — Assinatura Digital + Documentos
──────────────────────────────────────────
1. SignatureCanvas component (primitivo UI)
2. Backend: Employee.signature_image (migration + serializer + endpoint)
3. Perfil: seção "Minha Assinatura"
4. Vistoria Entrada: assinatura do cliente pós-checklist
5. OS Entrega: assinatura do cliente na transição → delivered
6. OS Detail: tab/seção Documentos (lista + visualizar + compartilhar)

Sprint M8 — Polish + Build de Produção
──────────────────────────────────────
7. Glass cards: Agenda + Notificações + Perfil
8. Tab Fotos no OS detail (grid agrupada por pasta)
9. Animações de transição entre telas
10. Sentry setup (crash reporting básico)
11. EAS Build (eas.json + 3 profiles)
12. EAS Update (OTA configuração)
13. CI/CD GitHub Actions
14. QR Code + instruções de distribuição
```

---

## 6. Dependências Técnicas

| Dependência | Sprint | Descrição |
|-------------|--------|-----------|
| `react-native-signature-canvas` | M7 | Canvas de assinatura (ou custom SVG) |
| `expo-file-system` | M7 | Download de PDFs para cache |
| `expo-sharing` | M7 | Share sheet nativo |
| Backend: `Employee.signature_image` | M7 | Novo campo + migration |
| Backend: `POST /signatures/capture/` | M7 | Já existe, possivelmente adicionar `document_type` novos |
| Backend: `GET /documents/` | M7 | Já existe no app `documents` |
| `@sentry/react-native` | M8 | Crash reporting |
| `expo-updates` | M8 | OTA updates |
| `eas-cli` | M8 | Build + update commands |
| GitHub Secrets: `EXPO_TOKEN`, `SENTRY_AUTH_TOKEN` | M8 | CI/CD |

---

## 7. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| `react-native-signature-canvas` incompatível com Expo Go | Médio | Fallback: custom canvas com `react-native-svg` + PanResponder |
| PDF grande demora para baixar em 3G/4G da oficina | Baixo | Cache local após primeiro download, loading spinner |
| Assinatura ilegível em tela pequena (celular) | Médio | Canvas com height mínimo 200px, permitir modo landscape |
| CI/CD build demora muito (20+ min) | Baixo | Usar EAS Build cache, builds só quando nativo muda |
| TestFlight expira a cada 90 dias | Baixo | CI/CD gera build automaticamente a cada push |

---

*Paddock Solutions · paddock.solutions · Manaus, AM*
