# Motor de Retorno ao Cliente (Follow-ups) — Design

**Data:** 2026-08-17 · **Status:** aprovado em brainstorming
**Pedido do cliente:** "CRM, queremos ter agendadores de retorno com o cliente. Após X
horas perguntar o que achou do serviço, se gostou, se poderia fazer um review no
Google. Após 1 mês oferecer revisão, lavagem etc."
**Objetivo:** agendar e executar retornos pós-entrega de forma automática, começando
por uma fila de tarefas para a equipe e com o canal WhatsApp plugável depois.

## Situação atual

Não existe canal de saída para o cliente. `apps/notifications/` é Web Push **interno**
(equipe), e-mail SMTP só está configurado em prod, e não há integração de WhatsApp.
`apps.crm` foi deletado em 2026-06-30 com a nota "não recriar sem discussão" — este
spec **é** essa discussão, e o escopo aqui é bem menor que o CRM original.

## Decisões de escopo (aprovadas)

| Decisão | Escolha |
|---|---|
| App | `apps/followups/` — nome e escopo próprios, não reviver `apps.crm` |
| Canal fase 1 | Fila de tarefas interna + push pro consultor. Zero integração externa, custo zero |
| Canal fase 2 | WhatsApp (WABA oficial ou Evolution — **não decidido**). Entra como um `elif` no dispatch |
| Abstração de canal | Nenhuma agora. Um `dispatch()` com `if`, não um adapter com uma implementação |
| LGPD | `followup_opt_out` obrigatório — comunicação de marketing sem opt-out não passa |
| MCP | Fora do spec. É ferramenta de dev; os endpoints REST já servem pra agente testar |

O motor de agendamento é ~90% do trabalho e é indiferente ao canal. Por isso a fase 1
entrega valor real sem esperar a decisão de WhatsApp.

## 1. Modelos

`apps/followups/models.py` — dois models, ambos `PaddockBaseModel` (TENANT_APP):

```python
class FollowUpTrigger(models.TextChoices):
    OS_DELIVERED = "delivered", _("OS entregue")

class FollowUpChannel(models.TextChoices):
    TASK     = "task",     _("Tarefa interna")
    WHATSAPP = "whatsapp", _("WhatsApp")   # fase 2

class FollowUpRule(PaddockBaseModel):
    name = models.CharField(max_length=120)
    trigger_event = models.CharField(max_length=20, choices=FollowUpTrigger.choices,
                                     default=FollowUpTrigger.OS_DELIVERED)
    delay_hours = models.PositiveIntegerField()          # 48h, 720h (30 dias)...
    channel = models.CharField(max_length=20, choices=FollowUpChannel.choices,
                               default=FollowUpChannel.TASK)
    message_template = models.TextField()                # placeholders {cliente} {placa} {os}
    link = models.URLField(blank=True, default="")       # ex.: review do Google
    os_types = models.JSONField(default=list, blank=True)  # vazio = todos
    is_active = models.BooleanField(default=True)

class FollowUpStatus(models.TextChoices):
    SCHEDULED = "scheduled", _("Agendado")
    PENDING   = "pending",   _("Na fila")
    DONE      = "done",      _("Concluído")
    SKIPPED   = "skipped",   _("Dispensado")

class FollowUpOutcome(models.TextChoices):
    SATISFIED    = "satisfied",     _("Cliente satisfeito")
    DISSATISFIED = "dissatisfied",  _("Cliente insatisfeito")
    NO_ANSWER    = "no_answer",     _("Não atendeu")
    SCHEDULED_OS = "scheduled_os",  _("Agendou serviço")
    NOT_INTERESTED = "not_interested", _("Sem interesse")

class FollowUp(PaddockBaseModel):
    rule = models.ForeignKey(FollowUpRule, on_delete=models.PROTECT, related_name="followups")
    service_order = models.ForeignKey("service_orders.ServiceOrder", on_delete=models.CASCADE,
                                      related_name="followups")
    due_at = models.DateTimeField(db_index=True)
    status = models.CharField(max_length=20, choices=FollowUpStatus.choices,
                              default=FollowUpStatus.SCHEDULED, db_index=True)
    channel = models.CharField(max_length=20, choices=FollowUpChannel.choices)
    assigned_to = models.ForeignKey("authentication.GlobalUser", null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="followups")
    dispatched_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    outcome = models.CharField(max_length=20, choices=FollowUpOutcome.choices,
                               blank=True, default="")
    notes = models.TextField(blank=True, default="")
```

Nenhum dado pessoal é copiado para `FollowUp` — nome e telefone vêm da OS/`Person` na
hora de exibir. Menos PII duplicada, menos superfície LGPD.

Constraint: `unique_together = ("rule", "service_order")` — uma OS não gera o mesmo
retorno duas vezes, mesmo se a transição for reexecutada.

## 2. Agendamento

`ServiceOrderService`, no ponto onde `delivered_at` é preenchido
(`services/order_service.py:465` e `services/delivery_service.py:95`), chama:

```python
from apps.followups.services import schedule_for_delivery
schedule_for_delivery(order_id=order.id, delivered_at=now)
```

Import de **service**, nunca de model — regra de isolamento do projeto. A função:

