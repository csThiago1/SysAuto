# Spec: Ativação do Keycloak + Tema de Login DS Car

**Data:** 2026-04-24
**Escopo:** Ativar Keycloak no ambiente dev e criar tema de login customizado

---

## Contexto

O sistema usa `dev-credentials` (email + senha `paddock123`) como único provedor de autenticação hoje. O Keycloak já está definido no `docker-compose.dev.yml` e no `realm-export.json`, mas nunca foi ativado de verdade.

O objetivo é:
1. Fazer o Keycloak subir corretamente no `make dev`
2. Criar tema de login com identidade visual da DS Car
3. Manter `dev-credentials` funcionando para desenvolvimento local (sem quebrar nada)

---

## Decisões

| Decisão | Escolha |
|---------|---------|
| Reset de senha self-service | ❌ Desativado — senha temporária enviada via WhatsApp pelo admin |
| Telas de "esqueci minha senha" | ❌ Fora do escopo — link removido do tema |
| Telas de "primeiro acesso" | Keycloak default (sem tema) — usuário recebe senha temporária |
| Fotos do carrossel | Placeholder agora, slots para adicionar fotos reais depois |
| Logo | `dscar-logo.png` copiado de `apps/dscar-web/public/` |

---

## Parte 1 — Ativação do Keycloak

### Pré-requisito: schema PostgreSQL

O Keycloak usa schema separado no mesmo banco. Precisa ser criado antes do primeiro `docker compose up`:

```bash
docker exec paddock_postgres psql -U paddock -d paddock_dev \
  -c "CREATE SCHEMA IF NOT EXISTS keycloak;"
```

Isso deve ser documentado no `Makefile` como target `keycloak-setup` e executado automaticamente antes do `make dev` na primeira vez.

### Verificação do docker-compose

O `docker-compose.dev.yml` já tem o serviço `keycloak` configurado com:
- `--import-realm` — importa `realm-export.json` automaticamente
- `KC_DB_SCHEMA: keycloak` — usa schema isolado
- Volume: `./keycloak/realm-export.json` → `/opt/keycloak/data/import/`

Adicionar volume do tema:
```yaml
volumes:
  - ./keycloak/realm-export.json:/opt/keycloak/data/import/realm-export.json
  - ./keycloak/themes/paddock:/opt/keycloak/themes/paddock   # ← novo
```

### Ativar tema no realm-export.json

```json
{
  "realm": "paddock",
  "loginTheme": "paddock",   // ← adicionar
  ...
}
```

### Usuários seed (já existem no realm-export.json)

| Email | Senha | Role |
|-------|-------|------|
| `admin@paddock.solutions` | `admin123` | ADMIN |
| `thiago@paddock.solutions` | `paddock123` | ADMIN |

### Desativar reset de senha no realm

Atualmente `resetPasswordAllowed: true` no `realm-export.json` — precisa ser alterado para `false`:

```json
{
  "resetPasswordAllowed": false   // ← alterar de true para false
}
```

---

## Parte 2 — Tema de Login

### Estrutura de arquivos

```
infra/docker/keycloak/themes/paddock/
└── login/
    ├── theme.properties
    ├── login.ftl
    └── resources/
        ├── css/
        │   └── login.css
        ├── js/
        │   └── carousel.js
        └── img/
            ├── logo-dscar.png      ← copiar de apps/dscar-web/public/dscar-logo.png
            └── slide-placeholder.svg
```

### theme.properties

```properties
parent=base
import=common/keycloak

styles=css/login.css
scripts=js/carousel.js

locales=pt-BR
```

### Design aprovado

**Layout:** Split 50/50 (left: form | right: carrossel)

**Left panel:**
- Fundo: `#0a0a0a` com `backdrop-filter: blur(8px)`
- Logo DS Car centralizada, 75% da largura do form (`filter: brightness(0) invert(1)`)
- Divisor neon vermelho abaixo do logo
- Campos: E-mail + Senha com estilo dark (`background: rgba(255,255,255,0.04)`, `border: #222`)
- Focus dos campos: `border-color: #ea0e03` + glow sutil
- Botão "Entrar": `background: linear-gradient(135deg, #ea0e03, #c50b02)`
- **Sem link "Esqueci minha senha"** (opção A)

