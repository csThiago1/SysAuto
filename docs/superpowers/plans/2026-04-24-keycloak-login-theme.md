# Keycloak Activation + DS Car Login Theme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ativar o Keycloak no ambiente de desenvolvimento e aplicar o tema de login customizado da DS Car (split 50/50, linhas neon animadas, carrossel de imagens, logo DS Car centralizada).

**Architecture:** O Keycloak já está declarado no `docker-compose.dev.yml` e o schema PostgreSQL é criado automaticamente pelo `infra/docker/init/01_setup.sql`. Basta adicionar o volume do tema, atualizar o `realm-export.json` e criar os arquivos do tema Freemarker. Como o Keycloak importa o realm automaticamente na primeira inicialização (`--import-realm`), um `make dev-reset && make dev` aplica tudo do zero.

**Tech Stack:** Keycloak 24 (tema Freemarker `.ftl`), CSS puro, JavaScript vanilla, Docker Compose.

---

## Mapa de Arquivos

| Ação | Arquivo |
|------|---------|
| Modificar | `infra/docker/docker-compose.dev.yml` |
| Modificar | `infra/docker/keycloak/realm-export.json` |
| Criar | `infra/docker/keycloak/themes/paddock/login/theme.properties` |
| Criar | `infra/docker/keycloak/themes/paddock/login/login.ftl` |
| Criar | `infra/docker/keycloak/themes/paddock/login/resources/css/login.css` |
| Criar | `infra/docker/keycloak/themes/paddock/login/resources/js/carousel.js` |
| Copiar | `infra/docker/keycloak/themes/paddock/login/resources/img/logo-dscar.png` |

---

## Task 1: Volume do tema + realm-export.json

**Files:**
- Modify: `infra/docker/docker-compose.dev.yml`
- Modify: `infra/docker/keycloak/realm-export.json`

- [ ] **Step 1: Adicionar volume do tema no docker-compose**

Em `infra/docker/docker-compose.dev.yml`, localizar o bloco `volumes:` do serviço `keycloak` e adicionar a linha do tema:

```yaml
  keycloak:
    ...
    volumes:
      - ./keycloak/realm-export.json:/opt/keycloak/data/import/realm-export.json
      - ./keycloak/themes/paddock:/opt/keycloak/themes/paddock
```

- [ ] **Step 2: Ativar o tema e desativar reset de senha no realm**

Em `infra/docker/keycloak/realm-export.json`, alterar as duas linhas:

```json
{
  "realm": "paddock",
  "enabled": true,
  "displayName": "Paddock Solutions",
  "loginTheme": "paddock",
  "resetPasswordAllowed": false,
  ...
}
```

- [ ] **Step 3: Criar a estrutura de diretórios do tema**

```bash
mkdir -p infra/docker/keycloak/themes/paddock/login/resources/css
mkdir -p infra/docker/keycloak/themes/paddock/login/resources/js
mkdir -p infra/docker/keycloak/themes/paddock/login/resources/img
```

- [ ] **Step 4: Copiar a logo da DS Car**

```bash
cp apps/dscar-web/public/dscar-logo.png \
   infra/docker/keycloak/themes/paddock/login/resources/img/logo-dscar.png
```

- [ ] **Step 5: Commit**

```bash
git add infra/docker/docker-compose.dev.yml \
        infra/docker/keycloak/realm-export.json \
        infra/docker/keycloak/themes/
git commit -m "chore(keycloak): adiciona volume tema + ativa loginTheme paddock no realm"
```

---

## Task 2: theme.properties

**Files:**
- Create: `infra/docker/keycloak/themes/paddock/login/theme.properties`

- [ ] **Step 1: Criar theme.properties**

```properties
parent=base
import=common/keycloak

styles=css/login.css
scripts=js/carousel.js

locales=pt-BR
```

> `parent=base` herda apenas o mínimo necessário do Keycloak (processamento de variáveis Freemarker). Não herda CSS ou HTML do tema padrão.

- [ ] **Step 2: Commit**

```bash
git add infra/docker/keycloak/themes/paddock/login/theme.properties
git commit -m "feat(keycloak): theme.properties do tema paddock"
```

---

## Task 3: carousel.js

**Files:**
- Create: `infra/docker/keycloak/themes/paddock/login/resources/js/carousel.js`

- [ ] **Step 1: Criar carousel.js**