1. Verifica `followup_opt_out` do cliente. Optou por sair → não agenda nada.
2. Para cada `FollowUpRule` ativa cujo `os_types` case (ou seja vazio), cria um
   `FollowUp` com `due_at = delivered_at + timedelta(hours=delay_hours)`,
   `assigned_to = order.consultant`.
3. Nunca interrompe a transição da OS: envolvida em try/except com `logger.warning`.
   Uma regra mal cadastrada não pode impedir uma entrega.

Idempotente pela constraint — reentrega/correção de status não duplica.

## 3. Disparo

Celery beat de hora em hora, `CELERY_BEAT_SCHEDULE`:

```python
"followups-dispatch-due": {
    "task": "apps.followups.tasks.task_dispatch_due_followups_all_tenants",
    "schedule": crontab(minute=5),
},
```

A task itera os tenants (mesmo padrão de `task_refresh_overdue_payables_all_tenants`),
e dentro de cada `schema_context` pega `status=SCHEDULED, due_at__lte=now` e chama
`dispatch(followup)`.

`apps/followups/services.py`:

```python
def dispatch(followup: FollowUp) -> None:
    if followup.channel == FollowUpChannel.TASK:
        _dispatch_task(followup)
    else:
        logger.warning("Canal %s ainda não implementado", followup.channel)
        return
    followup.status = FollowUpStatus.PENDING
    followup.dispatched_at = timezone.now()
    followup.save(update_fields=["status", "dispatched_at", "updated_at"])
```

`_dispatch_task` põe o follow-up na fila (`status=PENDING`) e manda push interno pro
consultor via `notifications.services.send_push` — service, não model.

Fase 2 acrescenta `_dispatch_whatsapp` e um `elif`. Sem interface, sem registry, sem
factory: são duas implementações no máximo.

## 4. Fila de trabalho — `/crm/retornos`

Três grupos: **Vencidos**, **Hoje**, **Próximos 7 dias**. Cada cartão traz cliente,
telefone (link `tel:` e `wa.me`), placa, OS (link), a mensagem renderizada da regra e o
`link` (ex.: review do Google) com botão de copiar.

Ações: **Concluir** (escolhe `outcome` + notas), **Reagendar** (novo `due_at`),
**Dispensar** (`SKIPPED` + motivo).

O consultor pode filtrar "só os meus" ou ver todos (MANAGER+).

## 5. Cadastro de regras — `/crm/regras`

CRUD de `FollowUpRule` com preview da mensagem renderizada. Escrita `IsManagerOrAbove`,
leitura `IsConsultantOrAbove` — via `PermissionsByActionMixin`, sem `get_permissions`
escrito à mão.

Seed de duas regras inativas, exatamente as que o cliente pediu:

- "Pesquisa de satisfação + review Google" — 48h, canal `task`.
- "Oferta de revisão/lavagem" — 720h (30 dias), canal `task`.

Nascem `is_active=False`: ninguém dispara retorno sem alguém ligar a chave.

## 6. LGPD

Campo `followup_opt_out = BooleanField(default=False)` em `persons.Person`, exposto no
formulário de cadastro e no cartão do cliente. Checado no agendamento **e** no disparo
(o cliente pode pedir descadastro depois de a tarefa já existir; nesse caso ela vira
`SKIPPED` com nota automática).

Telefone continua `EncryptedCharField` no `Person` — nunca copiado para `FollowUp`,
nunca em log.

## 7. Endpoints

```
GET/POST/PATCH/DELETE /api/v1/followups/rules/
GET                   /api/v1/followups/?status=&assigned_to_me=&due_before=
POST                  /api/v1/followups/{id}/complete/    {outcome, notes}
POST                  /api/v1/followups/{id}/reschedule/  {due_at}
POST                  /api/v1/followups/{id}/skip/        {notes}
```

## 8. Testes

`apps/followups/tests/`:

- Entrega de OS cria um `FollowUp` por regra ativa, com `due_at` correto.
- Regra inativa e `os_types` que não casa não geram follow-up.
- Cliente com `followup_opt_out=True` não gera nada.
- Reexecutar a transição não duplica (constraint).
- Falha no agendamento não impede a transição da OS para `delivered`.
- Task de disparo pega só os vencidos e move `SCHEDULED → PENDING`.
- Canal não implementado não marca como disparado.
- `complete/` grava `outcome`, `completed_at` e trava reprocessamento.

## Fase 2 — WhatsApp (fora deste spec)

A decisão entre WABA oficial e Evolution API fica para um spec próprio. O que muda
aqui: uma função `_dispatch_whatsapp`, um `elif` no `dispatch`, e campos de credencial
em configuração. Modelos, agendamento, beat, fila e telas não mudam.

Considerações que aquele spec precisa resolver: templates aprovados pela Meta para
mensagem fora da janela de 24h (WABA), risco de ban do número (Evolution), e o que
fazer quando a entrega falha (a tarefa volta para a fila manual — o canal `task` é o
fallback natural).

## Fora de escopo

- Qualquer canal automático nesta fase.
- Gatilhos além de `OS_DELIVERED` (aniversário, revisão por KM, inatividade).
- Métricas de NPS / relatório de satisfação.
- Reviver `apps.crm`.
