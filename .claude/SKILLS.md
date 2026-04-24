# SKILLS — Padrões de Implementação · ERP DS Car

Padrões copy-paste-ready. Cada entrada referencia arquivos reais do repo + spec de origem (quando aplicável).
Use estes padrões antes de inventar arquitetura nova.

---

## fiscal-nfe-pattern

**Quando usar:** ao implementar qualquer interação com Focus NF-e v2 (NFS-e, NF-e mod 55, NFC-e mod 65, manifestação destinatário, webhooks, cancelamento, devolução, CCe, inutilização).

**Spec de referência:** [docs/superpowers/specs/2026-04-23-modulo-fiscal-focus-nfe-design.md](../docs/superpowers/specs/2026-04-23-modulo-fiscal-focus-nfe-design.md)

**Arquivos de referência (padrões a copiar):**
- HTTP client httpx + dataclass response: [backend/core/apps/imports/sources/cilia_client.py](../backend/core/apps/imports/sources/cilia_client.py)
- Auditoria por evento: [backend/core/apps/imports/models.py:5-78](../backend/core/apps/imports/models.py)
- Celery task com retry: [backend/core/apps/imports/tasks.py](../backend/core/apps/imports/tasks.py)
- Trava de domínio fiscal: [backend/core/apps/service_orders/services.py:158](../backend/core/apps/service_orders/services.py)

### Convenção de `ref` única
A `ref` é o identificador idempotente da Focus. Reutilizável apenas se POST falhou antes de autorização.

```python
# apps/fiscal/services/ref_generator.py
from django.db import transaction
from django.db.models import F

SEQ_FIELD_BY_TYPE = {
    "NFSE": "seq_nfse",
    "NFE": "seq_nfe",
    "NFE_DEV": "seq_nfe",
    "NFCE": "seq_nfce",
}


def next_fiscal_ref(config: FiscalConfig, doc_type: str) -> tuple[str, int]:
    """Gera ref única no formato {cnpj8}-{tipo}-{YYYYMMDD}-{seq6}.

    Retorna (ref, seq). Para NFS-e o `seq` também é usado como `numero_rps`.
    Exemplo: '12345678-NFSE-20260423-000042'
    """
    field = SEQ_FIELD_BY_TYPE.get(doc_type)
    if field is None:
        raise ValueError(f"doc_type não suportado: {doc_type}")

    today = timezone.now().strftime("%Y%m%d")
    with transaction.atomic():
        FiscalConfig.objects.filter(pk=config.pk).select_for_update().update(
            **{field: F(field) + 1}
        )
        config.refresh_from_db(fields=[field])
    seq = getattr(config, field) - 1
    return f"{config.cnpj[:8]}-{doc_type}-{today}-{seq:06d}", seq
```

### Cliente HTTP
**Princípio:** não levantar exception em 4xx/5xx. Quem decide é o `FiscalService`.

