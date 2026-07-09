# Design — Mobile Web App (PWA full) + Sessão de 30 dias

**Data:** 2026-06-22
**Status:** Aprovado (brainstorming)
**Próximo passo:** Plano de implementação (`writing-plans`)

## Contexto

O ERP DS Car (`apps/dscar-web`) hoje é desktop-first. O usuário relata dois problemas:

1. **Sessão curta demais.** Aplicação desloga com frequência. Quer que usuário ativo nunca desloge no web app.
2. **Mobile pobre.** Quer usar o web app no celular como substituto temporário do app React Native em desenvolvimento (`apps/mobile`), até que o RN seja lançado. Não há previsão.

A solução é transformar `apps/dscar-web` em **PWA full** (instalável, offline, push, câmera, assinatura) e implementar **sessão rolante de 30 dias** com refresh resiliente.

## Diagnóstico do estado atual

### Sessão

- Access token JWT: **1h**
- Refresh token: **7d no código** (`jwt_utils.py:97`) vs **14d em settings** (`SIMPLE_JWT.REFRESH_TOKEN_LIFETIME`) — discrepância
- `next-auth` `session.maxAge`: padrão **30d** mas não configurado explicitamente
- Refresh implementado em `lib/auth.ts` com margem de 60s
- **Causa raiz dos deslogs:** `lib/api.ts:48-58` faz `signOut()` imediato em qualquer 401 — sem retry, sem dedup. Requisições paralelas durante a janela de expiração do access token causam race conditions que disparam logout prematuro.

### Mobile UX

Auditoria identificou (estado regular):

- Sem PWA setup (zero manifest, sem ícones iOS, sem service worker)
- Tabelas grandes (OS, financeiro, RH, estoque) usam `hidden md:grid` — somem no mobile
- Botões/inputs `h-9` (36px) abaixo do mínimo de toque 44px
- `ServiceOrderForm` tem 9 abas sem responsividade
- `AppHeader` (h-16) + `MobileSidebar` (h-14) duplicam barra no topo
- Padding `p-6` fixo desperdiça espaço em telas <375px
- Pontos positivos: `MobileSidebar` drawer já existe; login responsivo OK

## Escopo

### Dentro

- Sessão rolante 30d + refresh resiliente + revogação por device
- PWA instalável (manifest, ícones, splash, theme color)
- Service worker via Serwist (cache de assets, API GETs, fallback offline)
- Captura de foto pela câmera com marca d'água (data, OS, técnico)
- Assinatura digital em canvas (cliente, técnico, gestor) integrada ao módulo `signatures` existente
- Push notifications (Web Push + VAPID + tela de preferências)
- Sync offline de criação/edição de OS, fotos, assinaturas, apontamento
- Responsividade dos fluxos prioritários:
  - OS — recepção, vistoria, fotos, assinatura
  - OS — apontamento de horas + andamento
  - Dashboard + Aprovações
  - Estoque + Compras (consultas)

### Fora

- Refazer o app React Native (`apps/mobile`)
- Tornar offline-capable: NF-e/NFS-e, faturamento, aprovação de OC (online-only)
- Migração de telas administrativas pesadas (relatórios, RH, contabilidade)
- Mudança de provider de auth (continua next-auth v5 com dev-credentials + Keycloak)

## Decisões tomadas no brainstorming

| Decisão | Valor | Justificativa |
|---|---|---|
| Política de sessão | 30 dias rolante (`session.maxAge=30d`, `updateAge=24h`) | Usuário ativo nunca desloga; expira só se 30d sem uso. Padrão de mercado. |
| Nível de PWA | Full (instalável + offline + push + câmera + assinatura) | Substitui RN temporariamente |
| Faseamento | Big bang — implementar tudo antes de liberar | Decisão explícita do usuário |
| Arquitetura | Responsive único + Serwist + Dexie (Abordagem A) | Mantém uma única árvore de rotas; reaproveita auth e providers |
| Stack PWA | Serwist (`@serwist/next`) | Workbox moderno, mantido, integra com Next 15 |
| IndexedDB | Dexie 4 | API ergonômica, ~30KB, hooks React |
| Push backend | `pywebpush` | Padrão para VAPID em Python |
| Assinatura | `signature_pad` v5 (13KB) | Touch + pressure, exporta PNG e SVG |
| Câmera | `getUserMedia` nativo + canvas | Sem dependência extra |

## Arquitetura