```javascript
(function () {
  var current = 0;

  document.addEventListener('DOMContentLoaded', function () {
    var slides = document.querySelectorAll('.slide');
    var dots   = document.querySelectorAll('.dot');

    if (!slides.length) return;

    function goTo(n) {
      slides[current].classList.remove('active');
      dots[current].classList.remove('active');
      current = n;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { goTo(i); });
    });

    setInterval(function () {
      goTo((current + 1) % slides.length);
    }, 4500);
  });
}());
```

- [ ] **Step 2: Commit**

```bash
git add infra/docker/keycloak/themes/paddock/login/resources/js/carousel.js
git commit -m "feat(keycloak): carousel.js — autoplay 4.5s + dot navigation"
```

---

## Task 4: login.css

**Files:**
- Create: `infra/docker/keycloak/themes/paddock/login/resources/css/login.css`

- [ ] **Step 1: Criar login.css**

```css
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  height: 100%;
  font-family: 'Montserrat', sans-serif;
  background: #0a0a0a;
  overflow: hidden;
  color: #fff;
}

/* ── Estrutura raiz ────────────────────────────────── */
.kc-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* ── Neon background ───────────────────────────────── */
.neon-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: #0a0a0a;
}

.neon-line { position: absolute; opacity: 0; border-radius: 2px; }

.neon-line.h {
  height: 1px;
  width: 140px;
  background: linear-gradient(90deg, transparent, #ea0e03, transparent);
  animation: travel-h linear infinite;
}

.neon-line.v {
  width: 1px;
  height: 100px;
  background: linear-gradient(180deg, transparent, #ea0e03, transparent);
  animation: travel-v linear infinite;
}

@keyframes travel-h {
  0%   { transform: translateX(-150px); opacity: 0; }
  5%   { opacity: 0.8; }
  95%  { opacity: 0.8; }
  100% { transform: translateX(calc(100vw + 150px)); opacity: 0; }
}

@keyframes travel-v {
  0%   { transform: translateY(-110px); opacity: 0; }
  5%   { opacity: 0.6; }
  95%  { opacity: 0.6; }
  100% { transform: translateY(calc(100vh + 110px)); opacity: 0; }
}

/* Timings das linhas horizontais */
.neon-line:nth-child(1)  { top:  8%; animation-duration: 4.0s; animation-delay: 0.0s; box-shadow: 0 0 6px #ea0e03; }
.neon-line:nth-child(2)  { top: 19%; animation-duration: 5.2s; animation-delay: 0.7s; box-shadow: 0 0 4px #ff4444; }
.neon-line:nth-child(3)  { top: 31%; animation-duration: 3.6s; animation-delay: 1.5s; box-shadow: 0 0 6px #ea0e03; }
.neon-line:nth-child(4)  { top: 44%; animation-duration: 6.1s; animation-delay: 0.3s; box-shadow: 0 0 4px #c50b02; }
.neon-line:nth-child(5)  { top: 57%; animation-duration: 4.4s; animation-delay: 2.0s; box-shadow: 0 0 6px #ea0e03; }
.neon-line:nth-child(6)  { top: 68%; animation-duration: 3.9s; animation-delay: 1.1s; box-shadow: 0 0 4px #ff6b6b; }
.neon-line:nth-child(7)  { top: 79%; animation-duration: 5.5s; animation-delay: 1.4s; box-shadow: 0 0 5px #ea0e03; }
.neon-line:nth-child(8)  { top: 90%; animation-duration: 4.2s; animation-delay: 2.6s; box-shadow: 0 0 4px #ff3333; }
.neon-line:nth-child(9)  { top: 24%; animation-duration: 3.3s; animation-delay: 0.5s; box-shadow: 0 0 5px #ea0e03; }
.neon-line:nth-child(10) { top: 62%; animation-duration: 5.8s; animation-delay: 1.9s; box-shadow: 0 0 4px #c50b02; }

/* Timings das linhas verticais */
.neon-line:nth-child(11) { left: 10%; animation-duration: 4.2s; animation-delay: 0.4s; box-shadow: 0 0 6px #ea0e03; }
.neon-line:nth-child(12) { left: 25%; animation-duration: 5.1s; animation-delay: 1.3s; box-shadow: 0 0 4px #ff4444; }
.neon-line:nth-child(13) { left: 40%; animation-duration: 3.7s; animation-delay: 0.8s; box-shadow: 0 0 6px #ea0e03; }
.neon-line:nth-child(14) { left: 60%; animation-duration: 4.8s; animation-delay: 2.3s; box-shadow: 0 0 4px #c50b02; }
.neon-line:nth-child(15) { left: 78%; animation-duration: 3.4s; animation-delay: 1.0s; box-shadow: 0 0 5px #ea0e03; }
.neon-line:nth-child(16) { left: 92%; animation-duration: 5.3s; animation-delay: 1.7s; box-shadow: 0 0 4px #ff6b6b; }

/* ── Layout principal ──────────────────────────────── */
.layout {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  min-height: 0;
}

/* ── Painel esquerdo (formulário) ──────────────────── */
.left {
  width: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 56px;
  background: rgba(10, 10, 10, 0.80);
  backdrop-filter: blur(8px);
  border-right: 1px solid rgba(234, 14, 3, 0.12);
  position: relative;
}

.left::before {
  content: '';
  position: absolute;
  top: -80px;
  left: -80px;
  width: 380px;
  height: 380px;
  background: radial-gradient(circle, rgba(234, 14, 3, 0.07) 0%, transparent 70%);
  pointer-events: none;
}

.form-container {
  width: 100%;
  max-width: 340px;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Logo */
.logo-area {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  width: 100%;
}

.logo-img {
  width: 75%;
  height: auto;
  object-fit: contain;
  filter: brightness(0) invert(1);
}

.logo-divider {
  width: 40px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #ea0e03, transparent);
  margin-bottom: 32px;
  border-radius: 2px;
}

/* Títulos */
.welcome-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
  text-align: center;
}

.welcome-sub {
  font-size: 12px;
  color: #4a4a4a;
  margin-bottom: 28px;
  text-align: center;
}

/* Campos */
.fields-wrap { width: 100%; }

.field { margin-bottom: 18px; }

.field label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 7px;
}

.field input {
  width: 100%;
  height: 46px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid #222;
  border-radius: 9px;
  color: #fff;
  font-size: 14px;
  font-family: 'Montserrat', sans-serif;
  padding: 0 14px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.field input:focus {
  border-color: #ea0e03;
  background: rgba(234, 14, 3, 0.04);
  box-shadow: 0 0 0 3px rgba(234, 14, 3, 0.08);
}

.field input::placeholder { color: #333; }

/* Mensagem de erro */
.error-msg {
  background: rgba(234, 14, 3, 0.1);
  border: 1px solid rgba(234, 14, 3, 0.3);
  border-radius: 8px;
  color: #ff6b6b;
  font-size: 12px;
  padding: 10px 14px;
  margin-bottom: 16px;
  text-align: center;
}

/* Botão */
.btn-login {
  width: 100%;
  height: 48px;
  background: linear-gradient(135deg, #ea0e03, #c50b02);
  border: none;
  border-radius: 9px;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  font-family: 'Montserrat', sans-serif;
  cursor: pointer;
  letter-spacing: 0.4px;
  margin-top: 8px;
  transition: opacity 0.2s, box-shadow 0.2s;
  box-shadow: 0 4px 24px rgba(234, 14, 3, 0.35);
}

.btn-login:hover {
  opacity: 0.9;
  box-shadow: 0 4px 32px rgba(234, 14, 3, 0.5);
}

/* ── Painel direito (carrossel) ────────────────────── */
.right {
  width: 50%;
  position: relative;
  overflow: hidden;
  background: #0d0d0d;
}

.slide {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 1.4s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slide.active { opacity: 1; }

.slide-1 { background: linear-gradient(135deg, #1a0202 0%, #3a0505 50%, #0d0d0d 100%); }
.slide-2 { background: linear-gradient(160deg, #0d0d0d 0%, #2a0404 60%, #1a0202 100%); }
.slide-3 { background: linear-gradient(200deg, #220303 0%, #0d0d0d 50%, #2d0606 100%); }
.slide-4 { background: linear-gradient(120deg, #0d0d0d 0%, #1a0202 40%, #3a0505 100%); }

.slide-inner {
  text-align: center;
  padding: 40px;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.8s ease 0.5s, transform 0.8s ease 0.5s;
}

.slide.active .slide-inner { opacity: 1; transform: translateY(0); }

.slide-icon {
  font-size: 56px;
  margin-bottom: 20px;
  display: block;
  filter: drop-shadow(0 0 24px rgba(234, 14, 3, 0.5));
}

.slide-tag {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  color: #ea0e03;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: 10px;
}

.slide-title {
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  line-height: 1.25;
  margin-bottom: 10px;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.6);
}

.slide-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  line-height: 1.7;
  max-width: 260px;
  margin: 0 auto;
}

/* Blend esquerdo do carrossel */
.right::before {
  content: '';
  position: absolute;
  top: 0; left: 0; bottom: 0;
  width: 90px;
  background: linear-gradient(90deg, #0a0a0a, transparent);
  z-index: 3;
  pointer-events: none;
}

/* Dots */
.carousel-dots {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 4;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.15);
  cursor: pointer;
  transition: all 0.4s;
  border: none;
  padding: 0;
}

.dot.active {
  background: #ea0e03;
  width: 22px;
  box-shadow: 0 0 8px rgba(234, 14, 3, 0.6);
}

/* ── Footer ────────────────────────────────────────── */
.footer {
  position: relative;
  z-index: 10;
  text-align: center;
  padding: 10px;
  font-size: 11px;
  color: #2a2a2a;
  font-weight: 500;
  letter-spacing: 0.4px;
  background: rgba(0, 0, 0, 0.6);
  border-top: 1px solid rgba(255, 255, 255, 0.03);
}

.footer strong { color: #ea0e03; font-weight: 700; }
```