```python
# apps/fiscal/clients/focus_nfe_client.py
import time
import httpx
from dataclasses import dataclass, field
from typing import Any
from django.conf import settings


@dataclass
class FocusResponse:
    status_code: int
    data: dict[str, Any] | None
    duration_ms: int
    raw_text: str = ""
    headers: dict[str, str] = field(default_factory=dict)


class FocusNFeError(Exception):
    pass


class FocusAuthError(FocusNFeError):
    pass  # 401/403


class FocusValidationError(FocusNFeError):
    pass  # 400/415/422 — não retry


class FocusNotFoundError(FocusNFeError):
    pass  # 404


class FocusRateLimitError(FocusNFeError):
    pass  # 429


class FocusServerError(FocusNFeError):
    pass  # 5xx — retry


class FocusNFeClient:
    """Cliente Focus NF-e v2 — espelha CiliaClient (não levanta em HTTP error)."""

    def __init__(
        self,
        token: str | None = None,
        base_url: str | None = None,
        timeout: int | None = None,
    ):
        self.token = token or settings.FOCUS_NFE_TOKEN
        self.base_url = base_url or settings.FOCUS_NFE_BASE_URL
        self.timeout = timeout or settings.FOCUS_NFE_TIMEOUT_SECONDS
        self._client = httpx.Client(
            base_url=self.base_url,
            auth=(self.token, ""),
            timeout=self.timeout,
            headers={"Content-Type": "application/json"},
        )

    # NFS-e
    def emit_nfse(self, ref: str, payload: dict) -> FocusResponse:
        return self._request("POST", f"/v2/nfse?ref={ref}", json=payload)

    def consult_nfse(self, ref: str) -> FocusResponse:
        return self._request("GET", f"/v2/nfse/{ref}")

    def cancel_nfse(self, ref: str, justificativa: str) -> FocusResponse:
        return self._request("DELETE", f"/v2/nfse/{ref}", json={"justificativa": justificativa})

    # NF-e modelo 55
    def emit_nfe(self, ref: str, payload: dict) -> FocusResponse:
        return self._request("POST", f"/v2/nfe?ref={ref}", json=payload)

    def consult_nfe(self, ref: str, completa: bool = False) -> FocusResponse:
        path = f"/v2/nfe/{ref}" + ("?completa=1" if completa else "")
        return self._request("GET", path)

    def cancel_nfe(self, ref: str, justificativa: str) -> FocusResponse:
        return self._request("DELETE", f"/v2/nfe/{ref}", json={"justificativa": justificativa})

    # NFC-e modelo 65
    def emit_nfce(self, ref: str, payload: dict) -> FocusResponse:
        return self._request("POST", f"/v2/nfce?ref={ref}", json=payload)

    def consult_nfce(self, ref: str) -> FocusResponse:
        return self._request("GET", f"/v2/nfce/{ref}")

    def cancel_nfce(self, ref: str, justificativa: str) -> FocusResponse:
        return self._request("DELETE", f"/v2/nfce/{ref}", json={"justificativa": justificativa})

    # CCe / inutilização
    def cce(self, ref: str, sequencia: int, texto: str) -> FocusResponse:
        return self._request(
            "POST",
            f"/v2/nfe/{ref}/carta_correcao",
            json={"sequencia_evento": sequencia, "texto_correcao": texto},
        )

    def inutilizar(self, serie: int, numero_inicial: int, numero_final: int, justificativa: str) -> FocusResponse:
        return self._request(
            "POST",
            "/v2/nfe/inutilizacao",
            json={
                "serie": serie,
                "numero_inicial": numero_inicial,
                "numero_final": numero_final,
                "justificativa": justificativa,
            },
        )

    def manifestar(self, chave: str, tipo_evento: str, justificativa: str = "") -> FocusResponse:
        body: dict[str, Any] = {"tipo_evento": tipo_evento}
        if justificativa:
            body["justificativa"] = justificativa
        return self._request("POST", f"/v2/nfes_recebidas/{chave}/manifesto", json=body)

    def listar_nfes_recebidas(self, cnpj: str, pagina: int = 1) -> FocusResponse:
        return self._request("GET", f"/v2/nfes_recebidas?cnpj={cnpj}&pagina={pagina}")

    def _request(self, method: str, path: str, **kwargs) -> FocusResponse:
        start = time.perf_counter()
        response = self._client.request(method, path, **kwargs)
        duration_ms = int((time.perf_counter() - start) * 1000)
        try:
            data = response.json()
        except Exception:
            data = None
        return FocusResponse(
            status_code=response.status_code,
            data=data,
            duration_ms=duration_ms,
            raw_text=response.text,
            headers=dict(response.headers),
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
```

### Service layer
**Princípio:** uma transação por operação. `FiscalEvent` para auditoria. Mapeamento HTTP → exception.