```
apps/dscar-web/
├── src/
│   ├── app/
│   │   ├── (app)/             ← rotas autenticadas (existente)
│   │   ├── api/
│   │   │   ├── proxy/         ← proxy Django (existente)
│   │   │   ├── push/          ← NOVO: subscribe/unsubscribe Web Push
│   │   │   └── sw-ping/       ← NOVO: heartbeat do service worker
│   │   ├── layout.tsx         ← +viewport, +manifest link
│   │   └── manifest.ts        ← NOVO: Next.js Metadata route
│   ├── components/
│   │   ├── responsive/        ← NOVO: ResponsiveTable, ResponsiveTabs, ResponsiveDialog
│   │   ├── camera/            ← NOVO: CameraCapture + watermark canvas
│   │   ├── signature/         ← NOVO: SignaturePad (canvas + touch)
│   │   └── pwa/               ← NOVO: InstallPrompt, UpdateBanner, NotificationOnboarding
│   ├── lib/
│   │   ├── auth.ts            ← MODIFICADO: maxAge=30d + updateAge=24h + refresh dedup
│   │   ├── offline/           ← NOVO: Dexie schema + sync queue + reconciliação
│   │   ├── push/              ← NOVO: cliente VAPID
│   │   ├── camera/            ← NOVO: watermark utils
│   │   └── api.ts             ← MODIFICADO: integra com offline queue + retry em 401
│   ├── hooks/
│   │   ├── useIsMobile.ts     ← NOVO: matchMedia hook
│   │   ├── useOnline.ts       ← NOVO: navigator.onLine + reconnect
│   │   ├── useDeviceId.ts     ← NOVO: device_id persistido
│   │   └── useOfflineSync.ts  ← NOVO: status de fila
│   └── sw/
│       └── service-worker.ts  ← NOVO: Serwist runtime caching + push handler

apps/dscar-web/public/
├── icons/                     ← NOVO: 192/512/maskable + apple-touch
├── splash/                    ← NOVO: iOS splash screens

backend/core/apps/
├── notifications/             ← NOVO app Django
│   ├── models.py              ← PushSubscription, NotificationPreference, NotificationLog
│   ├── views.py               ← API subscribe/unsubscribe/preferences/test
│   ├── services.py            ← send_push(user_id, payload)
│   └── tasks.py               ← Celery: send_push_async
├── authentication/            ← MODIFICADO: refresh resiliente + revoke por device
│   ├── jwt_utils.py           ← alinhar TTL com settings
│   └── views.py               ← endpoint revoke-device
└── service_orders/            ← MODIFICADO: client_uuid + idempotência + If-Match
```

## Seção 1 — Sessão (30 dias rolante)

### Configuração NextAuth — `apps/dscar-web/src/lib/auth.ts`

```ts
session: {
  strategy: "jwt",
  maxAge: 60 * 60 * 24 * 30,   // 30 dias
  updateAge: 60 * 60 * 24,     // rola cookie a cada 24h de atividade
},
cookies: {
  sessionToken: {
    name: "__Secure-paddock.session-token",
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    },
  },
},
```

### Backend Django — `backend/core/config/settings/base.py`

```python
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}
```

Corrigir `apps/authentication/jwt_utils.py` para usar `settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]` em vez de hardcoded `timedelta(days=7)`.

### Refresh resiliente

Hoje em `lib/api.ts:48-58`: qualquer 401 → `signOut()` imediato. Eliminar essa falha:

1. **Refresh dedup**: única `Promise<RefreshedTokens>` em escopo de módulo. Requests paralelos aguardam a mesma promise.
2. **Retry uma vez**: ao receber 401, `api.ts` chama `refreshAccessToken()` e re-tenta a request original. Só desloga se o **refresh** falhar.
3. **Refresh proativo**: callback `jwt` detecta `exp - now < 5 min` e refaz antes da request real. Aumentar margem de 60s → 5min.
4. **Tolerância a falhas de rede**: erro de rede no refresh ≠ 401. Em rede caída, mantém token vigente e SW assume com cache.

```ts
// lib/auth.ts — pseudocódigo do dedup
let inflight: Promise<RefreshedTokens> | null = null;
async function refreshAccessToken(token: JWT): Promise<RefreshedTokens> {
  if (inflight) return inflight;
  inflight = doRefresh(token).finally(() => { inflight = null; });
  return inflight;
}
```

### Revogação por dispositivo

- `device_id` (UUID v4) gerado no primeiro login via `crypto.randomUUID()`, persistido em IndexedDB.
- Vai como claim no JWT.
- Backend mantém `RefreshTokenDevice (user, device_id, last_seen_at, user_agent)`.
- Novo endpoint `POST /api/v1/auth/revoke-device/` que invalida tokens de um device específico.
- Botão "Sair de todos os dispositivos" em configurações.
- Limpeza automática quando subscription push é desabilitada.

### Comportamento esperado

| Situação | Antes | Depois |
|---|---|---|
| Acesso diário | Desloga após 1h se refresh falhar | Nunca desloga |
| 5 requests paralelas com token expirado | Race → signOut | Aguardam refresh único → todas seguem |
| Erro de rede temporário | signOut | Mantém sessão, retry quando voltar |
| 30d sem acessar | (variável) | Pede login |
| Token roubado | Sem revogação | Pode revogar device específico |

### Testes

- `refreshAccessToken` é deduplicada em chamadas paralelas (5 awaits → 1 fetch)
- `api.ts` retry em 401 chama refresh + re-tenta a request
- Refresh com erro de rede **não** dispara `signOut`
- Refresh com 401 (token expirado/revogado) dispara `signOut`
- Backend: `revoke-device` invalida só o device alvo

## Seção 2 — PWA setup (manifest, ícones, service worker)

