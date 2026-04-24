# Spec — Módulo Fiscal Focus NF-e

**Data:** 2026-04-23
**Autor:** Thiago Campos (via Claude Code)
**Status:** Aprovado para implementação faseada (Ciclos 06A → 06F)
**Escopo:** ERP DS Car Centro Automotivo — Manaus/AM

---

## 1. Contexto e motivação

A regra fiscal já está enforced em código mas **a emissão real não existe**. Em [`ServiceOrderService._can_deliver()`](../../backend/core/apps/service_orders/services.py:158), uma OS particular não muda para `delivered` enquanto `Payment.fiscal_doc_ref` estiver vazio — porém hoje esse campo é apenas um `CharField` stub. Quem preenche? Ninguém. A trava existe mas é decorativa.

A DS Car precisa, em ordem de criticidade:

1. **NFS-e (Nota Fiscal de Serviço)** — toda OS particular fechada gera serviço de oficina/funilaria/pintura. A prefeitura de Manaus exige NFS-e.
2. **NF-e modelo 55** — venda de peças avulsas no balcão para clientes com CNPJ/CPF identificado, e NF-e de devolução (`finalidade_emissao=4`) quando peça retorna pro fornecedor.
3. **NFC-e modelo 65** — cupom fiscal síncrono para venda rápida de peças no balcão (consumidor final).
4. **Manifestação do destinatário** — registrar ciência/confirmação de NFs que fornecedores emitem contra o CNPJ da DS Car (controle de estoque + compliance fiscal).

A escolha do gateway é **Focus NF-e v2** (`https://api.focusnfe.com.br`), que abstrai SEFAZ + prefeituras municipais via REST com HTTP Basic Auth. Sem essa abstração, teríamos que lidar com SOAP, XML SEFAZ, certificado A1 manual e schemas ABRASF — inviável para o porte atual.

**Documento de referência adicional:** [MVP_CHECKLIST.md:147](../../backend/core/MVP_CHECKLIST.md) declara o débito; [CLAUDE.md:46-49](../../CLAUDE.md) define as regras de negócio. Este spec é a fonte única para resolver ambos.

---

## 2. Documentos suportados — matriz de decisão

| Documento | Modelo | Quando emitir | Síncrono? | Quem assina | Cancelamento |
|---|---|---|---|---|---|
| **NFS-e** | — (municipal) | OS particular fechada (serviço) | Não (polling) | Prefeitura de Manaus | Geralmente até 30d (varia por município) |
| **NF-e** | 55 | Venda de peça avulsa B2B/B2C identificado, devolução, complementar | Não (polling) | SEFAZ-AM | 24h após autorização |
| **NFC-e** | 65 | Venda balcão consumidor final (peça/produto) | **Sim** | SEFAZ-AM | 30 min após autorização (estado-dependente) |
| **Manifestação** | — | Receber NF de fornecedor de peças | Sim | Ambiente Nacional | N/A (registro de evento) |

**Regra DS Car:**
- `customer_type=PARTICULAR` + OS fechada → **NFS-e** obrigatória.
- `customer_type=SEGURADORA` → faturamento segue fluxo da seguradora (sem NFS-e da DS Car nesse momento). Spec não cobre faturamento contra seguradora.
- Venda de peça avulsa identificada (CNPJ/CPF) → **NF-e mod 55**.
- Venda de peça avulsa anônima/balcão → **NFC-e mod 65**.
- Receber peças de fornecedor → **Manifestação** (ciência ao receber XML).

---

## 3. Pré-requisitos bloqueantes

### 3.1 Evolução `Person` (Ciclo 06A)
Hoje [`Person`](../../backend/core/apps/persons/models.py:4) tem apenas `full_name`, `phone`, `email`, `person_type`. **Sem CPF/CNPJ/IE/endereço, nenhuma NF é emitível.**

Spec exige:
- `Document` (FK Person, type=CPF|CNPJ|IE|IM, value EncryptedField, is_primary)
- `Address` (FK Person, logradouro, numero, complemento, bairro, municipio_ibge, uf, cep, is_primary)
- `Contact` (FK Person, type=EMAIL|PHONE|WHATSAPP, value EncryptedField)
- `Category` (FK Person, code — ex: CLIENT_FINAL, CLIENT_FROTA, FORNECEDOR_PECAS)

Todos com `EncryptedField` (django-cryptography ou `cryptography.fernet` + custom field).

### 3.2 Settings (Ciclo 06B)
Adicionar em [config/settings.py](../../backend/core/config/settings.py):
```python
FOCUS_NFE_TOKEN = env("FOCUS_NFE_TOKEN")  # token por filial CNPJ
FOCUS_NFE_AMBIENTE = env("FOCUS_NFE_AMBIENTE", default="homologacao")  # homologacao|producao
FOCUS_NFE_BASE_URL = (
    "https://homologacao.focusnfe.com.br"
    if FOCUS_NFE_AMBIENTE == "homologacao"
    else "https://api.focusnfe.com.br"
)
FOCUS_NFE_TIMEOUT_SECONDS = env.int("FOCUS_NFE_TIMEOUT_SECONDS", default=60)
FOCUS_NFE_WEBHOOK_SECRET = env("FOCUS_NFE_WEBHOOK_SECRET")  # validação HMAC do webhook
CNPJ_EMISSOR = env("CNPJ_EMISSOR")  # CNPJ default da filial
```

`.env.example` deve listar todas. Em dev/staging, **sempre `homologacao`** (CLAUDE.md:49). Em produção, validação no startup falha se `FOCUS_NFE_AMBIENTE=producao` mas `DEBUG=True`.

### 3.3 Multi-CNPJ (futuro, não-bloqueante)
A DS Car planeja múltiplas filiais. O modelo `FiscalConfig` (§5) já prevê `cnpj` + `token` por filial. No Ciclo 06B basta uma única instância (CNPJ da matriz). Multi-tenant fica para quando `django-tenants` entrar.

---

## 4. Arquitetura

Nova app Django: `backend/core/apps/fiscal/`. Espelha o padrão de [`apps/imports`](../../backend/core/apps/imports/) (httpx + dataclass response + auditoria por evento).