**Right panel:**
- Carrossel com 4 slides (placeholders de gradiente, fotos a substituir futuramente)
- Slides giram a cada 4500ms com transição de opacidade 1.4s
- Caption animado (slide-in de baixo) ao trocar slide
- Dots de navegação com dot ativo expandido + glow vermelho
- Blend gradient no lado esquerdo para fundir com o painel do form

**Background (todo o viewport):**
- Linhas neon vermelhas animadas: 10 horizontais + 6 verticais
- Viajam da esquerda para direita (H) e de cima para baixo (V)
- Cor: `#ea0e03`, glow `box-shadow: 0 0 6px #ea0e03`
- Duração: 3.3s–6.1s, delays variados para aparência orgânica

**Footer:**
- Texto: `Powered by Paddock Solutions`
- "Paddock Solutions" em vermelho `#ea0e03`
- Fundo: `rgba(0,0,0,0.6)`, texto base: `#2a2a2a`

**Tipografia:** Montserrat (Google Fonts)

**Paleta:**
| Token | Valor |
|-------|-------|
| Primary | `#ea0e03` |
| Primary dark | `#c50b02` |
| Background | `#0a0a0a` |
| Surface | `#1a1a1a` |
| Border | `#222` |
| Text muted | `#4a4a4a` |

### Variáveis Freemarker obrigatórias no login.ftl

O template `.ftl` deve usar as variáveis do Keycloak:

```freemarker
${url.loginAction}           <!-- action do <form> -->
${login.username!''}         <!-- valor pré-preenchido do email -->
${messagesPerField.existsError('username','password')}  <!-- erro de login -->
${kcSanitize(msg("invalidUserMessage"))?no_esc}         <!-- mensagem de erro -->
```

### Carrossel — slots de imagem

Os 4 slides iniciais usam gradientes escuros como placeholder.
Quando as fotos estiverem prontas, substituir os `background-image` no `.ftl` ou externalizar para `theme.properties`:

```properties
# Futuramente — imagens do carrossel
carousel.slide1.img=${resourcesPath}/img/slide-oficina.jpg
carousel.slide1.tag=Nossa Estrutura
carousel.slide1.title=Infraestrutura completa para o seu veículo
```

---

## Parte 3 — O que NÃO muda

- `dev-credentials` provider no `auth.ts` — permanece para desenvolvimento local
- Tela de login do Next.js (`/login`) — permanece como está
- `KEYCLOAK_CLIENT_SECRET` no `.env.local` — permanece vazio em dev (client público)
- Fluxo de autenticação no backend Django — sem alteração

---

## Critérios de conclusão

- [ ] `make dev` sobe o Keycloak sem erro (container `healthy`)
- [ ] `http://localhost:8080` abre o painel admin do Keycloak (`admin/admin`)
- [ ] `http://localhost:3001/login` → botão "Entrar com conta corporativa" redireciona para o tema customizado
- [ ] Login com `thiago@paddock.solutions / paddock123` funciona end-to-end
- [ ] Linhas neon animando no background
- [ ] Carrossel girando automaticamente
- [ ] Footer "Powered by Paddock Solutions" visível
- [ ] Sem link "Esqueci minha senha"
- [ ] Logo DS Car centralizada e visível

---

## Referências

- Mockup aprovado: `.superpowers/brainstorm/25576-1777083362/content/login-mockup-v4.html`
- Docker-compose: `infra/docker/docker-compose.dev.yml`
- Realm export: `infra/docker/keycloak/realm-export.json`
- Logo fonte: `apps/dscar-web/public/dscar-logo.png`
- Auth Next.js: `apps/dscar-web/src/lib/auth.ts`