- [ ] **Step 2: Commit**

```bash
git add infra/docker/keycloak/themes/paddock/login/resources/css/login.css
git commit -m "feat(keycloak): login.css — dark theme, neon lines, split layout, carousel"
```

---

## Task 5: login.ftl

**Files:**
- Create: `infra/docker/keycloak/themes/paddock/login/login.ftl`

> `.ftl` é Freemarker Template Language — as tags `<#if>`, `${variavel}` são interpretadas pelo Keycloak antes de servir o HTML ao browser.

- [ ] **Step 1: Criar login.ftl**

```freemarker
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DS Car — Login</title>
  <link rel="stylesheet" href="${resourcesPath}/css/login.css">
</head>
<body>

<div class="kc-root">

  <!-- Neon background lines -->
  <div class="neon-bg">
    <div class="neon-line h"></div>
    <div class="neon-line h"></div>
    <div class="neon-line h"></div>
    <div class="neon-line h"></div>
    <div class="neon-line h"></div>
    <div class="neon-line h"></div>
    <div class="neon-line h"></div>
    <div class="neon-line h"></div>
    <div class="neon-line h"></div>
    <div class="neon-line h"></div>
    <div class="neon-line v"></div>
    <div class="neon-line v"></div>
    <div class="neon-line v"></div>
    <div class="neon-line v"></div>
    <div class="neon-line v"></div>
    <div class="neon-line v"></div>
  </div>

  <div class="layout">

    <!-- LEFT: Formulário de login -->
    <div class="left">
      <div class="form-container">

        <div class="logo-area">
          <img class="logo-img"
               src="${resourcesPath}/img/logo-dscar.png"
               alt="DS Car">
        </div>

        <div class="logo-divider"></div>

        <div class="fields-wrap">
          <div class="welcome-title">Bem-vindo de volta</div>
          <div class="welcome-sub">Acesse sua conta para continuar</div>

          <form id="kc-form-login"
                action="${url.loginAction}"
                method="post">

            <input type="hidden"
                   name="credentialId"
                   <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>>

            <#if messagesPerField.existsError('username','password')>
              <div class="error-msg">
                ${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}
              </div>
            </#if>

            <div class="field">
              <label for="username">E-mail</label>
              <input type="email"
                     id="username"
                     name="username"
                     value="${(login.username!'')}"
                     autocomplete="email"
                     autofocus
                     placeholder="seu@dscar.com.br">
            </div>

            <div class="field">
              <label for="password">Senha</label>
              <input type="password"
                     id="password"
                     name="password"
                     autocomplete="current-password"
                     placeholder="••••••••">
            </div>

            <button class="btn-login" type="submit" name="login">
              Entrar
            </button>

          </form>
        </div>

      </div>
    </div>

    <!-- RIGHT: Carrossel -->
    <div class="right">

      <div class="slide slide-1 active">
        <div class="slide-inner">
          <span class="slide-icon">🏢</span>
          <div class="slide-tag">Nossa Estrutura</div>
          <div class="slide-title">Infraestrutura completa<br>para o seu veículo</div>
          <div class="slide-desc">Equipamentos modernos e espaço preparado para oferecer o melhor serviço</div>
        </div>
      </div>

      <div class="slide slide-2">
        <div class="slide-inner">
          <span class="slide-icon">👨‍🔧</span>
          <div class="slide-tag">Nossa Equipe</div>
          <div class="slide-title">Profissionais dedicados<br>ao seu veículo</div>
          <div class="slide-desc">Técnicos especializados com anos de experiência no setor automotivo</div>
        </div>
      </div>

      <div class="slide slide-3">
        <div class="slide-inner">
          <span class="slide-icon">🔧</span>
          <div class="slide-tag">Funilaria &amp; Pintura</div>
          <div class="slide-title">Excelência em cada<br>detalhe</div>
          <div class="slide-desc">Restauramos a beleza original do seu veículo com precisão e cuidado</div>
        </div>
      </div>

      <div class="slide slide-4">
        <div class="slide-inner">
          <span class="slide-icon">✨</span>
          <div class="slide-tag">Estética Automotiva</div>
          <div class="slide-title">Seu carro brilhando<br>como novo</div>
          <div class="slide-desc">Serviços completos de estética para manter seu veículo impecável</div>
        </div>
      </div>

      <div class="carousel-dots">
        <button class="dot active"></button>
        <button class="dot"></button>
        <button class="dot"></button>
        <button class="dot"></button>
      </div>

    </div>

  </div>

  <div class="footer">
    Powered by <strong>Paddock Solutions</strong>
  </div>

</div>

<script src="${resourcesPath}/js/carousel.js"></script>

</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add infra/docker/keycloak/themes/paddock/login/login.ftl
git commit -m "feat(keycloak): login.ftl — template Freemarker com tema DS Car"
```