```
apps/fiscal/
├── __init__.py
├── apps.py
├── models.py              # FiscalDocument, FiscalDocumentItem, FiscalEvent, FiscalConfig
├── admin.py
├── serializers.py         # DRF serializers + Zod-mirroring
├── views.py               # FiscalDocumentViewSet + FocusWebhookView
├── urls.py
├── services/
│   ├── __init__.py
│   ├── fiscal_service.py      # FiscalService.emit/cancel/consult/cce/devolucao
│   ├── manaus_nfse.py         # Builder específico do payload NFS-e Manaus
│   ├── nfe_builder.py         # Builder NF-e mod 55
│   ├── nfce_builder.py        # Builder NFC-e mod 65
│   └── manifestacao_service.py
├── clients/
│   ├── __init__.py
│   └── focus_nfe_client.py    # httpx.Client espelhando CiliaClient
├── tasks.py               # Celery: emit_async, poll_pending, sync_inbox
├── migrations/
│   └── 0001_initial.py
└── tests/
    ├── fixtures/          # Respostas reais (sanitizadas) da Focus
    ├── test_client.py
    ├── test_service.py
    ├── test_builders.py
    ├── test_webhook.py
    └── smoke_homologacao.py
```

**Princípios:**
- `FocusNFeClient` **nunca** levanta exception em 4xx/5xx — retorna `FocusResponse` com `status_code` e `data`. Quem decide é o `FiscalService`. (Espelha [`CiliaClient._request`](../../backend/core/apps/imports/sources/cilia_client.py:73).)
- Toda chamada gera `FiscalEvent` (auditoria por requisição), análoga ao `ImportAttempt`.
- Operações que mudam estado (emit, cancel, devolucao) são wrapped em `transaction.atomic()` + `select_for_update()` no `FiscalDocument` correspondente.
- Polling de status é via Celery beat (intervalo curto p/ documentos `processando_autorizacao`); webhook é o caminho preferido (push), polling é fallback.

---

## 5. Modelo de dados

### 5.1 `FiscalConfig`
Configuração de emissor (multi-CNPJ futuro). Singleton no Ciclo 06B.

```python
class FiscalConfig(models.Model):
    cnpj = models.CharField(max_length=14, unique=True)  # plain (CNPJ não é PII restrita)
    inscricao_estadual = models.CharField(max_length=20)
    inscricao_municipal = models.CharField(max_length=20)
    razao_social = models.CharField(max_length=200)
    nome_fantasia = models.CharField(max_length=200)
    regime_tributario = models.PositiveSmallIntegerField(choices=[
        (1, "Simples Nacional"),
        (2, "Simples Nacional - excesso sublimite"),
        (3, "Regime Normal (Lucro Real/Presumido)"),
    ])
    endereco = models.JSONField()  # {logradouro, numero, bairro, municipio_ibge, uf, cep}
    focus_token = EncryptedField()  # token específico desta empresa na Focus
    # Sequenciadores por tipo de documento (idempotência da ref Focus)
    seq_nfse = models.PositiveIntegerField(default=1)   # serve também como numero_rps da NFS-e
    seq_nfe = models.PositiveIntegerField(default=1)
    seq_nfce = models.PositiveIntegerField(default=1)
    serie_rps = models.CharField(max_length=5, default="1")
    is_active = models.BooleanField(default=True)
```

### 5.2 `FiscalDocument`
Núcleo do módulo. Uma instância por documento fiscal (autorizado, denegado ou em processamento).

```python
class FiscalDocument(models.Model):
    DOC_TYPE = [
        ("NFSE", "NFS-e"),
        ("NFE_55", "NF-e modelo 55"),
        ("NFCE_65", "NFC-e modelo 65"),
        ("NFE_DEV", "NF-e devolução"),
    ]
    STATUS = [
        ("DRAFT", "Rascunho local"),  # antes de submeter
        ("PROCESSING", "processando_autorizacao"),
        ("AUTHORIZED", "autorizado"),
        ("DENIED", "denegado"),
        ("ERROR", "erro_autorizacao"),
        ("CANCELLED", "cancelado"),
        ("CANCELLATION_PENDING", "cancelamento_pendente"),
    ]

    config = models.ForeignKey(FiscalConfig, on_delete=models.PROTECT)
    doc_type = models.CharField(max_length=10, choices=DOC_TYPE)
    ref = models.CharField(max_length=50, unique=True, db_index=True)  # nossa ref (idempotência Focus)
    status = models.CharField(max_length=25, choices=STATUS, default="DRAFT")

    # Vínculos com domínio DS Car
    service_order = models.ForeignKey(
        "service_orders.ServiceOrder",
        null=True, blank=True, on_delete=models.PROTECT,
        related_name="fiscal_documents",
    )
    payment = models.ForeignKey(
        "payments.Payment",
        null=True, blank=True, on_delete=models.PROTECT,
        related_name="fiscal_documents",
    )
    destinatario = models.ForeignKey(
        "persons.Person",
        on_delete=models.PROTECT,
        related_name="fiscal_received",
    )

    # Dados retornados pela SEFAZ/Prefeitura
    chave = models.CharField(max_length=44, blank=True, db_index=True)  # chave NFe (44 dígitos) ou número NFS-e
    numero = models.CharField(max_length=20, blank=True)
    serie = models.CharField(max_length=5, blank=True)
    protocolo = models.CharField(max_length=50, blank=True)
    data_autorizacao = models.DateTimeField(null=True, blank=True)
    data_cancelamento = models.DateTimeField(null=True, blank=True)
    justificativa_cancelamento = models.CharField(max_length=255, blank=True)

    # Paths Focus (download de XML/DANFE)
    caminho_xml = models.CharField(max_length=500, blank=True)
    caminho_pdf = models.CharField(max_length=500, blank=True)  # DANFE/DANFCE/DANFSE
    caminho_xml_cancelamento = models.CharField(max_length=500, blank=True)

    # Snapshot do payload enviado e da última resposta (debugging)
    payload_enviado = models.JSONField()
    ultima_resposta = models.JSONField(default=dict)
    mensagem_sefaz = models.TextField(blank=True)
    natureza_rejeicao = models.CharField(max_length=255, blank=True)

    # Totais (para query/relatório sem desserializar JSON)
    valor_total = models.DecimalField(max_digits=14, decimal_places=2)
    valor_impostos = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    # Devolução / referenciamento
    documento_referenciado = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="devolucoes_complementares",
        help_text="NF original referenciada em devolução/complementar",
    )

    # Auditoria
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
    )
    legacy_databox_id = models.IntegerField(null=True, blank=True, db_index=True)

    # Emissão manual (ad-hoc, fora de OS) — ver §8.5
    manual_reason = models.CharField(
        max_length=255, blank=True,
        help_text="Justificativa obrigatória quando emitido manualmente (auditoria).",
    )

    class Meta:
        indexes = [
            models.Index(fields=["status", "doc_type"]),
            models.Index(fields=["service_order", "doc_type"]),
        ]
        constraints = [
            # Emissão manual exige justificativa; emissão ligada a OS não exige.
            models.CheckConstraint(
                name="fiscal_doc_manual_needs_reason",
                check=(
                    models.Q(service_order__isnull=False)
                    | ~models.Q(manual_reason="")
                ),
            ),
        ]
```

