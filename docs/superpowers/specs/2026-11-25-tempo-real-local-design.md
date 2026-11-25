# Tempo real só local — desenho curto

Data: 25/11/2026 · Autor: Thiago Campos + Claude · Status: aguardando aprovação
Substitui a "Ordem de entrega" da parte 2 de `2026-11-25-areas-e-tempo-real-design.md`. O resto da parte 2 continua valendo: ticket assinado, eventos "busque de novo" e provider no layout.

## Por quê

A VM A1 não existe: a Oracle está sem capacidade há mais de um ano. Na VM atual, que já trabalha em swap, o websocket não cabe. O Thiago quer um MVP que convença a empresa a pagar uma VM melhor, e escolheu deixar o tempo real **rodando só no ambiente local** (Docker do Mac). Ele serve para demonstração. Em produção nada muda até haver a VM paga.

## Objetivos

- No Docker local: uma OS movida no Kanban numa janela aparece movida na outra em até ~3 s, sem recarregar. O mesmo vale para o detalhe da OS.
- Produção fica exatamente como hoje: sem processo novo, sem tráfego novo, nenhuma mudança na Oracle ou na Vercel.
- Quando vier a VM paga, ligar em produção é infraestrutura (serviço systemd, Caddy, env vars), sem reescrever código.

## Fora do escopo / anti-objetivos

- Qualquer mudança na Oracle (`volatile-lru` no Redis, `paddock-ws.service`, Caddy). Isso fica para a VM paga.
- Polling novo em produção. Os `refetchInterval` atuais continuam.
- Fracasso mesmo funcionando: o código novo pesar ou quebrar algo em produção quando for publicado junto com outros deploys.

## Abordagens consideradas

1. *Aviso leve a cada ~3 s em produção* (contador no Redis): cabia na VM, mas o Thiago preferiu não mexer em produção agora.
2. *Websocket dentro do gunicorn (worker ASGI)*: descartada. O Django passaria a atender uma requisição por vez em cada worker e o ERP inteiro ficaria mais lento.
3. *Websocket só local* — **escolhida pelo Thiago**. É o desenho original, ligado apenas no ambiente local.

## Desenho

**Interruptor**
- Backend: `REALTIME_ENABLED = config("REALTIME_ENABLED", default=False, cast=bool)` em `base.py`, com `True` no `dev.py`. Desligado, nenhum evento é publicado e nenhuma ida ao Redis acontece ao salvar uma OS.
- Frontend: o provider só abre websocket se `NEXT_PUBLIC_REALTIME_WS_URL` estiver definida. Na Vercel ela não existe, então nada acontece em produção.

**Processo local separado** *(decisão do Claude)*
- Serviço novo no `infra/docker/docker-compose.dev.yml`: `paddock_ws`, com a mesma imagem do `paddock_django`, rodando `uvicorn config.asgi:application --host 0.0.0.0 --port 8001 --reload`. É a mesma topologia planejada para produção (gunicorn para HTTP e um processo só para websocket), e o `runserver` de hoje não muda.
- `uvicorn[standard]` entra no `requirements/dev.txt`. Ele já está no `prod.txt`, então não é dependência nova no projeto.
- Local: `NEXT_PUBLIC_REALTIME_WS_URL=ws://localhost:8001/ws/realtime/`. Para demonstrar no celular pela mesma rede Wi-Fi, troca-se para o IP do Mac.

**Backend**: igual à spec original.
- `GET /api/v1/realtime/ticket/` devolve um ticket `TimestampSigner` (id do usuário + schema, válido por 60 s).
- Consumer em `ws/realtime/`: valida o ticket, entra no grupo `tenant_<schema>`, sem PII.
- Evento `{"entity":"service_order","id":…, "action":"changed"}` publicado em `transaction.on_commit`. Falha é logada e não quebra a gravação.
- O esqueleto `ws/service-orders/<uuid>` com `AuthMiddlewareStack` sai, porque nada no frontend o usa.

**Frontend**: igual à spec original.
- Um websocket por aba, no layout `(app)`, com reconexão e espera crescente.
- Um mapa entidade → chaves do TanStack Query.
- Ao reconectar, invalida as queries ativas.

## Restrições

Regras do CLAUDE.md (`schema_context`, type hints, TS strict, Zod no ticket). Suíte pytest lenta: rodar só os testes novos. Nenhum passo do plano depende de ação manual do Thiago.

## Como saber que deu certo

- Docker local com duas janelas: o Kanban de uma atualiza ao mover OS na outra em ≤ 3 s. Com `paddock_ws` derrubado e religado, a tela volta ao dado atual.
- Com `REALTIME_ENABLED` falso e a env do frontend ausente (situação de produção): nenhuma conexão websocket e nenhuma publicação no Redis. Um teste cobre isso.

## Fica para o construtor

Onde emitir o evento da OS (sinal ou serviço), o formato do mapa entidade → queries e se a aba em segundo plano fecha o socket.