### Manifest — `apps/dscar-web/src/app/manifest.ts`

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DS Car ERP",
    short_name: "DS Car",
    description: "Centro automotivo — gestão de OS, vistoria, estoque",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#0f172a",
    background_color: "#0f172a",
    lang: "pt-BR",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nova OS", url: "/os/nova", icons: [{ src: "/icons/shortcut-os.png", sizes: "96x96" }] },
      { name: "Apontamento", url: "/apontamento", icons: [{ src: "/icons/shortcut-clock.png", sizes: "96x96" }] },
    ],
  };
}
```

### Layout root — `apps/dscar-web/src/app/layout.tsx`

```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,            // permite zoom (a11y)
  viewportFit: "cover",       // safe-area
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  // ... existing
  appleWebApp: {
    capable: true,
    title: "DS Car",
    statusBarStyle: "black-translucent",
    startupImage: [/* gerados */],
  },
  formatDetection: { telephone: false },
};
```

### Ícones e splash — script de geração

`scripts/generate-icons.mjs` parte de `packages/ui/brand/dscar-logo.svg` e produz:

- `icon-192.png`, `icon-512.png` (any)
- `maskable-192.png`, `maskable-512.png` (safe zone 10%)
- `apple-touch-icon.png` (180×180)
- `favicon.ico`, `favicon-16.png`, `favicon-32.png`
- `splash/iphone-*.png` (~10 tamanhos: SE, 8, X, 11, 13, 14, 14 Pro Max)
- Shortcut icons

Usar `sharp`. Roda no `prebuild` do Turbo.

### Service worker via Serwist

`next.config.ts`:

```ts
import withSerwist from "@serwist/next";