### 5.3 `FiscalDocumentItem`
Itens fiscalizados. Para NFS-e geralmente 1 item agregando o serviço todo (ou 1 por bloco se a prefeitura permitir desdobrar). Para NF-e/NFC-e, um por peça.

```python
class FiscalDocumentItem(models.Model):
    document = models.ForeignKey(FiscalDocument, on_delete=models.CASCADE, related_name="items")
    numero_item = models.PositiveSmallIntegerField()
    descricao = models.CharField(max_length=500)

    # Identificação fiscal
    codigo_servico_lc116 = models.CharField(max_length=10, blank=True)  # NFS-e
    ncm = models.CharField(max_length=10, blank=True)                   # NF-e/NFC-e
    cfop = models.CharField(max_length=4, blank=True)                   # NF-e/NFC-e
    unidade = models.CharField(max_length=10, default="UN")

    quantidade = models.DecimalField(max_digits=14, decimal_places=4)
    valor_unitario = models.DecimalField(max_digits=14, decimal_places=4)
    valor_bruto = models.DecimalField(max_digits=14, decimal_places=2)
    valor_desconto = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valor_liquido = models.DecimalField(max_digits=14, decimal_places=2)

    # Impostos (calculados ou auto-calculados pela Focus)
    aliquota_iss = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    valor_iss = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    iss_retido = models.BooleanField(default=False)

    icms_cst = models.CharField(max_length=4, blank=True)
    icms_aliquota = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    icms_valor = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    pis_cst = models.CharField(max_length=2, blank=True)
    pis_valor = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    cofins_cst = models.CharField(max_length=2, blank=True)
    cofins_valor = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    # Vínculo com origem no orçamento (rastreabilidade)
    source_budget_item = models.ForeignKey(
        "budgets.BudgetVersionItem",
        null=True, blank=True, on_delete=models.SET_NULL,
    )
    source_os_item = models.ForeignKey(
        "service_orders.ServiceOrderVersionItem",
        null=True, blank=True, on_delete=models.SET_NULL,
    )
```

### 5.4 `FiscalEvent`
Toda chamada HTTP à Focus + todo webhook recebido + toda mudança de estado vira um evento. Análogo a `ImportAttempt`.

```python
class FiscalEvent(models.Model):
    EVENT_TYPE = [
        ("EMIT_REQUEST", "Requisição de emissão"),
        ("EMIT_RESPONSE", "Resposta de emissão"),
        ("CONSULT", "Consulta de status"),
        ("CANCEL_REQUEST", "Requisição de cancelamento"),
        ("CCE", "Carta de correção"),
        ("WEBHOOK", "Webhook recebido"),
        ("STATUS_CHANGE", "Mudança de status local"),
        ("ERROR", "Erro não-tratado"),
    ]
    document = models.ForeignKey(
        FiscalDocument, null=True, blank=True,
        on_delete=models.CASCADE, related_name="events",
    )
    event_type = models.CharField(max_length=20, choices=EVENT_TYPE)
    http_status = models.PositiveSmallIntegerField(null=True, blank=True)
    payload = models.JSONField(default=dict)        # request body
    response = models.JSONField(default=dict)       # response body
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    error_type = models.CharField(max_length=80, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    triggered_by = models.CharField(
        max_length=20,
        choices=[("USER", "Usuário"), ("CELERY", "Celery"), ("WEBHOOK", "Webhook")],
    )

    class Meta:
        indexes = [models.Index(fields=["document", "-created_at"])]
```

### 5.5 Mudanças em models existentes
- `payments.Payment.fiscal_doc_ref` (`CharField` stub) → substituir por `fiscal_document = ForeignKey(FiscalDocument, null=True, on_delete=PROTECT)`. Migration de dados se já houver registros.
- `service_orders.ServiceOrderEvent` — usar evento `FISCAL_ISSUED` já existente para timeline.
- `service_orders.services.ServiceOrderService._can_deliver()` — em vez de checar `Payment.fiscal_doc_ref__gt=""`, checar `Payment.fiscal_document__status="AUTHORIZED"`.

---

## 6. Endpoints Focus NF-e — referência completa

### 6.1 Autenticação
**Sempre HTTP Basic Auth:** username = token, password = vazia.
```python
httpx.Client(auth=(token, ""))
```
Não usar query string `?token=` (vaza em logs).

### 6.2 Códigos HTTP

| HTTP | Significado | Tratamento |
|---|---|---|
| 200 | Consulta OK | Processar `data` |
| 201 | Documento aceito (em fila ou autorizado se NFC-e) | Persistir `ref`, status inicial |
| 400 | Requisição inválida (campo faltando) | Não retry; mostrar erro ao usuário |
| 403 | Token inválido / empresa não habilitada | Alerta crítico ao operador |
| 404 | Ref não existe | Remover do polling local |
| 415 | Content-Type errado | Bug no client; corrigir |
| 422 | Erro de lógica (ex: cancelar nota não autorizada) | Não retry; corrigir e reenviar |
| 429 | Rate limit | Retry com backoff exponencial |
| 5xx | Erro Focus/SEFAZ | Retry com backoff (até 5 tentativas) |

### 6.3 NF-e modelo 55

| Operação | Método | URL | Body | Status OK |
|---|---|---|---|---|
| Emitir | POST | `/v2/nfe?ref={ref}` | JSON completo (§7.1) | 201 |
| Consultar | GET | `/v2/nfe/{ref}` | — | 200 |
| Consultar completa | GET | `/v2/nfe/{ref}?completa=1` | — | 200 |
| Cancelar | DELETE | `/v2/nfe/{ref}` | `{"justificativa": "15-255 chars"}` | 200 |
| CCe (correção) | POST | `/v2/nfe/{ref}/carta_correcao` | `{"sequencia_evento": 1, "texto_correcao": "..."}` | 201 |
| Inutilizar range | POST | `/v2/nfe/inutilizacao` | `{"serie":1,"numero_inicial":N,"numero_final":M,"justificativa":"..."}` | 201 |
| Devolução | POST | `/v2/nfe?ref={ref}` | JSON com `finalidade_emissao=4` + `notas_referenciadas` (§7.2) | 201 |
| Enviar email | POST | `/v2/nfe/{ref}/email` | `{"emails": ["..."]}` | 200 |
| Download XML | GET | `{caminho_xml_nota_fiscal}` (path retornado na consulta) | — | 200 |
| Download DANFE PDF | GET | `{caminho_danfe}` | — | 200 |

