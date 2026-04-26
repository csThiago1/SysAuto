<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DS Car — Login</title>
  <link rel="stylesheet" href="${url.resourcesPath}/css/login.css">
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
               src="${url.resourcesPath}/img/logo-dscar.png"
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

<script src="${url.resourcesPath}/js/carousel.js"></script>

</body>
</html>