```python
# apps/fiscal/services/fiscal_service.py
from django.db import transaction
from django.utils import timezone
from ..clients.focus_nfe_client import (
    FocusNFeClient, FocusResponse,
    FocusAuthError, FocusValidationError, FocusNotFoundError,
    FocusRateLimitError, FocusServerError,
)
from ..models import FiscalDocument, FiscalEvent, FiscalConfig
from .ref_generator import next_fiscal_ref


class FiscalService:
    @classmethod
    @transaction.atomic
    def emit_nfse(
        cls,
        service_order,
        payment,
        config: FiscalConfig,
        triggered_by: str = "USER",
    ) -> FiscalDocument:
        from .manaus_nfse import ManausNfseBuilder

        ref, seq = next_fiscal_ref(config, "NFSE")
        payload = ManausNfseBuilder(config, service_order, payment, numero_rps=seq).build()

        doc = FiscalDocument.objects.create(
            config=config,
            doc_type="NFSE",
            ref=ref,
            status="DRAFT",
            service_order=service_order,
            payment=payment,
            destinatario=service_order.customer,
            payload_enviado=payload,
            valor_total=payload["servico"]["valor_servicos"],
        )
        FiscalEvent.objects.create(
            document=doc,
            event_type="EMIT_REQUEST",
            payload=payload,
            triggered_by=triggered_by,
        )

        with FocusNFeClient() as client:
            resp = client.emit_nfse(ref, payload)

        FiscalEvent.objects.create(
            document=doc,
            event_type="EMIT_RESPONSE",
            http_status=resp.status_code,
            response=resp.data or {"raw": resp.raw_text},
            duration_ms=resp.duration_ms,
            triggered_by=triggered_by,
        )

        cls._raise_for_http(resp)

        # 201: documento aceito (geralmente "processando_autorizacao" em NFS-e)
        doc.status = "PROCESSING"
        doc.ultima_resposta = resp.data
        doc.save(update_fields=["status", "ultima_resposta", "updated_at"])

        # Schedule polling de status
        from ..tasks import poll_fiscal_document
        poll_fiscal_document.apply_async(args=[doc.id], countdown=10)

        return doc

    @classmethod
    @transaction.atomic
    def cancel(cls, doc: FiscalDocument, justificativa: str) -> FiscalDocument:
        if doc.status != "AUTHORIZED":
            raise FocusValidationError(f"Documento {doc.ref} não está autorizado.")
        if len(justificativa) < 15:
            raise FocusValidationError("Justificativa precisa ter ao menos 15 caracteres.")

        with FocusNFeClient() as client:
            method_map = {
                "NFSE": client.cancel_nfse,
                "NFE_55": client.cancel_nfe,
                "NFCE_65": client.cancel_nfce,
            }
            cancel_fn = method_map.get(doc.doc_type)
            if cancel_fn is None:
                raise FocusValidationError(f"Tipo {doc.doc_type} não suporta cancelamento.")
            resp = cancel_fn(doc.ref, justificativa)

        FiscalEvent.objects.create(
            document=doc,
            event_type="CANCEL_REQUEST",
            payload={"justificativa": justificativa},
            response=resp.data or {"raw": resp.raw_text},
            http_status=resp.status_code,
            duration_ms=resp.duration_ms,
            triggered_by="USER",
        )

        cls._raise_for_http(resp)

        doc.status = "CANCELLED"
        doc.data_cancelamento = timezone.now()
        doc.justificativa_cancelamento = justificativa
        if resp.data and "caminho_xml_cancelamento" in resp.data:
            doc.caminho_xml_cancelamento = resp.data["caminho_xml_cancelamento"]
        doc.save()
        return doc

    @staticmethod
    def _raise_for_http(resp: FocusResponse) -> None:
        sc = resp.status_code
        if 200 <= sc < 300:
            return
        if sc in (401, 403):
            raise FocusAuthError(resp.data)
        if sc == 404:
            raise FocusNotFoundError(resp.data)
        if sc == 429:
            raise FocusRateLimitError(resp.data)
        if 400 <= sc < 500:
            raise FocusValidationError(resp.data)
        if sc >= 500:
            raise FocusServerError(resp.data)
```