export default withSerwist({
  swSrc: "src/sw/service-worker.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
```

`src/sw/service-worker.ts`:

```ts
import { defaultCache } from "@serwist/next/worker";
import { Serwist, CacheFirst, NetworkFirst, StaleWhileRevalidate } from "serwist";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    { matcher: /\/_next\/static\//, handler: new CacheFirst({ cacheName: "next-static", expiration: { maxAgeSeconds: 30*24*3600 } }) },
    { matcher: /\.(?:png|jpe?g|svg|webp|avif|ico)$/, handler: new StaleWhileRevalidate({ cacheName: "images", expiration: { maxEntries: 200 } }) },
    { matcher: /^https:\/\/pub-3187.*\.r2\.dev\//, handler: new CacheFirst({ cacheName: "r2-photos" }) },
    { matcher: /\/api\/proxy\/.*$/, method: "GET", handler: new NetworkFirst({ cacheName: "api", networkTimeoutSeconds: 3 }) },
  ],
  fallbacks: {
    entries: [{ url: "/offline", matcher: ({ request }) => request.mode === "navigate" }],
  },
});

serwist.addEventListeners();
```

`app/offline/page.tsx` — fallback de navegação offline + lista de ações pendentes na fila.

### Install prompt e update banner

- `<InstallPrompt>` no root layout: escuta `beforeinstallprompt`, banner discreto após 2ª visita; dismiss persiste 7 dias.
- `<UpdateBanner>`: escuta `serwist.on("update")` → toast "Nova versão disponível • Atualizar" → `serwist.messageSkipWaiting()` + reload.
- Detecção iOS Safari: instruções visuais ("Toque em Compartilhar → Adicionar à Tela Inicial") na primeira visita.

### Testes

- `manifest.json` retorna 200 e tem `display: standalone`
- SW registra em produção e **não** registra em dev
- Cache de API funciona offline: `/os` enquanto offline retorna última lista cacheada + banner
- Update banner aparece em nova versão
- Lighthouse PWA score ≥ 90

## Seção 3 — Responsividade & UX mobile

Princípio: **mobile-first em componentes novos, refactor cirúrgico nos existentes**.

### Tokens e breakpoints

| Breakpoint | Largura | Uso |
|---|---|---|
| default | <640px | Mobile (foco) |
| `sm:` | ≥640px | Tablet pequeno |
| `md:` | ≥768px | Tablet / desktop estreito |
| `lg:` | ≥1024px | Desktop padrão |

Padding/gaps em `packages/utils/design-tokens.ts`:

```ts
export const space = {
  page: "px-4 sm:px-5 md:px-6",
  pageY: "pt-3 pb-5 md:pt-4 md:pb-6",
  card: "p-4 md:p-6",
  gap: "gap-3 md:gap-6",
};
```

Variantes shadcn:
- `button` `default` passa de `h-9` → `h-10` (40px)
- Nova variante `touch` = `h-11 min-w-11` (44px) para ações primárias mobile

### Layout (`app/(app)/layout.tsx` + Sidebar + Header)

- Em mobile (`<md`): **um header só**, h-12: `[hamburger | logo+título contextual | avatar]`
- `MobileSidebar` drawer continua funcionando
- `AppHeader` desktop continua igual (`md:flex`)
- `<SafeAreaTop>` no header (`pt-[env(safe-area-inset-top)]`)
- Bottom nav opcional em telas críticas (OS, dashboard, apontamento) — `<BottomNav>` fixo com 4 ícones

### Tabelas → Cards via `<ResponsiveTable>`

`components/responsive/ResponsiveTable.tsx`:

```tsx
<ResponsiveTable
  data={ordens}
  columns={[
    { key: "numero", header: "OS", cell: (o) => o.numero, primary: true },
    { key: "cliente", header: "Cliente", cell: (o) => o.cliente.nome },
    { key: "status", header: "Status", cell: (o) => <StatusBadge value={o.status} /> },
  ]}
  mobileCard={(os) => <OrdemServicoCard data={os} />}
  rowAction={(os) => router.push(`/os/${os.numero}`)}
/>
```

Aplicado em (prioridade):
1. `ServiceOrderTable` (OS)
2. Contas a pagar / receber
3. Lista de peças (`/estoque`)
4. Lista de pedidos / OC (`/compras`)
5. Lista de clientes / fornecedores

### ServiceOrderForm — 9 abas

`<ResponsiveTabs>`:
- **Desktop:** tabs horizontais
- **Mobile:** botão "Seções" abre `<Sheet side="bottom">` com lista vertical das tabs + ícone + contador de campos pendentes. Tab atual aparece no topo como breadcrumb compacto.

Reordenamento mobile-first: `opening → parts → services → files → notes → reminders → estoque → history → closing`.

### Dialogs e Sheets

`<ResponsiveDialog>` wrapper que vira `<Sheet side="bottom">` no mobile automaticamente. Aplica em: edição inline de peça/serviço, escolha de cliente/fornecedor, modal de transição, modal de assinatura.

### Formulários e teclado

- `inputMode` correto: `numeric` (preço, qtd), `tel` (telefone), `email`, `decimal` (monetário)
- `autoComplete` adequado (`name`, `tel`, `postal-code`, etc.)
- Inputs `h-11` em formulários mobile (OS, vistoria, apontamento, login)
- Botão "Salvar" sticky no rodapé em formulários longos (`<StickyFormFooter>`)

### Touch e a11y

- `min-h-11 min-w-11` em botões de ação
- `tap-highlight-transparent` global
- `focus-visible:ring-2` validado
- Respeitar `prefers-reduced-motion`

### Safe-area

- Header: `sticky top-0 z-40 pt-[env(safe-area-inset-top)]`
- Bottom nav: `fixed bottom-0 z-30 pb-[env(safe-area-inset-bottom)]`
- Footer de formulário: mesma técnica

### Testes

- Snapshots Playwright em 375/768/1280px
- `ResponsiveTable` renderiza cards <768px e tabela ≥768px
- `ResponsiveTabs` abre sheet em mobile
- Touch targets validados via `expect(button).toHaveCSS("min-height", "44px")`

## Seção 4 — Câmera com marca d'água + Assinatura

### Câmera

**Stack:** `getUserMedia` + `<canvas>` para watermark + upload R2 via endpoint existente.

**Componente:** `components/camera/CameraCapture.tsx`

Fluxo:
1. Botão "Tirar foto" → solicita permissão câmera
2. MediaStream em `<video>` tela cheia
3. Botão "capturar" → desenha frame em `<canvas>`
4. Aplica watermark (data/hora, OS, técnico, GPS opcional)
5. Exporta JPEG (quality 0.85, maxWidth 2048)
6. POST `/api/proxy/service-orders/{id}/photos/`
7. Fallback offline: blob em IndexedDB

**Watermark** — `lib/camera/watermark.ts`:

```ts
type WatermarkConfig = {
  numeroOs: string;
  tecnico: string;
  timestamp: Date;
  tipo: "vistoria_entrada" | "vistoria_saida" | "andamento" | "evidencia_sinistro";
};

export async function applyWatermark(source: HTMLCanvasElement, config: WatermarkConfig): Promise<Blob> {
  // 1. Rodapé semi-transparente (rgba(0,0,0,0.65)) altura 80px
  // 2. Linha 1: "OS #1234 · Vistoria de entrada"
  // 3. Linha 2: "Técnico: João Silva"
  // 4. Linha 3: "21/06/2026 14:32:08 (America/Manaus)"
  // 5. Logo DS Car no canto direito
  // Exporta JPEG via canvas.toBlob
}
```

**Mobile-específico:**
- `facingMode: { ideal: "environment" }` — câmera traseira por padrão
- `playsInline` obrigatório no iOS
- `<video>` cobre viewport, controles flutuantes (capturar, cancelar, switch, flash)
- Múltiplas fotos em sequência, galeria thumbnail no rodapé
- Botão "Concluir" envia tudo (ou enfileira offline)

**Fallback:** sem `getUserMedia` ou permissão negada → `<input type="file" accept="image/*" capture="environment" multiple>`. Watermark aplicada igual.

**GPS opcional:** config `OS_FOTO_GPS=true` por tenant. Captura via `navigator.geolocation` com timeout 3s. Falha silenciosa.

**Backend:** endpoint `/api/v1/service-orders/{id}/photos/` já existe (R2 + cleanup órfão). Adicionar campo `watermark_metadata` (JSON: `{tipo, tecnico_id, gps?, dispositivo}`).

### Assinatura digital

**Stack:** `signature_pad` v5 + canvas + módulo `signatures` (existente).

**Componente:** `components/signature/SignaturePad.tsx`

```tsx
<SignaturePad
  tipo="cliente"
  pessoaId={clienteId}
  contexto={{ tipo: "vistoria_entrada", servicoOrdemId: 1234 }}
  onSign={(blob, metadata) => salvarAssinatura(blob, metadata)}
  onCancel={() => sheet.close()}
/>
```

**Comportamento:**
- Sugere landscape em portrait estreito (não bloqueia)
- Canvas mínimo 300×150px; em mobile ocupa quase toda viewport
- Trace `velocityFilterWeight: 0.7`, `minWidth: 0.5`, `maxWidth: 2.5`
- Botões: Limpar, Cancelar, Confirmar
- Confirmar desabilitado até traço mínimo (>5% canvas preenchido)
- Export PNG (transparente) + SVG vetorial para PDF
- Captura `pointer pressure` quando disponível (Apple Pencil, S Pen)

**Salvamento:**

```
POST /api/v1/signatures/
{
  pessoa_id: 1234,
  tipo: "cliente",
  contexto: { service_order_id: 5678, evento: "vistoria_entrada" },
  imagem_base64: "...",
  metadata: { device, user_agent, touch_count }
}
```

**Caso especial:** quando consultor abre vistoria, sistema busca assinatura cadastrada do técnico responsável + só pede a do cliente.

### Integração OS

`app/(app)/os/[numero]/vistoria/page.tsx`:

```
1. Consultor abre vistoria
2. Botão "Tirar fotos" → <CameraCapture multiple>
3. Após N fotos, "Coletar assinatura do cliente" → <SignaturePad>
4. "Finalizar vistoria" → cria registro + transição de status
```

Layout mobile: título → grid de fotos (thumbs 100x100) → assinatura (canvas inline) → CTA bottom-sticky.

### Testes

- Câmera: watermark com texto correto, fallback funciona, múltiplas fotos preservam ordem
- Watermark unit: linhas posicionadas, timezone Manaus
- Assinatura: confirmar só após traço mínimo, PNG não vazio, captura pointer events e pressure

### Pontos de atenção

- HTTPS obrigatório (TLS); testar localhost com `mkcert`
- iOS Safari: nunca abrir câmera no mount, só em gesto
- Memória: blob 2048px ≈ 800KB; limitar 20 fotos em memória
- Fotos imutáveis (regra existente): mobile só adiciona, nunca edita

## Seção 5 — Push notifications

### Backend — `apps/notifications/`

**Models:**

```python
class PushSubscription(TenantAwareModel):
    user = ForeignKey(User, on_delete=CASCADE, related_name="push_subs")
    endpoint = TextField(unique=True)
    p256dh = CharField(max_length=255)
    auth = CharField(max_length=255)
    device_id = CharField(max_length=64)
    user_agent = CharField(max_length=255)
    last_used_at = DateTimeField(null=True)
    is_active = BooleanField(default=True)

class NotificationPreference(TenantAwareModel):
    user = OneToOneField(User, ...)
    nova_os = BooleanField(default=True)
    aprovacao_pendente = BooleanField(default=True)
    peca_chegou = BooleanField(default=True)
    apontamento_lembrete = BooleanField(default=False)
    quiet_hours_start = TimeField(null=True)
    quiet_hours_end = TimeField(null=True)

class NotificationLog(TenantAwareModel):
    user = ForeignKey(User, ...)
    tipo = CharField(max_length=64)
    payload = JSONField()
    sent_at = DateTimeField(auto_now_add=True)
    delivery_status = CharField(...)
    error = TextField(blank=True)
```

**Endpoints:**

```
POST   /api/v1/notifications/subscribe/      { endpoint, keys, device_id }
DELETE /api/v1/notifications/subscribe/      { endpoint }
GET    /api/v1/notifications/preferences/
PATCH  /api/v1/notifications/preferences/
POST   /api/v1/notifications/test/
```

**Service** (`apps/notifications/services.py`):

```python
from pywebpush import webpush, WebPushException

def send_push(user_id: int, tipo: str, title: str, body: str, deep_link: str, data: dict = None) -> None:
    user = User.objects.get(pk=user_id)
    pref = NotificationPreference.objects.filter(user=user).first()

    if pref and not getattr(pref, tipo, True):
        return
    if pref and _in_quiet_hours(pref):
        return

    subs = PushSubscription.objects.filter(user=user, is_active=True)
    payload = json.dumps({"title": title, "body": body, "url": deep_link, "tipo": tipo, "data": data or {}})

    for sub in subs:
        try:
            webpush(
                subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": f"mailto:{settings.VAPID_CONTACT_EMAIL}"},
                ttl=3600,
            )
            NotificationLog.objects.create(user=user, tipo=tipo, payload=payload, delivery_status="sent")
        except WebPushException as e:
            if e.response.status_code in (404, 410):
                sub.is_active = False
                sub.save(update_fields=["is_active"])
            NotificationLog.objects.create(user=user, tipo=tipo, payload=payload, delivery_status="failed", error=str(e))
```

**Celery task:** `send_push_async(user_id, tipo, ..., tenant_schema)` com `schema_context`.

**Disparadores (signals em apps existentes):**
- `service_orders` → OS em `reception` → push consultores responsáveis
- `service_orders` → `waiting_auth` → push gestores
- `purchasing` → `OrdemCompra.received` → push requisitante
- `service_orders` → apontamento aberto > 4h sem fechar → push técnico (job periódico)

### Frontend

**Env:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

**Subscribe** — `lib/push/subscribe.ts`:

```ts
export async function ensurePushSubscription(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (Notification.permission === "denied") return;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
  }
  await fetch("/api/proxy/notifications/subscribe/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...sub.toJSON(), device_id: getDeviceId(), user_agent: navigator.userAgent }),
  });
}
```

**UX de permissão** — `components/pwa/NotificationOnboarding.tsx`:
- Não pedir permissão no primeiro carregamento
- Banner após 2ª visita ou após uso de feature relevante
- "Receba alertas de OS e aprovações no celular [Ativar] [Agora não]"
- Dismiss persiste 14 dias

**Tela de preferências** — `app/(app)/configuracoes/notificacoes/page.tsx`:
- Toggles por tipo
- Horário silencioso (sliders 00:00–23:59)
- Botão "Enviar teste"
- Lista de dispositivos inscritos com botão "Remover"

### Service worker — push handler

```ts
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const { title, body, url, tipo, data } = event.data.json();

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      tag: tipo,
      data: { url, tipo, ...data },
      actions: tipo === "aprovacao_pendente"
        ? [{ action: "approve", title: "Aprovar" }, { action: "view", title: "Abrir" }]
        : [],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url, tipo } = event.notification.data;

  if (event.action === "approve" && tipo === "aprovacao_pendente") {
    event.waitUntil(fetch(`/api/proxy/purchasing/oc/${event.notification.data.oc_id}/approve/`, { method: "POST" }));
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
```

### iOS — armadilhas

- iOS 16.4+ suporta Web Push **somente** em PWA instalado
- `InstallPrompt` orienta iOS a instalar antes de pedir permissão
- Detectar `window.navigator.standalone === true`; se não instalado e usuário toca "Ativar", mostrar prompt "Instale primeiro"

### Env vars novas

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_CONTACT_EMAIL=tech@dscar.com.br
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

Gerar com `py-vapid` CLI. Public commitada; private secret.

### Testes

- Backend: `send_push` respeita preferences/quiet, marca inactive em 404/410, registra log
- Frontend: subscribe envia keys; unsubscribe limpa
- SW: notification click foca aba existente
- E2E Playwright: `context.grantPermissions(["notifications"])`, push via API, validar notification

## Seção 6 — Sync offline

### Escopo

| Operação | Offline? |
|---|---|
| Listar OS / clientes / peças | ✅ Read |
| Criar OS rascunho | ✅ Write |
| Editar OS (peças, serviços, observações) | ✅ Write |
| Tirar foto + assinatura | ✅ Write |
| Apontamento (start/stop) | ✅ Write |
| Transição de status (até `ready`) | ✅ Write |
| Transição → `delivered` | ⚠️ Online only |
| Emitir NF-e/NFS-e | ❌ Online only |
| Faturar OS | ❌ Online only |
| Aprovar OC (financeiro) | ❌ Online only |
| Login / refresh | ❌ Online only (mas 30d cobre) |

Banner amarelo "Você está offline. Esta ação será habilitada quando reconectar." em telas online-only.

### Stack

- **Dexie 4** — IndexedDB wrapper
- **Background Sync API** (Workbox/Serwist) — retry quando volta online; fallback `online` event listener
- **`uuid v7`** — `client_uuid` ordenável temporalmente

### Schema Dexie — `lib/offline/db.ts`

```ts
type CachedOS = {
  id: number;
  numero: string;
  status: string;
  cliente_id: number;
  _cached_at: number;
  _stale: boolean;
};

type DraftMutation = {
  id: string;                       // client_uuid v7
  tipo: "create_os" | "update_os" | "add_foto" | "add_assinatura" |
        "apontamento_start" | "apontamento_stop" | "transicao_status";
  entity: "service_order" | "photo" | "signature" | "apontamento";
  entity_local_id?: string;
  entity_remote_id?: number;
  payload: unknown;
  blob?: Blob;
  created_at: number;
  attempts: number;
  last_error?: string;
  status: "pending" | "syncing" | "synced" | "conflict" | "failed";
};

export const db = new Dexie("dscar-offline");
db.version(1).stores({
  service_orders: "id, numero, cliente_id, status, _cached_at",
  clientes: "id, cpf_cnpj_hash, nome",
  pecas: "id, sku, descricao",
  drafts: "id, tipo, entity, entity_remote_id, status, created_at",
});
```

### Wrapper `lib/api.ts`

```ts
export async function apiFetch<T>(url: string, opts: ApiOpts = {}): Promise<T> {
  if (opts.method === "GET" || !opts.method) {
    try {
      const res = await fetchWithAuth(url, opts);
      await cacheResponse(url, res);
      return res;
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await readFromCache<T>(url);
        if (cached) return cached;
      }
      throw err;
    }
  }

  try {
    return await fetchWithAuth(url, opts);
  } catch (err) {
    if (isNetworkError(err) && opts.offline !== false) {
      const draft = await enqueueMutation(url, opts);
      return optimisticResponse(draft) as T;
    }
    throw err;
  }
}
```

`opts.offline = false` para operações online-only (NF-e, faturamento) — falha rápido.

### UI otimista

- Criar OS offline → aparece na lista com badge "Pendente sync" (cinza + nuvem riscada)
- Sync OK → badge some, ID real substitui `client_uuid`
- Conflito → badge vermelho → click abre modal de resolução

`useOfflineSync()`:

```ts
const { pendingCount, syncingCount, conflictCount, isOnline } = useOfflineSync();
```

`<OfflineStatusBar>` no header: `"📵 Offline · 3 alterações pendentes"`.

### Reconciliação de IDs

1. POST `/api/v1/service-orders/` com `client_uuid` no body
2. Backend retorna `{id, client_uuid}`
3. Sync layer atualiza Dexie: substitui `entity_local_id → entity_remote_id` em drafts dependentes
4. Draft marcado `synced`

**Backend mínimo:**
- `service_orders.ServiceOrder.client_uuid` (CharField, unique, nullable)
- Mesma coluna em: `Photo`, `Signature`, `Apontamento`, `PecaOS`
- `perform_create` em ViewSets checa `client_uuid` (idempotência: mesmo UUID 2x devolve a entidade existente)
- Suporte ao header `If-Match` em ViewSets de OS

### Conflitos

Updates carregam `If-Match: <updated_at>`. Backend:

```python
def perform_update(self, serializer):
    if_match = self.request.headers.get("If-Match")
    if if_match and serializer.instance.updated_at.isoformat() != if_match:
        raise Conflict(detail="OS alterada por outro usuário", code=409)
    serializer.save()
