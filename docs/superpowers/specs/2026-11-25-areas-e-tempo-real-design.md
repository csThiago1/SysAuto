# Áreas do ERP e tempo real — desenho

Data: 25/11/2026 · Autor: Thiago Campos + Claude · Status: aprovado pelo Thiago em 25/11/2026 · Áreas implementadas; tempo real parado (VM A1 abandonada)

## Contexto: o programa comercial

Este desenho é o primeiro de uma sequência que o Thiago quer para o comercial
da DS Car: CRM, caixa de entrada única, dashboard e analytics de anúncios.
Ordem combinada em 25/11/2026:

1. Ligar a medição da LP de anúncios (GA4, Google Ads, Meta, GTM): configuração na Vercel, tarefa do Thiago.
2. **Base: áreas separadas e tempo real (este documento).**
3. Caixa de entrada única: WhatsApp Business dos celulares da oficina (API oficial da Meta em modo coexistência, o app no celular continua funcionando) e Instagram. Evolution API e outras conexões por QR code foram descartadas (risco de banir o número).
4. CRM: leads e qualificação, cada lead é uma `Person` do ERP com veículos, OS e serviços anteriores na mesma tela.
5. Dashboard comercial: anúncio → conversa → orçamento → OS → faturamento.

Em paralelo: migração de clientes e veículos do Databox (o ERP tem 27 OS em produção; sem a migração a ficha do cliente fica vazia). Pré-requisito já entregue: telefone em texto claro e normalizado (PR csThiago1/SysAuto#50).

## Por quê

- **Foco.** Hoje todo mundo vê o mesmo menu com 115 telas (OS, financeiro, fiscal, RH, estoque, compras, CRM). Nas palavras do Thiago: "ficaria muita opção pro usuário numa tela só". Cada pessoa deve ver só a área em que trabalha.
- **Várias abas sem conflito.** A recepção vai ter a caixa de entrada numa aba e o Kanban em outra; o financeiro na dele. Cada aba precisa manter a sua área.
- **Telas que se atualizam sozinhas.** Quando alguém muda uma OS, quem está com o Kanban ou a OS aberta vê a mudança sem recarregar. A caixa de entrada (projeto 3) depende disso: mensagem nova tem que aparecer na hora.

## Objetivos

- Quatro áreas, cada uma com menu e tela inicial próprios (divisão aprovada pelo Thiago):
  - **Oficina** (recepção e pátio): OS, Kanban, agenda, recepção/nova OS, vistoria, apontamento, capacidade, orçamentos de seguradora, estoque e compras.
  - **Comercial**: retornos e regras de retorno (`/crm/*`), orçamentos particulares; depois caixa de entrada e leads.
  - **Financeiro**: financeiro, fiscal, RH.
  - **Gestão**: dashboard, cadastros, veículos, benchmark, auditoria, configurações, configuração do motor.
- Seletor de área sempre visível no menu, para trocar de área.
- Cada aba do navegador mantém a sua área, sem interferir nas outras.
- Tempo real: mudanças em OS chegam às telas abertas em poucos segundos, em qualquer computador ou celular do tenant.

## Fora do escopo

- Subdomínios (`comercial.sistema...`). Podem vir depois, por cima disto, se o Thiago quiser endereços próprios.
- Apps separados no monorepo.
- Telas novas ou redesenho das telas existentes (só o menu muda).
- Mudar permissões ou papéis. A área esconde itens do menu, não bloqueia acesso: as regras de papel e permissão de hoje (middleware e `nav-config`) continuam valendo.
- Tempo real para todas as entidades. A primeira versão cobre OS; a caixa de entrada entra no projeto 3 usando a mesma base.
- App mobile (React Native).

## O que seria fracasso mesmo funcionando

- Uma aba trocar a área de outra aba.
- Quebrar endereços que já existem: favoritos, links enviados por WhatsApp (`/confirmar-checklist`, `/convite`), links entre telas.
- O processo de tempo real estourar a memória da VM da Oracle e derrubar a API.
- Tela mostrando dado velho depois que o websocket cai e volta (evento perdido sem recuperação).

## Abordagens consideradas

**Áreas**
1. *Por caminho, num app só* — **escolhida**. Menu por área dentro do app atual; sem DNS, sem mexer no login.
2. *Por subdomínio, num app só* — o resultado na tela é o mesmo de 1, mas custa DNS na Hostinger, domínios na Vercel e ajuste no cookie de login. O cookie não pode ficar em `.oficinadscar.com.br`, senão iria para o site da conta da Hermes. Fica para depois, se o Thiago quiser.
3. *Apps separados* — descartada: quatro projetos para um dev solo manter, login compartilhado entre domínios.

**Tempo real**
- a. *Websocket do próprio ERP (Django Channels)* — **escolhida**. Channels e Redis já instalados, sem custo mensal.
- b. *Serviço gerenciado (Pusher/Ably)* — não mexe no servidor, mas tem mensalidade e um fornecedor a mais.
- c. *Polling curto* — sem infraestrutura, mas pesa na Oracle e chega atrasado. Fica como reserva.

## Como funciona hoje (o que o desenho toca)

- **Menu**: `apps/dscar-web/src/components/dock/nav-config.ts` (`NAV_SECTIONS`, `MOBILE_TABS`) alimenta `Sidebar.tsx`, `MobileTabBar.tsx` e `CommandPalette.tsx`. Os itens já são filtrados por papel e permissão.
- **Layout**: `apps/dscar-web/src/app/(app)/layout.tsx` monta Sidebar, MobileTabBar e CommandPalette para todas as telas.
- **Chamadas à API**: o navegador fala com `/api/proxy/[...path]` (Next), que injeta `Authorization: Bearer <accessToken>` e `X-Tenant-Domain`. O token não fica exposto no navegador.
- **Backend**: `config/asgi.py` já roteia websocket para `apps/service_orders/routing.py`; `apps/service_orders/consumers.py` é um esqueleto que só aceita conexão e usa `AuthMiddlewareStack` (sessão do Django). Ou seja, recusaria os usuários, que entram por JWT. `CHANNEL_LAYERS` usa `channels_redis`.
- **Produção (Oracle), lida na VM em 25/11/2026** (só leitura, com OK do Thiago):
  - Máquina x86_64 com 2 vCPU, 946 MB de RAM e 2,5 GB de swap. Estava com 722 MB em uso, 223 MB disponíveis e **897 MB em swap**.
  - A VM é **compartilhada com a Granja Pesqueirão**: API, worker e beat dela somam cerca de 370 MB, quase tudo em swap.
  - A API da DS Car roda com gunicorn WSGI (`paddock-api.service`, `MemoryMax=350M`), sem suporte a websocket. Os 2 workers ocupam cerca de 130 MB cada, a maior parte em swap.
  - `paddock-worker` e `paddock-beat` (Celery da DS Car) estão **parados** em produção.
  - Redis local usa 1,2 MB, com `allkeys-lru`.
  - Caddy real (`/etc/caddy/Caddyfile`): `147-15-19-48.sslip.io` → `127.0.0.1:8000`, mais o site da Granja. O `infra/oracle/Caddyfile` do repositório está desatualizado.
  - O banco é o Neon.

## Desenho

### 1. Áreas

- **As URLs não mudam.** A área é um agrupamento das rotas que já existem, não um prefixo novo. Nenhum link quebra.
- **Fonte única**: cada **item** de `nav-config.ts` ganha a área a que pertence (`oficina | comercial | financeiro | gestao`). A marcação é por item, não por seção, porque a seção "GERAL" mistura quatro áreas. As rotas que não estão no menu (ex.: `/os/[numero]`, `/recepcao`, `/os/[numero]/vistoria`, `/apontamento`, `/capacidade`, `/orcamentos`, `/benchmark`, `/auditoria`, `/configuracao-motor`) entram só numa tabela de rota → área. A divisão está nos Objetivos.
- **Nenhum item novo no menu** *(decisão do Claude)*: telas que hoje ficam fora do menu (apontamento, capacidade, benchmark, motor) continuam fora. Elas só ganham área para o menu certo aparecer quando forem abertas. Assim nenhuma tela fica visível para papéis que hoje não a veem.
- **Menu**: Sidebar, CommandPalette e o sheet "Mais" do celular mostram só as seções da área ativa, com o seletor de área no topo. O filtro por papel/permissão de hoje continua sendo aplicado por cima.
- **Qual área está ativa em cada aba**:
  - Se a rota pertence a uma só área, a área é essa.
  - Se a rota é compartilhada (ex.: detalhe da OS aberto a partir do Comercial, cadastro de pessoa), fica a última área daquela aba, guardada em `sessionStorage`. O `sessionStorage` é separado por aba, e é isso que impede uma aba de mexer na outra.
  - Aba nova sem histórico: área da rota; se a rota for compartilhada, a área padrão do papel do usuário.
- **Tela inicial de cada área**: `/oficina`, `/comercial`, `/financeiro` (já existe a visão geral do financeiro) e `/gestao`. São rotas curtas que levam à tela inicial da área. A raiz `/` e o pós-login levam à área padrão do papel.
- **Área padrão por papel**: decisão do construtor, a partir de `ROLE_HIERARCHY` e dos papéis existentes. Sem área padrão definida, cai em Oficina.
- **Menu do celular** (`MOBILE_TABS`) *(decisão do Claude)*: nesta versão as abas fixas não mudam (Início → `/dashboard`, OS, Agenda, Apontar), porque são a operação da Oficina e é isso que se usa no celular. O sheet "Mais" (MANAGER+ como hoje) ganha o seletor de área e mostra só a área ativa. Trocar de área no celular para papéis abaixo de MANAGER fica para o projeto 3, quando a caixa de entrada chegar ao celular.

### 2. Tempo real

**Servidor (Oracle)**
- Processo **separado** só para websocket: uvicorn rodando `config.asgi:application`, num serviço systemd próprio (`paddock-ws.service`) com `MemoryMax` baixo. Fica isolado da API para que um vazamento ou pico no websocket não derrube o gunicorn. O gunicorn WSGI continua atendendo todo o HTTP.
- O Caddy encaminha `/ws/*` para o processo de websocket e o resto para o gunicorn. O `infra/oracle/Caddyfile` do repositório **não** é o que está em produção (aponta para `api:8000`, do docker-compose, enquanto o gunicorn roda direto em `127.0.0.1:8000`). Ler o Caddyfile e o host público reais na VM antes de escrever a mudança, e trazer a versão real para o repositório.
- O host do `wss://` é o mesmo host público da API que o proxy usa (`BACKEND_URL`; hoje `147-15-19-48.sslip.io`). O `ALLOWED_HOSTS` precisa aceitar a origem `sistema.oficinadscar.com.br` no `AllowedHostsOriginValidator`.
- **Redis** *(decisão do Claude)*: trocar `maxmemory-policy` de `allkeys-lru` para `volatile-lru`. Com `allkeys-lru`, o Redis pode apagar filas do Celery e grupos do Channels quando enche. Com `volatile-lru`, só apaga chaves com prazo de validade (cache). O `maxmemory` de 48 MB fica.
- **Memória**: a VM já trabalha em swap (897 MB). Um uvicorn com o Django inteiro somaria mais cerca de 130 MB, que iriam para o swap e deixariam a API mais lenta. **O websocket não cabe nesta VM.** Ver Ordem de entrega.

**Login no websocket (ticket)**
- O navegador não tem o JWT (ele fica no proxy). Fluxo:
  1. O navegador pede `GET /api/proxy/realtime/ticket` (autenticado como qualquer chamada).
  2. O backend devolve um ticket assinado (`django.core.signing.TimestampSigner`) com o id do usuário e o schema do tenant, válido por 60 s.
  3. O navegador abre `wss://<host da API>/ws/realtime/?ticket=...`.
  4. O consumer valida a assinatura e a validade, recusa se inválido e entra no grupo `tenant_<schema>`.
- Ticket renovado a cada reconexão. Nada de PII no ticket nem nos eventos.
- O consumer novo substitui o esqueleto de `apps/service_orders/consumers.py` e o `AuthMiddlewareStack` (que não serve para JWT).

**Eventos**
- Formato mínimo: `{"entity": "service_order", "id": <id>, "action": "changed"}`. O evento só avisa; quem quer o dado busca de novo pela API, com as permissões de sempre.
- Emitidos depois do commit (`transaction.on_commit`) para o grupo do tenant, via `channel_layer.group_send` (`async_to_sync` no gunicorn).
- Primeira versão: `ServiceOrder` criada ou alterada, incluindo mudança de status no Kanban. Onde emitir (sinal `post_save` ou serviços de OS) e se mudanças em itens, fotos e pagamentos também disparam o evento da OS fica para o construtor; o critério é Kanban e detalhe da OS nunca ficarem velhos.
- Falha ao publicar (Redis fora) é logada e **não** quebra a gravação da OS.
- Toda query do consumer, se houver, usa `schema_context(schema)` (regra de multitenancy).

**Navegador**
- Um provider no layout `(app)` abre **um** websocket por aba, com reconexão automática com espera crescente.
- Cada evento invalida as queries do TanStack Query ligadas à entidade (ex.: `service_order` → lista, Kanban e detalhe daquela OS). Um mapa entidade → chaves de query, num lugar só.
- Ao reconectar: invalida todas as queries ativas (cobre eventos perdidos enquanto estava fora).
- Aba em segundo plano pode fechar o socket e reabrir ao voltar (decisão do construtor).
- Os `refetchInterval` que existem hoje (vistoria 6 s, capacidade, RH, transição) ficam como estão nesta versão.

## Ordem de entrega

1. **Áreas (parte 1)**: entram já, só frontend, sem mexer no servidor. Implementadas na branch `docs/areas-tempo-real`.
2. **Tempo real (parte 2)**: o websocket não cabe na VM atual. A mudança para uma VM A1 foi **abandonada em 25/11/2026**: a Oracle está sem capacidade de A1 e o Thiago decidiu trabalhar com o que existe até ter um MVP que justifique pagar uma VM melhor. A parte 2 fica parada até uma destas saídas: uma VM paga, ou um redesenho que caiba na VM atual sem processo novo, como aliviar o swap primeiro ou usar um serviço gerenciado. Até lá, os `refetchInterval` atuais continuam. Qualquer plano de infra não pode depender de trabalho manual do Thiago.

Em aberto, fora deste desenho: o Celery da DS Car (`paddock-worker`, `paddock-beat`) está parado em produção, e com ele os retornos automáticos e as tarefas agendadas. Conferir se foi de propósito.

## Restrições

- Regras do CLAUDE.md do ERP: `schema_context` em toda query, Celery recebe `tenant_schema`, nada de PII em log, type hints, TypeScript strict sem `any`, dados da API validados com Zod.
- Memória da Oracle (500 MB): nenhum processo novo pode ameaçar o gunicorn.
- Deploy na Oracle (unit systemd, Caddy, uvicorn) só com o OK explícito do Thiago; SSH só com autorização dele.
- Frontend publica pela Vercel (projeto `sys-auto-dscar-web`, domínio `sistema.oficinadscar.com.br`).
- A suíte pytest é lenta e já tem falhas antigas: rodar só os testes dos arquivos tocados, com `TenantTestCase`.

## Como saber que deu certo

- Com duas abas abertas, uma em Oficina e outra em Comercial, cada uma mantém o seu menu ao navegar, inclusive quando as duas abrem a mesma OS.
- Todos os endereços que existem hoje continuam abrindo a mesma tela.
- Uma OS movida no Kanban num computador aparece movida no outro em até ~3 s, sem recarregar.
- Com o websocket derrubado e religado, a tela volta a mostrar o dado atual.
- O processo de websocket e o gunicorn ficam dentro dos limites de memória medidos na VM.

## Fica para o construtor

- Formato exato do mapa rota → área e do mapa entidade → queries.
- Área padrão de cada papel.
- Onde emitir o evento da OS (sinal ou serviço) e quais mudanças relacionadas disparam.
- Visual do seletor de área: segue o estilo atual do menu. Sem tela nova para mostrar ao Thiago antes.
- Biblioteca de reconexão: `WebSocket` nativo com backoff simples, sem dependência nova.
- Limite de memória do `paddock-ws.service` depois de medir.