**Status do ciclo de vida (campo `status` no GET):**
| Status | Sentido | Ação |
|---|---|---|
| `processando_autorizacao` | Aguardando SEFAZ | Polling em 10s |
| `autorizado` | OK | Salvar chave, baixar XML/DANFE |
| `denegado` | SEFAZ negou (cadastro permanente) | Não reenviar; corrigir cadastro |
| `erro_autorizacao` | SEFAZ rejeitou (corrigível) | Analisar `mensagem_sefaz`; reenviar |
| `erro_validacao_schema` | Validação local Focus falhou | Corrigir payload |
| `cancelado` | Cancelada com sucesso | Estado final |

**Prazo legal de cancelamento:** 24h após autorização (Lei 14.063/2020, art. 7º). Após isso, devolução é a saída.

### 6.4 NFS-e (municipal)

| Operação | Método | URL | Status OK |
|---|---|---|---|
| Emitir | POST | `/v2/nfse?ref={ref}` | 201 |
| Consultar | GET | `/v2/nfse/{ref}` | 200 |
| Cancelar | DELETE | `/v2/nfse/{ref}` (body com `justificativa`) | 200 |
| Email | POST | `/v2/nfse/{ref}/email` | 200 |

**Variante NFS-e Nacional** (`/v2/nfse-nacional/{ref}`) está disponível mas **a aderência de Manaus precisa ser confirmada com suporte Focus** antes do Ciclo 06C (ver §12).

**Status:** mesmo conjunto da NF-e (`processando_autorizacao`, `autorizado`, `cancelado`, `erro_autorizacao`, `erro_cancelamento`).

**RPS:** identificador local (`numero_rps` + `serie_rps` + `tipo_rps=1`) que precede o número definitivo da NFS-e atribuído pela prefeitura. Sequência controlada localmente em `FiscalConfig.proximo_numero_rps`. **Rejeição de RPS** = prefeitura recusou o RPS por dado inválido (CNPJ tomador errado, código de serviço inválido, IM emissor irregular). Tratamento: ler `mensagem_sefaz`, corrigir, reenviar com **mesma `ref`** (idempotente).

**Prazo de cancelamento:** varia por município (geralmente 30 dias em Manaus, mas confirmar).

### 6.5 NFC-e modelo 65 (síncrono)

| Operação | Método | URL | Status OK |
|---|---|---|---|
| Emitir | POST | `/v2/nfce?ref={ref}` | 201 com `status` final na própria resposta |
| Consultar | GET | `/v2/nfce/{ref}` | 200 |
| Cancelar | DELETE | `/v2/nfce/{ref}` (body com `justificativa`) | 200 |

**Diferenças de NF-e:**
- `indicador_consumidor_final = 1` sempre.
- `formas_pagamento` array obrigatório (§7.3).
- Endereço tomador opcional (consumidor anônimo permitido — só CPF na nota se cliente quiser).
- Resposta da emissão **já traz** `status="autorizado"` ou `status="erro_autorizacao"` — sem `processando_autorizacao`.
- Prazo de cancelamento: **30 minutos** (estado-dependente; AM = 30min).

### 6.6 Manifestação do destinatário

> ⚠️ **Documentação Focus está incompleta neste tópico** (confirmado em fetch realizado em 2026-04-23). Endpoints abaixo são o que está acessível; payload exato deve ser validado em homologação antes do Ciclo 06F.

| Operação | Método | URL |
|---|---|---|
| Listar NFs recebidas | GET | `/v2/nfes_recebidas?cnpj={cnpj}` (paginação por `pagina`) |
| Detalhe de NF recebida | GET | `/v2/nfes_recebidas/{chave}` |
| Manifestar | POST | `/v2/nfes_recebidas/{chave}/manifesto` |
| Download XML recebido | GET | `{caminho_xml}` (do detalhe) |

**4 tipos de manifestação** (`tipo_evento`):
| Tipo | Quando usar | Prazo legal |
|---|---|---|
| `ciencia` | Recebi a chave, ainda não validei | 10 dias |
| `confirmacao` | Operação confirmada (recebi a peça) | 180 dias |
| `desconhecimento` | Não reconheço esta operação | 10 dias |
| `operacao_nao_realizada` | Conhecida mas não se efetivou | 180 dias |

Payload (estimado): `{"tipo_evento": "confirmacao", "justificativa": "..."}`. **Validar em homologação.**

---

## 7. Payloads JSON

### 7.1 NF-e modelo 55 — esqueleto comentado

```json
{
  "natureza_operacao": "Venda de mercadoria",
  "data_emissao": "2026-04-23T10:00:00",
  "tipo_documento": 1,
  "finalidade_emissao": 1,
  "presenca_comprador": 1,
  "consumidor_final": 1,

  "cnpj_emitente": "12345678000195",
  "inscricao_estadual_emitente": "0497114660",
  "nome_emitente": "DS Car Centro Automotivo Ltda",
  "logradouro_emitente": "Av Exemplo",
  "numero_emitente": "100",
  "bairro_emitente": "Centro",
  "municipio_emitente": "Manaus",
  "uf_emitente": "AM",
  "cep_emitente": "69000000",
  "regime_tributario_emitente": 1,

  "nome_destinatario": "Cliente Exemplo Ltda",
  "cnpj_destinatario": "98765432000110",
  "indicador_inscricao_estadual_destinatario": 9,
  "logradouro_destinatario": "Rua X",
  "numero_destinatario": "50",
  "bairro_destinatario": "Bairro Y",
  "municipio_destinatario": "Manaus",
  "uf_destinatario": "AM",
  "cep_destinatario": "69050000",
  "email_destinatario": "cliente@example.com",

  "items": [
    {
      "numero_item": 1,
      "codigo_produto": "PECA-001",
      "descricao": "Filtro de óleo",
      "ncm": "84212300",
      "cfop": "5102",
      "unidade_comercial": "UN",
      "quantidade_comercial": 1,
      "valor_unitario_comercial": 80.00,
      "valor_bruto": 80.00,
      "unidade_tributavel": "UN",
      "quantidade_tributavel": 1,
      "valor_unitario_tributavel": 80.00,
      "origem": "0",
      "icms_situacao_tributaria": "102",
      "pis_situacao_tributaria": "07",
      "cofins_situacao_tributaria": "07"
    }
  ],

  "valor_produtos": 80.00,
  "valor_total": 80.00,
  "modalidade_frete": 9,

  "informacoes_adicionais_contribuinte": "Pedido OS-12345 DS Car"
}
```