```

Cliente em 409 → draft `conflict` → modal:

```
"OS #1234 foi alterada por João às 14:32 enquanto você estava offline.

[VER MUDANÇAS DO SERVIDOR]
[MANTER MINHAS ALTERAÇÕES (sobrescreve)]
[DESCARTAR MINHAS ALTERAÇÕES]
[MERGE MANUAL]
```

### Background Sync via Serwist

```ts
import { BackgroundSyncPlugin } from "serwist/sync";

const bgSyncPlugin = new BackgroundSyncPlugin("dscar-mutations", {
  maxRetentionTime: 24 * 60,
});

serwist.registerCapture(
  ({ url, request }) => url.pathname.startsWith("/api/proxy/") && request.method !== "GET",
  new NetworkOnly({ plugins: [bgSyncPlugin] })
);
```

Fallback: `window.addEventListener("online", drainQueue)`.

### Fila de upload (fotos/assinaturas)

Blobs em IndexedDB (não no Workbox queue — limite de tamanho).

```ts
async function drainUploadQueue() {
  const drafts = await db.drafts
    .where("tipo").anyOf("add_foto", "add_assinatura")
    .and(d => d.status === "pending")
    .toArray();

  for (const draft of drafts) {
    try {
      const fd = new FormData();
      fd.append("file", draft.blob!, `os-${draft.entity_remote_id}-${draft.id}.jpg`);
      fd.append("metadata", JSON.stringify(draft.payload));
      await fetchWithAuth(`/api/proxy/service-orders/${draft.entity_remote_id}/photos/`, {
        method: "POST", body: fd,
      });
      await db.drafts.update(draft.id, { status: "synced" });
    } catch (err) {
      await db.drafts.update(draft.id, {
        attempts: draft.attempts + 1,
        last_error: String(err),
        status: draft.attempts >= 5 ? "failed" : "pending",
      });
    }
  }
}
```

Backoff: 5s, 30s, 2min, 10min, 1h. Após 5 falhas → `failed`, pede ação do usuário.

### Hidratação inicial

```ts
// hooks/useHydrateOffline.ts — após login
useEffect(() => {
  if (!session) return;
  Promise.all([
    apiFetch("/service-orders/?status_in=open&limit=100"),
    apiFetch("/clientes/?limit=500"),
    apiFetch("/pecas/?limit=1000"),
  ]);
}, [session?.user.id]);
```

`<HydrationProgress>` na primeira vez.

### Limpeza

- OS sincronizadas > 90d → remove de Dexie
- Drafts `synced` > 7d → remove
- Drafts `failed` → mantém até decisão do usuário
- Cache imagens R2 > 30d sem acesso → SW remove (Workbox expiration)

Botão "Limpar dados offline" em configurações.

### Testes

- Unit: `enqueueMutation`, `drainQueue` (backoff), reconciliação
- Integration: simular offline → criar OS → online → sincronizar e remover badge
- E2E Playwright: `context.setOffline(true)` → vistoria offline → reconnect → backend tem registros
- Conflito: 2 browsers editam mesma OS → segundo recebe 409 → modal
- Backend: idempotência via `client_uuid`

### Backend — mudanças necessárias

1. `service_orders.ServiceOrder.client_uuid` (CharField, unique, nullable) + migration
2. Mesma coluna em `Photo`, `Signature`, `Apontamento`, `PecaOS`
3. `perform_create` checa `client_uuid` (idempotência)
4. Header `If-Match` em ViewSets de OS
5. Sem mudanças em models fiscais/financeiros

### Pontos de atenção

- Não é WatermelonDB — mais simples; cobre 80% dos casos
- Conflito em multi-usuário é raro (OS tem responsável definido)
- Storage IndexedDB: monitorar `navigator.storage.estimate()`; alertar >80%
- Mensagens claras: "pendente" vs "falhou" vs "conflito"

## Plano de execução

Big bang com 5 ondas internas. Cada onda mergeia em main atrás de `NEXT_PUBLIC_PWA_ENABLED=false` até a última.

**Onda 1 — Fundação (~3-4 dias)**
- Sessão 30d (Seção 1)
- Tokens responsivos (Seção 3.1)
- Hooks base: `useIsMobile`, `useOnline`, `useDeviceId`
- Pacote `@paddock/offline` esqueleto

**Onda 2 — PWA shell (~2-3 dias)**
- Manifest + ícones + splash + viewport (Seção 2)
- Serwist (precache + cache de assets)
- Install prompt + update banner
- Header mobile h-12, safe-area

**Onda 3 — Responsividade (~4-5 dias)**
- `<ResponsiveTable>` + 5 listas prioritárias
- `<ResponsiveTabs>` + ServiceOrderForm
- `<ResponsiveDialog>` + modais críticos
- Botão sticky, `inputMode` em formulários

**Onda 4 — Câmera + Assinatura + Push (~4-5 dias)**
- `<CameraCapture>` + watermark
- `<SignaturePad>` + integração `signatures`
- App `notifications` + endpoints + pywebpush
- SW handler de push + tela de preferências
- VAPID keys

**Onda 5 — Sync offline (~5-7 dias)**
- Backend: `client_uuid` + idempotência + If-Match
- Dexie schema + `apiFetch` wrapper + fila de mutations
- Background Sync via Serwist
- Upload queue de fotos/assinaturas
- Resolução de conflitos UI
- Hidratação inicial + limpeza

**Total bruto:** 18-24 dias úteis. **Buffer realista:** 5-6 semanas calendário.

## Estratégia de testes

| Nível | Cobertura | Ferramenta |
|---|---|---|
| Unit | Hooks, utils, watermark, signature export, sync queue, refresh dedup | Vitest |
| Integration | `apiFetch` offline, Dexie persistence, backend idempotência | Vitest + pytest |
| Component | `<ResponsiveTable>` em 2 viewports, `<SignaturePad>` touch | Vitest + Testing Library |
| E2E | Vistoria offline ponta a ponta | Playwright |
| E2E mobile | Mesma suite com `--device=iPhone 13` e `Galaxy S22` | Playwright |
| Visual | Snapshots 375/768/1280px | Playwright screenshot |
| Performance | Lighthouse PWA ≥ 90, Performance ≥ 80 mobile | Lighthouse CI |

**E2E críticos:**
1. Sessão 30d — fechar/abrir aba em 24h não pede login
2. Refresh dedup — 10 requests paralelos com token expirado → 1 refresh, todos seguem
3. PWA install Chrome Android + iOS Safari (dispositivos reais)
4. Vistoria offline completa → sync ao reconectar
5. Conflito de edição → modal aparece
6. Push notification em background (Android) e foreground
7. Update de versão → banner aparece → reload → SW substituído

### Testes em dispositivos reais (obrigatório)

Sprint final reserva 2 dias:
- iPhone (mínimo 1 com iOS 16.4+ e 1 com iOS 17+)
- Android (mínimo 1 com Chrome + 1 com Samsung Internet)
- 1 dia de uso real no pátio: 1 consultor + 1 técnico

## Riscos e mitigações

| Risco | Prob | Impacto | Mitigação |
|---|---|---|---|
| iOS Safari quirks | Alta | Médio | Validar em device real ANTES de cada onda; fallback `<input capture>` |
| Conflito offline complexo | Média | Médio | Last-write-wins com aviso; merge manual só se necessário |
| Quota IndexedDB iOS | Baixa | Alto | Monitorar `storage.estimate()`; limpeza agressiva |
| SW cache fantasma | Média | Alto | `skipWaiting` + `clientsClaim`; UpdateBanner; SW off em dev |
| Push iOS sem PWA instalado | Alta | Baixo | Onboarding explícito; degrada gracefully |
| Migration `client_uuid` em prod | Baixa | Médio | Campo nullable; rollout sem downtime; backfill em task |
| Regressão desktop pelo refactor | Média | Médio | Snapshots Playwright 1280px antes/depois cada onda |
| Sessão 30d com device roubado | Baixa | Médio | Endpoint "Sair de todos os dispositivos" + revoke por device |

## Feature flags e rollout

- `NEXT_PUBLIC_PWA_ENABLED` (default `false` durante dev; `true` no big bang final)
- `NEXT_PUBLIC_OFFLINE_ENABLED` — flag separada para Onda 5
- Feature flag por tenant (`Tenant.feature_flags JSONField`) — DS Car primeiro

## Documentação

- `apps/dscar-web/docs/PWA.md` — gerar ícones, VAPID keys, testar offline, iOS vs Android
- `backend/core/apps/notifications/README.md`
- Update no CLAUDE.md raiz: armadilhas iOS, troubleshooting de SW, comandos `pnpm gen:icons`

## Definição de pronto (DoD)

- [ ] Sessão 30d rolante — usuário ativo não desloga em 7 dias de uso contínuo (manual)
- [ ] Lighthouse PWA score ≥ 90 em produção
- [ ] App instalável e abre em standalone mode em iOS 16.4+ e Android Chrome
- [ ] Push em background em Android (device real)
- [ ] Câmera + watermark + upload em rede normal em iOS e Android
- [ ] Assinatura captura traço com qualidade aceitável em touch sem stylus
- [ ] Vistoria completa offline → sync ao reconectar (E2E)
- [ ] Resolução de conflito mostrada quando 2 usuários editam mesma OS (E2E)
- [ ] 5 listas prioritárias (OS, AP, AR, peças, OCs) como cards no mobile
- [ ] `ServiceOrderForm` utilizável no iPhone SE (375px) sem scroll horizontal
- [ ] Nenhuma regressão visual no desktop (snapshots 1280px)
- [ ] Todos os testes unit + integration + E2E em CI
- [ ] Validação operacional: 1 consultor + 1 técnico usaram por 1 dia sem reclamação bloqueante