---

## Task 6: Subir e verificar

- [ ] **Step 1: Parar e limpar ambiente existente**

> Necessário para que o Keycloak reimporte o realm com o novo tema. **Atenção: apaga dados do banco de desenvolvimento.**

```bash
make dev-stop
make dev-reset
```

Expected: containers parados, volume `paddock_postgres_data` removido.

- [ ] **Step 2: Subir ambiente**

```bash
make dev
```

Expected: containers subindo. O Keycloak demora ~60-90s para ficar `healthy`.

- [ ] **Step 3: Aguardar Keycloak healthy**

```bash
make dev-ps
```

Expected: coluna `STATUS` do `paddock_keycloak` mostrando `healthy`. Repetir até isso aparecer (pode levar até 2 minutos).

- [ ] **Step 4: Verificar painel admin do Keycloak**

Abrir: `http://localhost:8080`
Login: `admin` / `admin`

Navegar em: **Realm paddock → Realm Settings → Themes**

Verificar:
- **Login theme:** `paddock` ✅
- Se não estiver selecionado, selecionar manualmente e salvar.

- [ ] **Step 5: Verificar a tela de login customizada**

Abrir: `http://localhost:3001/login`
Clicar em: **"Entrar com conta corporativa"**

Expected: redireciona para `http://localhost:8080/realms/paddock/protocol/openid-connect/auth?...` com o tema aplicado — fundo escuro, linhas neon animadas, split 50/50, logo DS Car, carrossel.