**Auto-calculados pela Focus** se omitidos: `valor_icms`, `valor_pis`, `valor_cofins`, `valor_total` (a partir dos itens), DV da chave, número e série (se config tiver sequência), data_saida.

### 7.2 NF-e devolução (`finalidade_emissao=4`)
Adições obrigatórias ao payload:
```json
{
  "finalidade_emissao": 4,
  "natureza_operacao": "Devolução de mercadoria",
  "notas_referenciadas": [
    { "chave_nfe": "44 dígitos da NF original" }
  ],
  "items": [
    {
      "...": "...",
      "cfop": "5202"
    }
  ]
}
```
CFOPs típicos de devolução para AM: `5202` (intra-estadual venda), `5411` (substituição tributária), `1202` (entrada de devolução). Confirmar com contador.

### 7.3 NFC-e — diferenças do payload
```json
{
  "consumidor_final": 1,
  "indicador_presenca": 1,
  "nfce_identificador_csc": "ID_CSC_FORNECIDO_PELA_SEFAZ_AM",
  "nfce_csc": "TOKEN_CSC",
  "formas_pagamento": [
    {
      "forma_pagamento": "01",
      "valor_pagamento": 80.00
    }
  ],
  "cpf_destinatario": "12345678900"
}
```
Códigos `forma_pagamento`: `01`=dinheiro, `02`=cheque, `03`=cartão crédito, `04`=cartão débito, `05`=crédito loja, `10`=vale alimentação, `99`=outros.

### 7.4 NFS-e — esqueleto Manaus
```json
{
  "natureza_operacao": "1",
  "data_emissao": "2026-04-23T14:30:00",
  "prestador": {
    "cnpj": "12345678000195",
    "inscricao_municipal": "1234567"
  },
  "tomador": {
    "cnpj": "98765432000110",
    "razao_social": "Cliente Exemplo Ltda",
    "email": "cliente@example.com",
    "endereco": {
      "logradouro": "Rua X",
      "numero": "50",
      "bairro": "Bairro Y",
      "codigo_municipio": "1302603",
      "uf": "AM",
      "cep": "69050000"
    }
  },
  "servico": {
    "aliquota": 5.0,
    "discriminacao": "Serviços de mecânica e funilaria conforme OS DS-12345",
    "iss_retido": false,
    "item_lista_servico": "14.01",
    "codigo_tributario_municipio": "1401",
    "valor_servicos": 1500.00,
    "valor_iss": 75.00,
    "valor_liquido": 1500.00,
    "codigo_municipio": "1302603"
  },
  "rps": {
    "numero": 42,
    "serie": "1",
    "tipo": 1
  }
}
```

`codigo_municipio` IBGE de Manaus = `1302603`. **Item da lista de serviços (LC 116/2003)** mais comum para oficinas: `14.01` (lubrificação, limpeza, lustração, revisão, conserto, restauração de máquinas, veículos, motores). Alíquota ISS Manaus para `14.01` deve ser confirmada na tabela vigente da SEMEF (geralmente 5%).

---

## 8. Fluxos por documento

### 8.1 NFS-e — fluxo principal
```
[OS particular fechada] → ServiceOrderService.transition_to_delivered()
  ↓ (não permite, _can_deliver retorna False)
[Frontend abre modal "Emitir NFS-e"]
  ↓ POST /api/v1/fiscal/nfse/emit/ (body: {service_order_id, payment_id})
[FiscalService.emit_nfse(os, payment)]
  ↓ build payload (ManausNfseBuilder a partir de OS + Person + Address + ItemOperations)
  ↓ FocusNFeClient.post("/v2/nfse?ref=DSCAR-NFSE-20260423-042", payload)
  ↓ persist FiscalDocument(status=PROCESSING)
  ↓ FiscalEvent(EMIT_REQUEST/EMIT_RESPONSE)
  ↓ schedule poll_fiscal_document.apply_async(eta=now+10s)
[Celery task poll_fiscal_document]
  ↓ GET /v2/nfse/{ref}
  ↓ se "autorizado" → atualiza FiscalDocument, baixa XML+PDF, dispara webhook interno
  ↓ se "processando_autorizacao" → reschedule (+10s, max 60 tentativas)
  ↓ se "erro_autorizacao" → status=ERROR, notifica usuário
[Webhook Focus (paralelo, push)]
  ↓ POST /api/v1/fiscal/webhook/focus/ {evento: nfse_autorizado, ref: ..., chave: ...}
  ↓ FocusWebhookView valida HMAC, atualiza FiscalDocument se ainda PROCESSING
[ServiceOrderService.transition_to_delivered() chamado de novo]
  ↓ _can_deliver retorna True (Payment.fiscal_document.status == AUTHORIZED)
  ↓ status=delivered, ServiceOrderEvent(FISCAL_ISSUED, FK fiscal_document)
```

### 8.2 NF-e — devolução
```
[Operador identifica devolução de peça vendida com NF-e mod 55]
  ↓ Frontend: ação "Emitir devolução" sobre FiscalDocument.id
  ↓ POST /api/v1/fiscal/nfe/devolucao/ {documento_referenciado_id, items_devolvidos}
[FiscalService.emit_devolucao(doc_original, items)]
  ↓ build payload (NfeBuilder com finalidade=4, notas_referenciadas=[doc_original.chave])
  ↓ valida prazo (informativo, não bloqueia — devolução não tem prazo único)
  ↓ POST /v2/nfe?ref=DSCAR-DEV-20260423-005
  ↓ persist FiscalDocument(doc_type=NFE_DEV, documento_referenciado=doc_original)
  ↓ resto idêntico ao fluxo de emissão (polling, webhook)
```

### 8.3 NFC-e — síncrono
```
[Venda balcão registrada no PDV]
  ↓ POST /api/v1/fiscal/nfce/emit/
[FiscalService.emit_nfce()]
  ↓ POST /v2/nfce?ref=...
  ↓ resposta JÁ traz status final
  ↓ se autorizado: persist com status=AUTHORIZED imediatamente
  ↓ retorna QR-Code link + chave para impressão
  ↓ se erro: NÃO criar FiscalDocument; retornar erro ao usuário
```