### Celery task com retry
```python
# apps/fiscal/tasks.py
from celery import shared_task
from celery.exceptions import MaxRetriesExceededError
import httpx
from .clients.focus_nfe_client import (
    FocusNFeClient, FocusServerError, FocusRateLimitError, FocusValidationError,
)
from .models import FiscalDocument, FiscalEvent

POLL_TERMINAL_STATES = {"AUTHORIZED", "DENIED", "ERROR", "CANCELLED"}
POLL_MAX_ATTEMPTS = 60  # 60 * 10s = 10min


@shared_task(
    bind=True,
    autoretry_for=(FocusServerError, FocusRateLimitError, httpx.TimeoutException),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    max_retries=10,
)
def poll_fiscal_document(self, document_id: int, attempt: int = 1):
    doc = FiscalDocument.objects.get(pk=document_id)
    if doc.status in POLL_TERMINAL_STATES:
        return {"document_id": document_id, "skipped": True, "status": doc.status}

    consult_map = {
        "NFSE": "consult_nfse",
        "NFE_55": "consult_nfe",
        "NFCE_65": "consult_nfce",
    }
    method_name = consult_map.get(doc.doc_type)
    if method_name is None:
        return {"error": f"unsupported doc_type {doc.doc_type}"}

    with FocusNFeClient() as client:
        resp = getattr(client, method_name)(doc.ref)

    FiscalEvent.objects.create(
        document=doc,
        event_type="CONSULT",
        http_status=resp.status_code,
        response=resp.data or {"raw": resp.raw_text},
        duration_ms=resp.duration_ms,
        triggered_by="CELERY",
    )

    if resp.status_code == 200 and resp.data:
        focus_status = resp.data.get("status", "")
        new_status = _map_focus_status(focus_status)
        if new_status:
            _apply_status(doc, new_status, resp.data)

    if doc.status not in POLL_TERMINAL_STATES and attempt < POLL_MAX_ATTEMPTS:
        poll_fiscal_document.apply_async(
            args=[document_id, attempt + 1], countdown=10,
        )

    return {"document_id": document_id, "status": doc.status, "attempt": attempt}


def _map_focus_status(focus_status: str) -> str | None:
    return {
        "processando_autorizacao": "PROCESSING",
        "autorizado": "AUTHORIZED",
        "denegado": "DENIED",
        "erro_autorizacao": "ERROR",
        "cancelado": "CANCELLED",
    }.get(focus_status)


def _apply_status(doc: FiscalDocument, new_status: str, data: dict) -> None:
    """Aplica resposta da Focus ao documento. Campos variam por tipo:
       - NF-e/NFC-e: chave_nfe, numero, caminho_xml_nota_fiscal, caminho_danfe
       - NFS-e: numero (definitivo da prefeitura), caminho_xml_nfse, caminho_danfse
    """
    doc.status = new_status
    doc.ultima_resposta = data
    doc.chave = data.get("chave_nfe", data.get("codigo_verificacao", "")) or doc.chave
    if "numero" in data:
        doc.numero = str(data["numero"])
    doc.caminho_xml = (
        data.get("caminho_xml_nota_fiscal")
        or data.get("caminho_xml_nfse")
        or doc.caminho_xml
    )
    doc.caminho_pdf = (
        data.get("caminho_danfe")
        or data.get("caminho_danfse")
        or doc.caminho_pdf
    )
    if data.get("mensagem_sefaz"):
        doc.mensagem_sefaz = data["mensagem_sefaz"]
    if data.get("data_autorizacao"):
        doc.data_autorizacao = data["data_autorizacao"]
    doc.save()
```

### Webhook receiver
**Princípio:** validar origem, idempotência por `(ref, evento)`, responder rápido (≤30s).