- [ ] **Step 6: Testar login end-to-end**

Na tela de login do Keycloak:
- Email: `thiago@paddock.solutions`
- Senha: `paddock123`
- Clicar em **Entrar**

Expected: redireciona para `http://localhost:3001/service-orders` (ou `/os`) — sessão autenticada via Keycloak.

- [ ] **Step 7: Testar mensagem de erro**

Na tela de login do Keycloak:
- Email: `qualquer@email.com`
- Senha: `errada`
- Clicar em **Entrar**

Expected: aparece o `div.error-msg` em vermelho com mensagem de credenciais inválidas. Layout não quebra.

- [ ] **Step 8: Commit final**

```bash
git add infra/docker/keycloak/themes/paddock/login/resources/img/logo-dscar.png
git commit -m "feat(keycloak): tema de login DS Car — ativação completa ✅"
```

---

## Substituir fotos do carrossel (futuro)

Quando as fotos estiverem prontas, substituir os 4 slides no `login.ftl`. Trocar o bloco `.slide` para usar `background-image`:

```freemarker
<div class="slide slide-1 active"
     style="background-image: url('${resourcesPath}/img/slide-oficina.jpg'); background-size: cover; background-position: center;">
  <div class="slide-inner">
    ...
  </div>
</div>
```

Adicionar overlay escuro no `.slide` com foto (no CSS):

```css
.slide[style*="background-image"]::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to right,
    rgba(10,10,10,0.65) 0%,
    rgba(0,0,0,0.2) 100%
  );
}
```

Copiar as imagens para `infra/docker/keycloak/themes/paddock/login/resources/img/`.