### 8.4 Manifestação destinatário
```
[Celery beat sync_focus_inbox a cada 1h]
  ↓ GET /v2/nfes_recebidas?cnpj=DSCAR_CNPJ&pagina=1..N
  ↓ para cada NF nova: criar FiscalReceivedDocument (modelo separado, fora do escopo deste spec V1)
  ↓ se a NF é de fornecedor cadastrado (Person com Category=FORNECEDOR_PECAS):
  ↓   POST /v2/nfes_recebidas/{chave}/manifesto {tipo_evento: "ciencia"}
  ↓   FiscalEvent(WEBHOOK ou MANIFEST)
[Operador estoque revisa NFs com ciência, registra recebimento físico]
  ↓ POST /v2/nfes_recebidas/{chave}/manifesto {tipo_evento: "confirmacao"}
```
Nota: o modelo `FiscalReceivedDocument` será detalhado em sub-spec do Ciclo 06F. Reutiliza `FiscalEvent` para auditoria.

### 8.5 Emissão manual (ad-hoc) — NFS-e e NF-e

**Casos de uso:**
- Serviço prestado fora de OS (ex: consultoria avulsa, diagnóstico sem abrir ordem, cortesia).
- Venda de peça pontual sem passar pelo cadastro de peças/estoque.
- Correção: reemissão de NF anulada por prazo expirado de cancelamento.
- Notas que o contador pede retroativamente (dentro do mês/competência).

**Princípio:** o operador preenche um formulário livre (cliente + itens + observação) e emite. Não há `ServiceOrder` nem `Payment` vinculados — `FiscalDocument.service_order` e `FiscalDocument.payment` permanecem `null` (o modelo já é nullable, §5.2).

**Permissão:** apenas usuário com role `fiscal_admin` ou `OWNER`. Operador comum do PDV/oficina **não** emite manual (evita lastro paralelo não auditável). Registra em `FiscalEvent.triggered_by="USER_MANUAL"`.

**Fluxo:**
```
[Operador autorizado abre tela "Emitir NF manual"]
  ↓ escolhe tipo (NFS-e ou NF-e mod 55)
  ↓ seleciona Person (ou cadastra rápido — reutiliza PersonForm §3.1)
  ↓ preenche itens (descrição, quantidade, valor unitário, código LC116 ou NCM/CFOP)
  ↓ opcional: alíquota ISS, observação, data de emissão retroativa (validada)
  ↓ confirma
  ↓ POST /api/v1/fiscal/{nfse|nfe}/emit-manual/ (payload ManualEmissionSchema)
[FiscalService.emit_manual_nfse(payload) ou emit_manual_nfe(payload)]
  ↓ valida Person tem Document + Address primários (LGPD)
  ↓ ManualNfseBuilder / ManualNfeBuilder constrói payload Focus a partir do form direto
  ↓ resto idêntico ao fluxo automatizado (ref, POST Focus, polling, webhook)
  ↓ FiscalDocument criado com service_order=None, payment=None, created_by=user
  ↓ FiscalEvent(EMIT_REQUEST, triggered_by="USER_MANUAL")
```

**Schema do form (backend Pydantic/DRF + Zod espelhado no frontend):**
```python
class ManualNfseInput(BaseModel):
    destinatario_id: int                              # FK Person obrigatório
    itens: list[ManualItemInput]                      # >= 1 item
    discriminacao: str                                # texto livre da NFS-e, max 2000 chars
    codigo_servico_lc116: str = "14.01"               # default oficina
    aliquota_iss: Decimal | None = None               # None = usa alíquota config
    iss_retido: bool = False
    data_emissao: datetime | None = None              # None = now(); se informado, valida ≤30d passado
    observacoes_contribuinte: str = ""
    observacoes_fisco: str = ""

class ManualItemInput(BaseModel):
    descricao: str                                    # 3-500 chars
    quantidade: Decimal = Decimal("1")
    valor_unitario: Decimal                           # > 0
    valor_desconto: Decimal = Decimal("0")


class ManualNfeInput(BaseModel):
    destinatario_id: int
    natureza_operacao: str                            # "Venda", "Prestação de serviço", etc
    finalidade_emissao: Literal[1, 2, 3, 4] = 1      # 1=normal, 2=complementar, 3=ajuste, 4=devolução
    nota_referenciada_id: int | None = None           # obrigatório se finalidade=4
    itens: list[ManualNfeItemInput]                   # >= 1
    informacoes_adicionais: str = ""

class ManualNfeItemInput(BaseModel):
    descricao: str
    ncm: str                                          # 8 dígitos
    cfop: str                                         # 4 dígitos
    unidade: str = "UN"
    quantidade: Decimal
    valor_unitario: Decimal
    icms_cst: str = "102"                             # default Simples Nacional
    origem: str = "0"                                 # nacional
```

**Diferença em relação à emissão automatizada (a partir de OS):**
| Aspecto | Automatizada (OS) | Manual (ad-hoc) |
|---|---|---|
| Origem dos itens | `ServiceOrderVersionItem` / `BudgetVersionItem` | Form livre |
| Totais | Copiados de `Version.net_total` | Calculados do form |
| `FiscalDocumentItem.source_*` FK | Preenchido | `NULL` |
| Trava `_can_deliver` | Dispara | N/A |
| Timeline `ServiceOrderEvent(FISCAL_ISSUED)` | Criado | Não criado |
| Quem pode | Consultor/operador | Apenas `fiscal_admin` / `OWNER` |
| Auditoria especial | — | `FiscalEvent.triggered_by="USER_MANUAL"` + campo `FiscalDocument.manual_reason` obrigatório |

**Campo extra em `FiscalDocument`** para emissão manual (§5.2 adendo):
```python
# Adicionar ao model FiscalDocument
manual_reason = models.CharField(
    max_length=255, blank=True,
    help_text="Justificativa obrigatória quando emitido manualmente (auditoria)",
)
```
`CHECK constraint`: se `service_order IS NULL` então `manual_reason` não pode ser vazio.

**Endpoints:**
| Operação | Método | URL |
|---|---|---|
| Emitir NFS-e manual | POST | `/api/v1/fiscal/nfse/emit-manual/` |
| Emitir NF-e manual | POST | `/api/v1/fiscal/nfe/emit-manual/` |
| Emitir NF-e devolução (referencia NF original) | POST | `/api/v1/fiscal/nfe/{id}/devolucao/` (já previsto §8.2) |

NFC-e manual **não existe** — NFC-e é sempre resultado de venda de balcão (PDV) com formas de pagamento capturadas. Se precisar de emissão avulsa de cupom, usar NF-e mod 55 ou NFS-e.

---

## 9. Mapeamentos DS Car → fiscal

### 9.1 LaborCategory → código LC 116/2003
| LaborCategory.code | LC 116 item | Descrição |
|---|---|---|
| MECANICA | 14.01 | Conserto de máquinas, veículos, motores |
| FUNILARIA | 14.01 | (mesmo item; agregar na NFS-e) |
| PINTURA | 14.01 | (mesmo item) |
| ELETRICA | 14.01 | (mesmo item) |
| TAPECARIA | 14.01 | (mesmo item) |
| ACABAMENTO | 14.01 | (mesmo item) |
| VIDRACARIA | 14.05 | Restauração, recondicionamento de vidros |