```python
# apps/fiscal/views.py (trecho)
from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .models import FiscalDocument, FiscalEvent
from .tasks import poll_fiscal_document


class FocusWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []  # autenticação via secret no path

    def post(self, request, secret: str):
        if secret != settings.FOCUS_NFE_WEBHOOK_SECRET:
            return Response(status=status.HTTP_403_FORBIDDEN)

        payload = request.data
        ref = payload.get("ref")
        evento = payload.get("evento")
        if not ref or not evento:
            return Response({"error": "missing ref/evento"}, status=400)

        doc = FiscalDocument.objects.filter(ref=ref).first()
        if doc is None:
            # Evento de documento desconhecido (não emitido por nós) — registrar e ok
            FiscalEvent.objects.create(
                event_type="WEBHOOK",
                payload=payload,
                triggered_by="WEBHOOK",
            )
            return Response(status=200)

        # Idempotência: já processado?
        if FiscalEvent.objects.filter(
            document=doc,
            event_type="WEBHOOK",
            payload__evento=evento,
        ).exists():
            return Response(status=200)

        FiscalEvent.objects.create(
            document=doc,
            event_type="WEBHOOK",
            payload=payload,
            triggered_by="WEBHOOK",
        )

        # Reagir ao evento agendando consulta (consulta autoritativa, não confiar 100% no payload)
        poll_fiscal_document.apply_async(args=[doc.id], countdown=2)

        return Response(status=200)
```

### Testes (respx)
**Princípio:** fixtures JSON salvas em `apps/fiscal/tests/fixtures/`. Cada cenário (autorizado/erro/denegado) tem fixture própria.

```python
# apps/fiscal/tests/test_service.py
import json
from pathlib import Path
import pytest
import respx
from httpx import Response
from apps.fiscal.services.fiscal_service import FiscalService
from apps.fiscal.clients.focus_nfe_client import FocusValidationError

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def nfse_authorized_response():
    return json.loads((FIXTURES / "nfse_manaus_autorizado.json").read_text())


@pytest.mark.django_db
@respx.mock
def test_emit_nfse_persists_document(fiscal_config, service_order_particular, payment_particular, nfse_authorized_response):
    respx.post(url__regex=r".*/v2/nfse\?ref=.*").mock(
        return_value=Response(201, json={"status": "processando_autorizacao"})
    )
    doc = FiscalService.emit_nfse(service_order_particular, payment_particular, fiscal_config)
    assert doc.status == "PROCESSING"
    assert doc.ref.startswith(fiscal_config.cnpj[:8])
    assert doc.events.filter(event_type="EMIT_REQUEST").exists()
    assert doc.events.filter(event_type="EMIT_RESPONSE").exists()


@pytest.mark.django_db
@respx.mock
def test_emit_nfse_propagates_validation_error(fiscal_config, service_order_particular, payment_particular):
    respx.post(url__regex=r".*/v2/nfse\?ref=.*").mock(
        return_value=Response(422, json={"codigo": "requisicao_invalida", "mensagem": "..."})
    )
    with pytest.raises(FocusValidationError):
        FiscalService.emit_nfse(service_order_particular, payment_particular, fiscal_config)
```

### Smoke live (não roda em CI público)
```python
# scripts/smoke_fiscal_homologacao.py
"""
Roda contra https://homologacao.focusnfe.com.br com CNPJ teste.
Pré: FOCUS_NFE_AMBIENTE=homologacao, FOCUS_NFE_TOKEN=<token homolog>, CNPJ_EMISSOR cadastrado em painel.

Uso: python scripts/smoke_fiscal_homologacao.py --doc nfse
"""
import argparse, django, os, sys
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

# ... carrega FiscalConfig homolog, dispara FiscalService.emit_nfse com OS de teste,
# polla status até autorizado/erro, baixa XML, cancela, valida transições.
```