A maior parte dos serviços de oficina cabe em `14.01`. NFS-e geralmente leva **um item agregado** somando todos os blocos, salvo se a SEMEF Manaus exigir desdobramento — confirmar.

### 9.2 ItemOperationType → CFOP (NF-e mod 55)
| ItemOperationType.code | Operação | CFOP intra-estadual (AM→AM) | CFOP interestadual |
|---|---|---|---|
| TROCA | Venda de peça | 5102 | 6102 |
| DEVOLUCAO_VENDA | Devolução venda | 5202 | 6202 |
| REMESSA_GARANTIA | Remessa em garantia | 5949 | 6949 |
| RETORNO_GARANTIA | Retorno em garantia | 1949 | 2949 |

### 9.3 customer_type → tipo de documento
| `ServiceOrder.customer_type` | Tomador | Documento padrão |
|---|---|---|
| PARTICULAR (PF) | CPF | NFS-e |
| PARTICULAR (PJ) | CNPJ | NFS-e |
| SEGURADORA | (faturamento próprio) | Nenhum (fora deste spec) |

### 9.4 Bloco do orçamento → bloco fiscal
- `BudgetVersion.labor_total` → corpo da NFS-e (serviço prestado).
- `BudgetVersion.parts_total` → se peça é faturada separadamente para o cliente, vira NF-e mod 55 (desdobrar). Se vai junto no serviço (nota única de oficina), agrega na NFS-e como insumo do serviço (sem desdobramento). **Decisão depende do tratamento contábil da DS Car** — confirmar com contador.

---

## 10. Webhooks

### 10.1 Registro
```http
POST /v2/gatilhos
Authorization: Basic base64(token:)
Content-Type: application/json

{
  "url": "https://erp.dscar.paddock.solutions/api/v1/fiscal/webhook/focus/",
  "eventos": ["nfe_autorizado", "nfe_cancelado", "nfe_denegado",
              "nfse_autorizado", "nfse_cancelado",
              "nfce_autorizado", "manifestacao_destinatario"]
}
```
Registro feito **uma vez por ambiente** via management command (`python manage.py register_focus_webhook`). Idempotente: lista existentes via `GET /v2/gatilhos`, só cria se não existir.

### 10.2 Payload recebido (Focus → DS Car)
```json
{
  "cnpj_emitente": "12345678000195",
  "ref": "DSCAR-NFSE-20260423-042",
  "status": "autorizado",
  "chave_nfe": "AM26041234567800019555100000004210000000010",
  "evento": "nfse_autorizado"
}
```
Outros campos podem vir dependendo do evento (mensagem_sefaz em erros, justificativa em cancelamentos).

### 10.3 Validação no nosso lado
Como a Focus **não documenta segredo HMAC** explícito, o spec adota:
1. **Token bearer compartilhado** via header customizado: configurar no painel Focus um header `X-Focus-Webhook-Token: {FOCUS_NFE_WEBHOOK_SECRET}` (se Focus suportar — caso contrário usar URL com path-secret obscuro: `/api/v1/fiscal/webhook/{secret}/`).
2. **Allowlist de IPs** Focus (consultar suporte).
3. Idempotência: `(ref, evento)` já processado → retornar 200 sem reprocessar.

### 10.4 Resposta esperada
- **HTTP 2xx em até 30s** ou Focus considera falha e retenta.
- Política de retry: documentação não detalha — assumir backoff exponencial até 48h (compatível com convenções de mercado).

---

## 11. Tratamento de erros e retry

### 11.1 Hierarquia de exceptions
```python
class FocusNFeError(Exception): pass
class FocusAuthError(FocusNFeError): pass         # HTTP 401/403
class FocusValidationError(FocusNFeError): pass   # HTTP 400/415/422 (não retry)
class FocusNotFoundError(FocusNFeError): pass     # HTTP 404
class FocusRateLimitError(FocusNFeError): pass    # HTTP 429
class FocusServerError(FocusNFeError): pass       # HTTP 5xx (retry)
class FocusSEFAZError(FocusNFeError): pass        # status_sefaz indica rejeição
```

### 11.2 Retry policy (em Celery tasks)
```python
@shared_task(
    bind=True,
    autoretry_for=(FocusServerError, FocusRateLimitError, httpx.TimeoutException),
    retry_backoff=True,        # 2s, 4s, 8s, 16s...
    retry_backoff_max=300,     # cap 5min
    retry_jitter=True,
    max_retries=10,
)
def emit_fiscal_document_async(self, document_id):
    ...
```

### 11.3 Idempotência via `ref`
- `ref` é única por token. Se POST falha **antes** de autorização, mesmo `ref` pode ser reusada.
- Se POST autorizou, `ref` está queimada. Nova emissão = nova ref.
- Convenção: `{cnpj_filial[:8]}-{tipo}-{YYYYMMDD}-{seq6}` (ex: `12345678-NFSE-20260423-000042`). Sequência por tipo armazenada em `FiscalConfig.seq_nfse|seq_nfe|seq_nfce` (incrementa em `transaction.atomic` + `select_for_update`). `seq` para NFS-e duplica como `numero_rps`.

### 11.4 Distinção temporário × permanente
| Erro | Tipo | Ação |
|---|---|---|
| HTTP 5xx, timeout, 429 | Temporário | Retry automático |
| HTTP 400/422 + `requisicao_invalida` | Permanente | Notificar usuário; NÃO retry |
| `denegado` (SEFAZ) | Permanente | Mostrar mensagem_sefaz; pedir correção cadastral |
| `erro_autorizacao` corrigível | Manual | Operador corrige e clica "Reenviar" |
| `erro_validacao_schema` | Permanente | Bug no builder; abrir issue |

---

## 12. NFS-e Manaus-AM — gap conhecido

Documentação Focus referencia NFS-e Nacional + variantes municipais sem listar cobertura explícita. **Antes do Ciclo 06C**, abrir ticket com `suporte@focusnfe.com.br` para confirmar:

1. Manaus está homologada na Focus? Qual padrão (ABRASF Manaus / GINFES / próprio)?
2. Endpoint correto: `/v2/nfse` ou `/v2/nfse-nacional`?
3. Schema do JSON aceito pela SEMEF Manaus (campos obrigatórios extras: `discriminacao` formato? `codigo_tributario_municipio` 4 ou 8 dígitos?).
4. Alíquota ISS para item LC 14.01 (geralmente 5%, confirmar tabela 2026).
5. Prazo de cancelamento (suspeita: 30 dias, confirmar).
6. Suporte a NFS-e Substituta (caso de erro pós-prazo de cancelamento).
7. Existe homologação simulando SEMEF Manaus ou só ambiente nacional ABRASF?

Documentar respostas em `docs/superpowers/specs/anexos/2026-04-23-focus-suporte-manaus-respostas.md` antes de partir pro Ciclo 06C.

---

## 13. Estratégia de testes

### 13.1 Pirâmide
- **Unit (≥80%)**: builders de payload (NfeBuilder, NfceBuilder, ManausNfseBuilder), conversões CFOP/LC116, sequencer de RPS, hierarquia de exceptions.
- **Integração com mock**: `respx` mocando endpoints Focus, validando que `FocusNFeClient` faz request correto e parseia response. Fixtures JSON em `apps/fiscal/tests/fixtures/`.
- **Smoke live homologação**: `scripts/smoke_fiscal_homologacao.py` emite uma NFS-e + NF-e + NFC-e + cancelamento contra `https://homologacao.focusnfe.com.br` usando CNPJ teste. Roda em CI condicionado a env `FOCUS_NFE_TOKEN_HOMOLOG` setado (não roda em PRs externos).

### 13.2 Fixtures-chave
- `nfse_manaus_autorizado.json` — resposta real (sanitizada) de emissão bem-sucedida.
- `nfse_erro_autorizacao_codigo_servico_invalido.json`
- `nfe_devolucao_autorizado.json`
- `nfce_autorizado.json` (com QR-Code).
- `webhook_nfse_autorizado.json` (payload que Focus envia).

### 13.3 Smoke
Procedimento manual obrigatório antes de habilitar em produção:
1. Configurar empresa-teste DS Car em painel Focus homologação.
2. Upload certificado A1 de teste.
3. Rodar `python scripts/smoke_fiscal_homologacao.py --doc nfse` — emite, espera autorizado, baixa XML, cancela.
4. Repetir para `--doc nfe`, `--doc nfce`, `--doc devolucao`.
5. Disparar webhook de teste via painel Focus, verificar log `FiscalEvent(WEBHOOK)`.
6. Validar XMLs gerados em `xml.sefaz.am.gov.br` (consulta pública por chave).

---

## 14. Roadmap de implementação

| Ciclo | Escopo | Dependências | Testes alvo |
|---|---|---|---|
| **06A** | `Person` evolução: Document, Category, Contact, Address, EncryptedField LGPD. Migração dos 7.789 cadastros do Databox. | Nenhuma | +40 testes (PII encrypt/decrypt, ETL, soft-delete) |
| **06B** | App `apps/fiscal` foundation: settings, FiscalConfig, FocusNFeClient, FiscalEvent, FiscalDocument(empty), exception hierarchy, Celery skeleton. | 06A | +25 testes (client mocked, model invariants) |
| **06C** | NFS-e Manaus end-to-end (após confirmação suporte Focus §12): ManausNfseBuilder + ManualNfseBuilder (§8.5), FiscalService.emit_nfse + emit_manual_nfse, polling, integração com `_can_deliver`, frontend modal de emissão automatizada + tela "Emitir NFS-e manual". | 06B + resposta Focus suporte | +40 testes + smoke live |
| **06D** | NF-e mod 55 + devolução + CCe + inutilização + emissão manual (§8.5): NfeBuilder + ManualNfeBuilder, FiscalService.emit_nfe/emit_manual_nfe/devolucao/cce. Mapeamentos CFOP. Frontend tela de venda de peça avulsa + tela "Emitir NF-e manual". | 06C | +35 testes + smoke |
| **06E** | NFC-e mod 65 (síncrono): NfceBuilder, FiscalService.emit_nfce, frontend PDV balcão simplificado, geração de QR-Code visual. | 06D | +20 testes + smoke |
| **06F** | Manifestação destinatário: FiscalReceivedDocument, manifestacao_service, Celery beat `sync_focus_inbox`, frontend caixa de entrada de NFs. | 06E + validação de payload em homologação | +20 testes + smoke |

**Webhooks** (registro + receiver + dispatcher) entram no Ciclo 06B já preparados, mas só são úteis a partir do 06C (primeira emissão real).

**Total estimado:** ~180 testes novos sobre os ~270 atuais (+67%).

---

## 15. Decisões em aberto (a confirmar antes de implementar)

1. **Padrão NFS-e Manaus** — abrir ticket suporte Focus (§12).
2. **Tratamento contábil de peças** em OS particular: peça vai junto na NFS-e (insumo) ou desdobra em NF-e mod 55? Confirmar com contador da DS Car.
3. **Multi-CNPJ**: matriz única no MVP ou já preparar Filial Vieiralves vs Filial Manaus? `FiscalConfig` suporta ambos; decidir no Ciclo 06B.
4. **Histórico legacy NFs Databox**: importar XMLs antigas para `FiscalDocument` (com `legacy_databox_id` preenchido) ou apenas referenciar metadata? Decisão no Ciclo 06A junto com ETL Person.
5. **Validação webhook Focus**: HMAC suportado? Path-secret é aceitável? Confirmar.
6. **Certificado A1**: gestão de upload/renovação (UI no admin? CLI?). Decidir Ciclo 06B.

---

## 16. Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| NFS-e Manaus incompatível com Focus | Média | Validar §12 ANTES de iniciar 06C |
| Schema NFS-e mudar (LC municipal) | Baixa | Testar em homologação trimestralmente |
| Webhook Focus instável | Baixa | Polling Celery como fallback (já no design) |
| Token Focus vazado | Baixa | EncryptedField + rotação anual + WhatsApp 2FA painel Focus |
| Certificado A1 expirar sem aviso | Média | Celery beat diário verifica `data_validade_certificado` em `/v2/empresas/{id}` e alerta 30d antes |
| Rate limit em pico de fechamento de OS | Baixa | Backoff exponencial + fila Celery limita concorrência |

---

## 17. Próximo passo

Após aprovação deste spec:
1. Atualizar `MVP_CHECKLIST.md` com seção "Ciclo 06A → 06F" referenciando este documento.
2. Invocar `superpowers:writing-plans` para gerar plano de implementação do **Ciclo 06A** (apenas `Person` evolução), referenciando este spec na seção Context.
3. Não iniciar 06A enquanto resposta do suporte Focus (§12, Q1) não chegar — pode mudar arquitetura do builder.

---

**FIM DO SPEC**