### Settings esperados
```python
# backend/core/config/settings.py (adicionar)
FOCUS_NFE_TOKEN = env("FOCUS_NFE_TOKEN")
FOCUS_NFE_AMBIENTE = env("FOCUS_NFE_AMBIENTE", default="homologacao")
FOCUS_NFE_BASE_URL = (
    "https://homologacao.focusnfe.com.br"
    if FOCUS_NFE_AMBIENTE == "homologacao"
    else "https://api.focusnfe.com.br"
)
FOCUS_NFE_TIMEOUT_SECONDS = env.int("FOCUS_NFE_TIMEOUT_SECONDS", default=60)
FOCUS_NFE_WEBHOOK_SECRET = env("FOCUS_NFE_WEBHOOK_SECRET")
CNPJ_EMISSOR = env("CNPJ_EMISSOR")

# Hard guard contra emissão real em DEBUG
if FOCUS_NFE_AMBIENTE == "producao" and DEBUG:
    raise ImproperlyConfigured("FOCUS_NFE_AMBIENTE=producao não permitido com DEBUG=True")
```

### Checklist por documento

**NFS-e:**
- [ ] `prestador.cnpj` + `inscricao_municipal` da `FiscalConfig`
- [ ] `tomador` com endereço completo (Address obrigatório)
- [ ] `servico.codigo_municipio = "1302603"` (Manaus IBGE)
- [ ] `servico.item_lista_servico` (LC 116 — usar `14.01` para oficinas)
- [ ] `rps` com sequência local (FiscalConfig.proximo_numero_rps)
- [ ] Após autorizado: baixar XML + DANFSE, enviar email ao tomador

**NF-e mod 55:**
- [ ] `finalidade_emissao = 1` (normal) ou `4` (devolução)
- [ ] Se devolução: `notas_referenciadas: [{chave_nfe: ...}]`
- [ ] `cfop` correto (5102/5202/etc — ver §9.2 do spec)
- [ ] `ncm` válido por item
- [ ] `regime_tributario_emitente` da FiscalConfig
- [ ] Cancelamento até 24h após autorização

**NFC-e mod 65:**
- [ ] `consumidor_final = 1`
- [ ] `formas_pagamento` array obrigatório
- [ ] `nfce_csc` + `nfce_identificador_csc` (fornecidos pela SEFAZ-AM)
- [ ] CPF tomador opcional
- [ ] Resposta JÁ é final (não há polling)
- [ ] Cancelamento em 30 min (AM)

**Manifestação:**
- [ ] Validar payload em homologação (doc Focus incompleta)
- [ ] Tipos: `ciencia` (10d), `confirmacao` (180d), `desconhecimento` (10d), `operacao_nao_realizada` (180d)
- [ ] Beat Celery `sync_focus_inbox` a cada 1h

### Anti-patterns
- ❌ Levantar exception do client em 4xx — quebra auditoria. Service decide.
- ❌ Reusar `ref` após autorização — Focus rejeita. Sempre nova ref.
- ❌ Confiar no payload do webhook como autoritativo — sempre re-consultar via GET após webhook.
- ❌ Polling sem `countdown` — derruba broker. Espace 10s mínimo.
- ❌ Token Focus em `settings.py` literal — sempre via env + EncryptedField em multi-CNPJ.
- ❌ Usar `?token=` em query string — vaza em logs. HTTP Basic sempre.
- ❌ Permitir delivery sem checar `Payment.fiscal_document.status == AUTHORIZED` — quebra trava de [`_can_deliver`](../backend/core/apps/service_orders/services.py:158).

---

<!-- Outras skills referenciadas em CLAUDE.md serão adicionadas aqui conforme cada módulo for implementado:
- django-model-pattern
- api-endpoint-pattern
- service-layer-pattern
- multitenancy-pattern
- sso-hub-pattern
- nextjs-page-pattern
- erp-service-order
- person-schema-pattern
- cilia-integration
- lgpd-compliance
- erp-ai-recommendations
-->
