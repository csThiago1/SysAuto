# Galeria de Fotos da OS — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seleção múltipla de fotos (download ZIP + exclusão em massa MANAGER+), upload múltiplo com fila visível e câmera funcional com captura sequencial e marca d'água, na aba de arquivos da OS.

**Architecture:** Backend Django ganha 2 actions novas no `ServiceOrderViewSet` (`photos/download/` ZIP via stdlib `zipfile`; `photos/bulk-delete/` soft delete em lote) e endurece o delete de foto para MANAGER+. Frontend Next.js ganha um hook de fila de upload (concorrência 2, retry, validação client-side), modo seleção na `FilesTab` e o `CameraCapture` reescrito para captura sequencial com layout que não corta os controles.

**Tech Stack:** Django 5 + DRF (stdlib `zipfile`, `tempfile`), Next.js 15 + TanStack Query + shadcn/ui, pytest (`TenantTestCase`), Vitest. **Zero dependências novas.**

**Spec:** `docs/superpowers/specs/2026-07-13-os-photo-gallery-design.md`

## Global Constraints

- Fotos são IMUTÁVEIS — exclusão é sempre soft delete (`is_active=False`), `s3_key` preservado (evidência de sinistro).
- Excluir fotos (individual e em massa): MANAGER+ (`IsManagerOrAbove`). Baixar: qualquer role com `os.view`.
- Erros de API: sempre `{"detail": "..."}` — nunca `"erro"`/`"error"`, nunca `str(e)` em broad except.
- Endpoint novo SEMPRE com `@extend_schema` (schema OpenAPI deve continuar com 0 warnings).
- Hooks de API do frontend: sempre `/api/proxy/` (nunca URL do Django direto).
- TypeScript strict — nunca `any`; Python com type hints obrigatórios.
- Limites de upload (espelhar no client): imagens JPEG/PNG/WebP/HEIC/HEIF ≤ 10MB; PDF ≤ 20MB somente na pasta `orcamentos`.
- Conventional commits em pt-BR: `feat(dscar): ...`, `fix(dscar): ...`, `test(dscar): ...`.
- Backend: dev server roda em Docker com volume mount — editar sempre na pasta principal, nunca em `.worktrees/`.
- Comandos de teste: backend `cd backend/core && .venv/bin/pytest <path> -v`; frontend `cd apps/dscar-web && npx vitest run <path>`.

---

### Task 1: Backend — MANAGER+ para excluir foto individual

**Files:**
- Modify: `backend/core/apps/service_orders/views/orders.py:169-182` (`get_permissions`)
- Create: `backend/core/apps/service_orders/tests/test_photos.py`

**Interfaces:**
- Produces: action `photo_detail` (DELETE) protegida por `IsManagerOrAbove`; base de teste `PhotoAPITestBase` com helpers `self.auth(role)` e `self.make_photo(...)` reutilizados pelas Tasks 2 e 3.

- [ ] **Step 1: Escrever a base de teste + testes de permissão (falhando)**

Criar `backend/core/apps/service_orders/tests/test_photos.py`:

```python
"""Testes de fotos da OS — permissões, bulk-delete e download ZIP."""
import hashlib
import io
import zipfile

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import override_settings
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIClient

from apps.authentication.models import GlobalUser
from apps.service_orders.models import (
    ActivityType,
    ServiceOrder,
    ServiceOrderActivityLog,
    ServiceOrderPhoto,
    ServiceOrderStatus,
)

IN_MEMORY_STORAGE = {
    "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}


@override_settings(STORAGES=IN_MEMORY_STORAGE)
class PhotoAPITestBase(TenantTestCase):
    """Base: OS + user + client autenticável por role."""

    def setUp(self) -> None:
        super().setUp()
        email = "fotos@dscar.com"
        email_hash = hashlib.sha256(email.encode()).hexdigest()
        self.user = GlobalUser.objects.filter(email_hash=email_hash).first()
        if self.user is None:
            self.user = GlobalUser.objects.create_user(
                email=email, email_hash=email_hash, password="x"
            )
        self.order = ServiceOrder.objects.create(
            number=9950,
            plate="FOT0A11",
            customer_name="Cliente Fotos",
            status=ServiceOrderStatus.RECEPTION,
            created_by=self.user,
        )
        self.client = APIClient()
        self.client.defaults["SERVER_NAME"] = self.domain.domain
        self.client.defaults["HTTP_HOST"] = self.domain.domain

    def auth(self, role: str = "ADMIN") -> None:
        self.client.force_authenticate(user=self.user, token={"role": role})

    def make_photo(
        self, folder: str = "vistoria_inicial", content: bytes = b"jpegdata", **kwargs
    ) -> ServiceOrderPhoto:
        key = default_storage.save(
            f"service_orders/{self.order.id}/{folder}/t.jpg", ContentFile(content)
        )
        return ServiceOrderPhoto.objects.create(
            service_order=self.order,
            folder=folder,
            s3_key=key,
            uploaded_by_id=self.user.id,
            **kwargs,
        )


class PhotoDeletePermissionTest(PhotoAPITestBase):
    def _url(self, photo_id: str) -> str:
        return f"/api/v1/service-orders/{self.order.id}/photos/{photo_id}/"

    def test_delete_consultant_retorna_403(self) -> None:
        photo = self.make_photo()
        self.auth("CONSULTANT")
        resp = self.client.delete(self._url(str(photo.id)))
        assert resp.status_code == 403
        photo.refresh_from_db()
        assert photo.is_active is True

    def test_delete_manager_soft_delete_204(self) -> None:
        photo = self.make_photo()
        self.auth("MANAGER")
        resp = self.client.delete(self._url(str(photo.id)))
        assert resp.status_code == 204
        photo.refresh_from_db()
        assert photo.is_active is False
        assert photo.s3_key  # preservado
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend/core && .venv/bin/pytest apps/service_orders/tests/test_photos.py -v`
Expected: `test_delete_consultant_retorna_403` FALHA (retorna 204, pois hoje CONSULTANT consegue excluir). `test_delete_manager_soft_delete_204` já deve passar.

- [ ] **Step 3: Endurecer o get_permissions**

Em `backend/core/apps/service_orders/views/orders.py`, no `get_permissions()` (linha ~169), adicionar o branch ANTES do default:

```python
        if self.action == "deliver":
            return [IsAuthenticated(), HasTenantPermission("os.transition")]
        # Exclusão de fotos (individual e em lote): MANAGER+ — fotos são
        # evidência de sinistro, soft delete restrito a gestão.
        if self.action in ("photo_detail", "photos_bulk_delete"):
            return [IsAuthenticated(), IsManagerOrAbove()]
        # Default: read access (list, retrieve, sync, etc.)
        return [IsAuthenticated(), HasTenantPermission("os.view")]
```

`IsManagerOrAbove` já está importado na linha 20. (`photos_bulk_delete` ainda não existe — a action é criada na Task 2; incluir o nome aqui já deixa a permissão pronta e não quebra nada.)

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend/core && .venv/bin/pytest apps/service_orders/tests/test_photos.py -v`
Expected: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/core/apps/service_orders/views/orders.py backend/core/apps/service_orders/tests/test_photos.py
git commit -m "fix(os): exclusão de foto exige MANAGER+ (evidência de sinistro)"
```

---

### Task 2: Backend — bulk-delete de fotos (soft delete em lote)

**Files:**
- Modify: `backend/core/apps/service_orders/models/service_order.py:626-646` (enum `ActivityType`)
- Modify: `backend/core/apps/service_orders/serializers/core.py` (novo `PhotoIdsSerializer`, perto do `UploadPhotoSerializer` linha ~951)
- Modify: `backend/core/apps/service_orders/serializers/__init__.py` (export)
- Modify: `backend/core/apps/service_orders/views/orders.py` (nova action, logo após `photo_detail` linha ~1265)
- Test: `backend/core/apps/service_orders/tests/test_photos.py`

**Interfaces:**
- Consumes: `PhotoAPITestBase` (Task 1).
- Produces: `POST /api/v1/service-orders/{id}/photos/bulk-delete/` body `{"photo_ids": [uuid...]}` → `200 {"deleted": N}` | `400 {"detail": ...}` | `403`; `ActivityType.FILE_DELETED = "file_deleted"`; `PhotoIdsSerializer` (campo `photo_ids: list[UUID]`, min 1, max 500) — reutilizado na Task 3.

- [ ] **Step 1: Escrever os testes (falhando)**

Adicionar ao final de `test_photos.py`:

```python
class PhotoBulkDeleteTest(PhotoAPITestBase):
    def _url(self) -> str:
        return f"/api/v1/service-orders/{self.order.id}/photos/bulk-delete/"

    def test_manager_bulk_delete_soft_e_log_unico(self) -> None:
        p1 = self.make_photo(folder="vistoria_inicial")
        p2 = self.make_photo(folder="documentos")
        self.auth("MANAGER")
        resp = self.client.post(
            self._url(), {"photo_ids": [str(p1.id), str(p2.id)]}, format="json"
        )
        assert resp.status_code == 200
        assert resp.json() == {"deleted": 2}
        p1.refresh_from_db()
        p2.refresh_from_db()
        assert p1.is_active is False and p2.is_active is False
        assert p1.s3_key and p2.s3_key  # preservados
        logs = ServiceOrderActivityLog.objects.filter(
            service_order=self.order, activity_type=ActivityType.FILE_DELETED
        )
        assert logs.count() == 1
        assert "2 foto" in logs.first().description

    def test_consultant_retorna_403(self) -> None:
        photo = self.make_photo()
        self.auth("CONSULTANT")
        resp = self.client.post(self._url(), {"photo_ids": [str(photo.id)]}, format="json")
        assert resp.status_code == 403

    def test_foto_de_outra_os_retorna_400(self) -> None:
        other_order = ServiceOrder.objects.create(
            number=9951,
            plate="FOT0B22",
            customer_name="Outro Cliente",
            status=ServiceOrderStatus.RECEPTION,
            created_by=self.user,
        )
        alheia = ServiceOrderPhoto.objects.create(
            service_order=other_order,
            folder="vistoria_inicial",
            s3_key="x/y.jpg",
            uploaded_by_id=self.user.id,
        )
        minha = self.make_photo()
        self.auth("MANAGER")
        resp = self.client.post(
            self._url(), {"photo_ids": [str(minha.id), str(alheia.id)]}, format="json"
        )
        assert resp.status_code == 400
        minha.refresh_from_db()
        assert minha.is_active is True  # nada foi excluído

    def test_lista_vazia_retorna_400(self) -> None:
        self.auth("MANAGER")
        resp = self.client.post(self._url(), {"photo_ids": []}, format="json")
        assert resp.status_code == 400
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend/core && .venv/bin/pytest apps/service_orders/tests/test_photos.py -v`
Expected: os 4 testes novos FALHAM com 404 (rota não existe) ou ImportError de `ActivityType.FILE_DELETED`.

- [ ] **Step 3: Enum + serializer + action**

3a. Em `models/service_order.py`, dentro de `ActivityType` (após `FILE_UPLOAD`, linha 635):

```python
    FILE_UPLOAD      = "file_upload",      "Arquivo Anexado"
    FILE_DELETED     = "file_deleted",     "Arquivo Removido"
```

3b. Em `serializers/core.py`, logo após `UploadPhotoSerializer` (linha ~958):

```python
class PhotoIdsSerializer(serializers.Serializer):
    """IDs de fotos da OS para operações em lote (bulk-delete, download ZIP)."""

    photo_ids = serializers.ListField(
        child=serializers.UUIDField(), min_length=1, max_length=500
    )
```

3c. Em `serializers/__init__.py`, adicionar `PhotoIdsSerializer` ao import de `.core` e ao `__all__` (seguir o padrão dos vizinhos no arquivo).

3d. Em `views/orders.py`, adicionar `PhotoIdsSerializer` ao import de `..serializers` (bloco linha 35-65) e criar a action logo após `photo_detail` (linha ~1265):

```python
    @extend_schema(
        summary="Remover fotos da OS em lote (soft delete)",
        request=PhotoIdsSerializer,
        responses={200: OpenApiTypes.OBJECT},
    )
    @action(detail=True, methods=["post"], url_path="photos/bulk-delete")
    def photos_bulk_delete(self, request: Request, pk: Optional[str] = None) -> Response:
        """
        POST /service-orders/{id}/photos/bulk-delete/
        Soft delete em lote — s3_key preservado como evidência de sinistro.
        Requer MANAGER+ (ver get_permissions).
        """
        from ..models import OSPhotoFolder
        from ..models.service_order import ActivityType

        service_order: ServiceOrder = self.get_object()
        serializer = PhotoIdsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        photo_ids = serializer.validated_data["photo_ids"]

        photos = list(service_order.photos.filter(pk__in=photo_ids, is_active=True))
        if len(photos) != len(set(photo_ids)):
            return Response(
                {"detail": "Uma ou mais fotos não pertencem a esta OS ou já foram removidas."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service_order.photos.filter(pk__in=photo_ids).update(is_active=False)

        folder_labels = dict(OSPhotoFolder.choices)
        folders = sorted({folder_labels.get(p.folder, p.folder) for p in photos})
        ServiceOrderActivityLog.objects.create(
            service_order=service_order,
            user=request.user,
            activity_type=ActivityType.FILE_DELETED,
            description=f"{len(photos)} foto(s) removida(s) — {', '.join(folders)}",
            metadata={"count": len(photos), "photo_ids": [str(p.pk) for p in photos]},
        )
        logger.info(
            "Bulk delete de %d fotos da OS #%d por user_id=%s",
            len(photos),
            service_order.number,
            request.user.id,
        )
        return Response({"deleted": len(photos)})
```

Import necessário no topo do arquivo (junto aos imports de drf_spectacular, linha 13):

```python
from drf_spectacular.types import OpenApiTypes
```

(Se `OpenApiTypes` já estiver importado, não duplicar. Nota: o import de `ActivityType` é feito dentro da action porque `..models` pode não reexportar — verificar `models/__init__.py`; se `ActivityType` estiver lá, usar `from ..models import ActivityType, OSPhotoFolder` como a action `photos` já faz na linha 1101.)

- [ ] **Step 4: Migration do choices (sem efeito em banco)**

Run: `make dev` (se não estiver de pé) e depois:
```bash
docker compose -f infra/docker/docker-compose.dev.yml exec django python manage.py makemigrations service_orders --settings=config.settings.dev
```
(Usar o mesmo `$(COMPOSE)` do Makefile — conferir o alvo `migrate` se o caminho do compose divergir. Alternativa local: `cd backend/core && .venv/bin/python manage.py makemigrations service_orders`.)
Expected: nova migration `AlterField` em `activity_type` (choices). Rodar `make migrate` em seguida.

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend/core && .venv/bin/pytest apps/service_orders/tests/test_photos.py -v`
Expected: todos PASS (Task 1 + Task 2).

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/service_orders/
git commit -m "feat(os): bulk soft-delete de fotos com activity log único (MANAGER+)"
```

---

### Task 3: Backend — download de fotos em ZIP

**Files:**
- Modify: `backend/core/apps/service_orders/views/orders.py` (nova action após `photos_bulk_delete`)
- Test: `backend/core/apps/service_orders/tests/test_photos.py`

**Interfaces:**
- Consumes: `PhotoIdsSerializer` (Task 2), `PhotoAPITestBase` (Task 1).
- Produces: `POST /api/v1/service-orders/{id}/photos/download/` body `{"photo_ids": [uuid...]}` → `200 application/zip` (attachment `OS-{numero}-fotos.zip`, entradas `{Pasta Display}/{NNN}-{uuid8}.{ext}`) | `400 {"detail": ...}`. Permissão: `os.view` (default do ViewSet).

- [ ] **Step 1: Escrever os testes (falhando)**

Adicionar ao final de `test_photos.py`:

```python
class PhotoDownloadZipTest(PhotoAPITestBase):
    def _url(self) -> str:
        return f"/api/v1/service-orders/{self.order.id}/photos/download/"

    def _zip_from(self, resp) -> zipfile.ZipFile:
        content = b"".join(resp.streaming_content)
        return zipfile.ZipFile(io.BytesIO(content))

    def test_download_zip_agrupado_por_pasta(self) -> None:
        p1 = self.make_photo(folder="vistoria_inicial", content=b"foto-um")
        p2 = self.make_photo(folder="documentos", content=b"foto-dois")
        self.auth("CONSULTANT")  # download é leitura — qualquer role com os.view
        resp = self.client.post(
            self._url(), {"photo_ids": [str(p1.id), str(p2.id)]}, format="json"
        )
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/zip"
        assert "OS-9950-fotos.zip" in resp["Content-Disposition"]
        zf = self._zip_from(resp)
        names = sorted(zf.namelist())
        assert len(names) == 2
        assert any(n.startswith("Vistoria Inicial/") for n in names)
        assert any(n.startswith("Documentos/") for n in names)
        contents = {zf.read(n) for n in names}
        assert contents == {b"foto-um", b"foto-dois"}

    def test_foto_inativa_retorna_400(self) -> None:
        photo = self.make_photo()
        photo.is_active = False
        photo.save(update_fields=["is_active"])
        self.auth("CONSULTANT")
        resp = self.client.post(self._url(), {"photo_ids": [str(photo.id)]}, format="json")
        assert resp.status_code == 400

    def test_foto_de_outra_os_retorna_400(self) -> None:
        other_order = ServiceOrder.objects.create(
            number=9952,
            plate="FOT0C33",
            customer_name="Terceiro",
            status=ServiceOrderStatus.RECEPTION,
            created_by=self.user,
        )
        alheia = ServiceOrderPhoto.objects.create(
            service_order=other_order,
            folder="vistoria_inicial",
            s3_key="x/z.jpg",
            uploaded_by_id=self.user.id,
        )
        self.auth("CONSULTANT")
        resp = self.client.post(self._url(), {"photo_ids": [str(alheia.id)]}, format="json")
        assert resp.status_code == 400
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend/core && .venv/bin/pytest apps/service_orders/tests/test_photos.py::PhotoDownloadZipTest -v`
Expected: FALHAM com 404 (rota não existe).

- [ ] **Step 3: Implementar a action**

Em `views/orders.py`, logo após `photos_bulk_delete`:

```python
    @extend_schema(
        summary="Baixar fotos da OS em ZIP",
        request=PhotoIdsSerializer,
        responses={(200, "application/zip"): OpenApiTypes.BINARY},
    )
    @action(detail=True, methods=["post"], url_path="photos/download")
    def photos_download(self, request: Request, pk: Optional[str] = None):
        """
        POST /service-orders/{id}/photos/download/
        ZIP das fotos selecionadas, agrupadas por pasta. ZIP_STORED —
        JPEG já é comprimido, recomprimir só gasta CPU.
        """
        import tempfile
        import zipfile as _zipfile

        from django.core.files.storage import default_storage
        from django.http import FileResponse

        from ..models import OSPhotoFolder

        service_order: ServiceOrder = self.get_object()
        serializer = PhotoIdsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        photo_ids = serializer.validated_data["photo_ids"]

        photos = list(
            service_order.photos.filter(pk__in=photo_ids, is_active=True).order_by("uploaded_at")
        )
        if len(photos) != len(set(photo_ids)):
            return Response(
                {"detail": "Uma ou mais fotos não pertencem a esta OS ou estão inativas."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        folder_labels = dict(OSPhotoFolder.choices)
        # ponytail: SpooledTemporaryFile derrama pro disco acima de 50MB —
        # streaming zip de verdade só se OS com centenas de fotos virar dor.
        tmp = tempfile.SpooledTemporaryFile(max_size=50 * 1024 * 1024)
        with _zipfile.ZipFile(tmp, "w", _zipfile.ZIP_STORED) as zf:
            for i, photo in enumerate(photos, start=1):
                ext = photo.s3_key.rsplit(".", 1)[-1].lower() if "." in photo.s3_key else "jpg"
                folder = folder_labels.get(photo.folder, photo.folder)
                try:
                    with default_storage.open(photo.s3_key) as f:
                        zf.writestr(f"{folder}/{i:03d}-{str(photo.pk)[:8]}.{ext}", f.read())
                except FileNotFoundError:
                    logger.warning(
                        "Arquivo %s ausente no storage (OS #%d) — pulado no ZIP",
                        photo.s3_key,
                        service_order.number,
                    )
        tmp.seek(0)
        logger.info(
            "Download ZIP de %d fotos da OS #%d por user_id=%s",
            len(photos),
            service_order.number,
            request.user.id,
        )
        return FileResponse(
            tmp,
            as_attachment=True,
            filename=f"OS-{service_order.number}-fotos.zip",
            content_type="application/zip",
        )
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend/core && .venv/bin/pytest apps/service_orders/tests/test_photos.py -v`
Expected: todos PASS.

- [ ] **Step 5: Conferir o schema OpenAPI (0 warnings)**

```bash
docker compose -f infra/docker/docker-compose.dev.yml exec -T django python manage.py spectacular --format openapi-json --settings=config.settings.dev > /dev/null
```
Expected: sem warnings novos no stderr. (Se o container não estiver de pé, `make dev` antes; conferir alvo no Makefile.)

- [ ] **Step 6: Commit**

```bash
git add backend/core/apps/service_orders/
git commit -m "feat(os): download de fotos selecionadas em ZIP agrupado por pasta"
```

---

### Task 4: Types — `slot`/`checklist_type`, `file_deleted` e api.d.ts

**Files:**
- Modify: `packages/types/src/service-order.types.ts:109-121` (`ServiceOrderPhoto`) e `:60` (union de activity types)
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/_utils/activity-config.tsx:94-99`
- Modify (gerado): `apps/dscar-web/src/types/api.d.ts` via `make gen-api-types`

**Interfaces:**
- Produces: `ServiceOrderPhoto` com `slot: string` e `checklist_type: string`; activity type `"file_deleted"` renderizável no histórico.

- [ ] **Step 1: Atualizar @paddock/types**

Em `packages/types/src/service-order.types.ts`, interface `ServiceOrderPhoto` (linha 109):

```typescript
export interface ServiceOrderPhoto {
  id: string;
  /** Pasta onde a foto está organizada */
  folder: OSPhotoFolder;
  /** Valor original do campo stage (legado) */
  original_stage: string;
  /** Legenda opcional da foto */
  caption: string;
  /** Posição/ângulo (ex: "frente", "lateral_esq") — usado pelo checklist */
  slot: string;
  /** entrada | saida | acompanhamento */
  checklist_type: string;
  s3_key: string;
  url: string | null;
  uploaded_at: string;
  is_active: boolean;
}
```

Na union de activity types (linha ~60, onde está `| "file_upload"`), adicionar logo abaixo:

```typescript
  | "file_upload"
  | "file_deleted"
```

- [ ] **Step 2: Entrada no activity-config**

Em `apps/dscar-web/src/app/(app)/os/[numero]/_utils/activity-config.tsx`, após o bloco `file_upload` (linha 94-99):

```tsx
  file_deleted: {
    icon: <Trash2 className="h-4 w-4 text-error-400" />,
    ringClass: "ring-error-500/20",
    bgClass: "bg-error-500/10",
    label: "Foto removida",
  },
```

Adicionar `Trash2` ao import de `lucide-react` no topo do arquivo, se ausente.

- [ ] **Step 3: Regenerar api.d.ts**

Run: `make gen-api-types` (requer docker dev de pé).
Expected: `api.d.ts` atualizado com `file_deleted` no `ActivityTypeEnum` e os novos endpoints. NUNCA editar `api.d.ts` à mão. Se o docker não estiver disponível nesta máquina, pular e anotar no commit que o regen fica pro próximo `make dev`.

- [ ] **Step 4: Typecheck**

Run: `cd apps/dscar-web && npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 5: Commit**

```bash
git add packages/types/ apps/dscar-web/src/app/\(app\)/os/\[numero\]/_utils/activity-config.tsx apps/dscar-web/src/types/api.d.ts
git commit -m "chore(types): slot/checklist_type em ServiceOrderPhoto + activity file_deleted"
```

---

### Task 5: Frontend — hook `useUploadQueue` (fila com concorrência 2)

**Files:**
- Create: `apps/dscar-web/src/app/(app)/os/[numero]/_hooks/useUploadQueue.ts`
- Test: `apps/dscar-web/src/app/(app)/os/[numero]/_hooks/useUploadQueue.test.ts`

**Interfaces:**
- Consumes: `apiFetch` de `@/lib/api` (offline: já enfileira no Dexie e resolve com `{_offline: true}` — item vira `done`).
- Produces (usado nas Tasks 6 e 7):

```typescript
export type UploadItemStatus = "pending" | "uploading" | "done" | "error"
export interface UploadQueueItem {
  id: string
  fileName: string
  previewUrl: string | null
  status: UploadItemStatus
  error: string | null
}
export function validatePhotoFile(file: File, folder: OSPhotoFolder): string | null
export function useUploadQueue(orderId: string, folder: OSPhotoFolder): {
  items: UploadQueueItem[]
  enqueue: (files: File[], caption?: string) => void
  retry: (id: string) => void
  reset: () => void
  isUploading: boolean   // há pending ou uploading
  doneCount: number
}
```

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `useUploadQueue.test.ts` (espelhar o setup de wrapper com `QueryClientProvider` de `apps/dscar-web/src/lib/crud-mutations.test.ts` — copiar o helper de wrapper de lá):

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React from "react"
import { useUploadQueue, validatePhotoFile } from "./useUploadQueue"

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }))
import { apiFetch } from "@/lib/api"
const apiFetchMock = vi.mocked(apiFetch)

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

function makeFile(name = "a.jpg", type = "image/jpeg", size = 1024): File {
  const file = new File([new Uint8Array(8)], name, { type })
  Object.defineProperty(file, "size", { value: size })
  return file
}

describe("validatePhotoFile", () => {
  it("aceita jpeg até 10MB", () => {
    expect(validatePhotoFile(makeFile(), "vistoria_inicial")).toBeNull()
  })
  it("recusa imagem acima de 10MB", () => {
    const big = makeFile("big.jpg", "image/jpeg", 11 * 1024 * 1024)
    expect(validatePhotoFile(big, "vistoria_inicial")).toMatch(/10MB/)
  })
  it("recusa tipo não suportado", () => {
    expect(validatePhotoFile(makeFile("a.gif", "image/gif"), "vistoria_inicial")).toMatch(/não suportado/)
  })
  it("aceita PDF até 20MB apenas em orcamentos", () => {
    const pdf = makeFile("orc.pdf", "application/pdf", 15 * 1024 * 1024)
    expect(validatePhotoFile(pdf, "orcamentos")).toBeNull()
    expect(validatePhotoFile(pdf, "vistoria_inicial")).toMatch(/não suportado/)
  })
})

describe("useUploadQueue", () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  it("limita a 2 uploads simultâneos", async () => {
    const resolvers: Array<() => void> = []
    apiFetchMock.mockImplementation(
      () => new Promise((resolve) => resolvers.push(() => resolve({})))
    )
    const { result } = renderHook(() => useUploadQueue("os-1", "vistoria_inicial"), { wrapper })
    act(() => result.current.enqueue([makeFile("1.jpg"), makeFile("2.jpg"), makeFile("3.jpg")]))

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2))
    expect(result.current.items.filter((i) => i.status === "uploading")).toHaveLength(2)
    expect(result.current.items.filter((i) => i.status === "pending")).toHaveLength(1)

    act(() => resolvers[0]())
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(3))
    act(() => { resolvers[1](); resolvers[2]() })
    await waitFor(() => expect(result.current.doneCount).toBe(3))
    expect(result.current.isUploading).toBe(false)
  })

  it("arquivo inválido vira error sem request", async () => {
    const { result } = renderHook(() => useUploadQueue("os-1", "vistoria_inicial"), { wrapper })
    act(() => result.current.enqueue([makeFile("a.gif", "image/gif")]))
    expect(result.current.items[0].status).toBe("error")
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it("retry reenvia item com erro", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("HTTP 500")).mockResolvedValueOnce({})
    const { result } = renderHook(() => useUploadQueue("os-1", "vistoria_inicial"), { wrapper })
    act(() => result.current.enqueue([makeFile()]))
    await waitFor(() => expect(result.current.items[0].status).toBe("error"))
    act(() => result.current.retry(result.current.items[0].id))
    await waitFor(() => expect(result.current.items[0].status).toBe("done"))
    expect(apiFetchMock).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/dscar-web && npx vitest run "src/app/(app)/os/[numero]/_hooks/useUploadQueue.test.ts"`
Expected: FALHA — módulo `./useUploadQueue` não existe.

- [ ] **Step 3: Implementar o hook**

Criar `apps/dscar-web/src/app/(app)/os/[numero]/_hooks/useUploadQueue.ts`:

```typescript
"use client"

import { useCallback, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { OSPhotoFolder } from "@paddock/types"
import { apiFetch } from "@/lib/api"

const API = "/api/proxy"
const CONCURRENCY = 2
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_PDF_BYTES = 20 * 1024 * 1024
// Espelha a validação do backend (views/orders.py photos POST)
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
])

export type UploadItemStatus = "pending" | "uploading" | "done" | "error"

export interface UploadQueueItem {
  id: string
  fileName: string
  previewUrl: string | null
  status: UploadItemStatus
  error: string | null
}

/** null = válido; string = motivo da recusa. Espelha o backend. */
export function validatePhotoFile(file: File, folder: OSPhotoFolder): string | null {
  if (folder === "orcamentos" && file.type === "application/pdf") {
    return file.size > MAX_PDF_BYTES ? "PDF excede 20MB." : null
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return `Tipo não suportado: ${file.type || "desconhecido"}.`
  }
  if (file.size > MAX_IMAGE_BYTES) return "Arquivo excede 10MB."
  return null
}

export function useUploadQueue(orderId: string, folder: OSPhotoFolder) {
  const qc = useQueryClient()
  const [items, setItems] = useState<UploadQueueItem[]>([])
  const filesRef = useRef(new Map<string, { file: File; caption: string }>())
  const queueRef = useRef<string[]>([])
  const activeRef = useRef(0)

  const patch = useCallback((id: string, p: Partial<UploadQueueItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)))
  }, [])

  const pump = useCallback((): void => {
    while (activeRef.current < CONCURRENCY && queueRef.current.length > 0) {
      const id = queueRef.current.shift()
      if (!id) continue
      const entry = filesRef.current.get(id)
      if (!entry) continue
      activeRef.current += 1
      patch(id, { status: "uploading", error: null })
      const fd = new FormData()
      fd.append("file", entry.file)
      fd.append("folder", folder)
      if (entry.caption) fd.append("caption", entry.caption)
      void apiFetch(`${API}/service-orders/${orderId}/photos/`, { method: "POST", body: fd })
        .then(() => patch(id, { status: "done" }))
        .catch((e: unknown) =>
          patch(id, {
            status: "error",
            error: e instanceof Error ? e.message : "Falha no envio.",
          })
        )
        .finally(() => {
          activeRef.current -= 1
          pump()
          if (activeRef.current === 0 && queueRef.current.length === 0) {
            void qc.invalidateQueries({ queryKey: ["os-photos", orderId] })
            void qc.invalidateQueries({ queryKey: ["service-orders", orderId] })
          }
        })
    }
  }, [folder, orderId, patch, qc])

  const enqueue = useCallback(
    (files: File[], caption = ""): void => {
      const newItems: UploadQueueItem[] = files.map((file) => {
        const id = crypto.randomUUID()
        const invalid = validatePhotoFile(file, folder)
        if (!invalid) {
          filesRef.current.set(id, { file, caption })
          queueRef.current.push(id)
        }
        return {
          id,
          fileName: file.name,
          previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
          status: invalid ? "error" : "pending",
          error: invalid,
        }
      })
      setItems((prev) => [...prev, ...newItems])
      pump()
    },
    [folder, pump]
  )

  const retry = useCallback(
    (id: string): void => {
      if (!filesRef.current.has(id)) return // inválido na validação — não reenviável
      patch(id, { status: "pending", error: null })
      queueRef.current.push(id)
      pump()
    },
    [patch, pump]
  )

  const reset = useCallback((): void => {
    setItems((prev) => {
      prev.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl))
      return []
    })
    filesRef.current.clear()
    queueRef.current = []
  }, [])

  const isUploading = items.some((it) => it.status === "uploading" || it.status === "pending")
  const doneCount = items.filter((it) => it.status === "done").length

  return { items, enqueue, retry, reset, isUploading, doneCount }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/dscar-web && npx vitest run "src/app/(app)/os/[numero]/_hooks/useUploadQueue.test.ts"`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/dscar-web/src/app/(app)/os/[numero]/_hooks/useUploadQueue.ts" "apps/dscar-web/src/app/(app)/os/[numero]/_hooks/useUploadQueue.test.ts"
git commit -m "feat(dscar): fila de upload de fotos com concorrência 2, retry e validação"
```

---

### Task 6: Frontend — UploadDialog com múltiplos arquivos e fila visível

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/FilesTab.tsx:28-161` (componente `UploadDialog`)

**Interfaces:**
- Consumes: `useUploadQueue` (Task 5), `CameraCapture` (assinatura atual; a Task 7 mantém a prop `onCapture(file)` compatível).
- Produces: `UploadDialog` com as mesmas props (`orderId`, `folder`, `onClose`) — nada muda para o `FolderSection`.

- [ ] **Step 1: Reescrever o UploadDialog**

Substituir o componente `UploadDialog` inteiro (linhas 36-161) por:

```tsx
function UploadDialog({ orderId, folder, onClose }: UploadDialogProps) {
  const folderCfg = OS_PHOTO_FOLDERS[folder]
  const { items, enqueue, retry, reset, isUploading, doneCount } = useUploadQueue(orderId, folder)
  const [caption, setCaption] = useState("")
  const [cameraOpen, setCameraOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) enqueue(files, caption)
    e.target.value = "" // permite re-selecionar os mesmos arquivos
  }

  function handleClose() {
    if (isUploading) return
    reset()
    onClose()
  }

  const acceptTypes = folder === "orcamentos" ? "image/*,application/pdf" : "image/*"

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className={cn("px-4 py-3 border-b", folderCfg.bgColor, folderCfg.borderColor)}>
          <div className="flex items-center gap-2">
            <Camera className={cn("h-4 w-4", folderCfg.color)} />
            <DialogTitle className={cn("text-sm", folderCfg.color)}>
              Adicionar fotos — {folderCfg.label}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors hover:opacity-80",
                folderCfg.borderColor,
                folderCfg.bgColor,
              )}
            >
              <Upload className={cn("h-6 w-6", folderCfg.color)} />
              <span className={cn("text-sm font-medium", folderCfg.color)}>Arquivos</span>
              <span className="text-xs text-muted-foreground">seleção múltipla</span>
            </button>
            <button
              onClick={() => setCameraOpen(true)}
              className={cn(
                "h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-colors hover:opacity-80",
                folderCfg.borderColor,
                folderCfg.bgColor,
              )}
            >
              <Camera className={cn("h-6 w-6", folderCfg.color)} />
              <span className={cn("text-sm font-medium", folderCfg.color)}>Câmera</span>
              <span className="text-xs text-muted-foreground">com marca d&apos;água</span>
            </button>
          </div>

          <Input
            placeholder="Legenda opcional (aplicada às próximas fotos)..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
          />

          {items.length > 0 && (
            <ul className="max-h-52 space-y-1.5 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5"
                >
                  {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                  ) : (
                    <Images className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-foreground/80">{item.fileName}</p>
                    {item.error && <p className="truncate text-xs text-error-400">{item.error}</p>}
                  </div>
                  {item.status === "uploading" && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  )}
                  {item.status === "pending" && (
                    <span className="shrink-0 text-xs text-muted-foreground">na fila</span>
                  )}
                  {item.status === "done" && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success-400" />
                  )}
                  {item.status === "error" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 shrink-0 px-1.5 text-xs"
                      onClick={() => retry(item.id)}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Reenviar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <CameraCapture
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onCapture={(file) => enqueue([file], caption)}
            watermarkLines={[`Pasta: ${folderCfg.label}`]}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept={acceptTypes}
            multiple
            className="hidden"
            onChange={handleFilesChange}
          />
        </div>

        <DialogFooter className="px-4 pb-4">
          {items.length > 0 && (
            <span className="mr-auto self-center text-xs text-muted-foreground">
              {doneCount}/{items.length} enviada{items.length !== 1 ? "s" : ""}
            </span>
          )}
          <Button onClick={handleClose} disabled={isUploading}>
            {isUploading ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enviando...</>
            ) : (
              "Concluir"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Ajustar imports do arquivo: adicionar `CheckCircle2` e `RefreshCw` ao import de `lucide-react` (linha 4); adicionar `import { useUploadQueue } from "../../_hooks/useUploadQueue"`; `useUploadPhoto` deixa de ser usado pelo dialog — remover do import da linha 19 se nenhum outro uso restar no arquivo.

- [ ] **Step 2: Typecheck + lint**

Run: `cd apps/dscar-web && npx tsc --noEmit && npx eslint "src/app/(app)/os/[numero]/_components/tabs/FilesTab.tsx"`
Expected: 0 erros.

- [ ] **Step 3: Verificação rápida no browser**

Com `make dev` + `pnpm dev` de pé: abrir uma OS → aba de arquivos → "+Foto" → selecionar 3+ imagens de uma vez. Expected: itens aparecem na lista, no máximo 2 spinners simultâneos, todos terminam com check verde, galeria atualiza ao concluir. Selecionar um `.gif` → aparece como erro sem request (conferir na aba Network).

- [ ] **Step 4: Commit**

```bash
git add "apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/FilesTab.tsx"
git commit -m "feat(dscar): upload múltiplo de fotos com fila visível no UploadDialog"
```

---

### Task 7: Frontend — CameraCapture: layout corrigido + captura sequencial

**Files:**
- Modify: `apps/dscar-web/src/components/camera/CameraCapture.tsx` (reescrita do componente; `drawWatermark` fica como está)

**Interfaces:**
- Consumes: nada novo.
- Produces: mesmas props (`open`, `onClose`, `onCapture`, `watermarkLines`) — mas `onCapture` agora é chamado A CADA foto (a câmera não fecha); quem fecha é o usuário no botão "Concluir". Único consumidor é o `UploadDialog` (Task 6), que já enfileira cada `onCapture`.

- [ ] **Step 1: Reproduzir o bug (systematic debugging — antes de mexer)**

Com o dev server de pé, abrir a câmera na aba de arquivos em uma janela desktop baixa (~600px de altura) e/ou celular. Confirmar o sintoma: o rodapé com o botão "Capturar" fica fora da viewport — o `DialogContent` do shadcn centraliza com `top-50% -translate-y-50%` sem limite de altura, e o vídeo com `max-h-[60vh]` + header + footer estoura a tela (60vh é do layout viewport; no celular a barra do browser come o resto). Anotar o que foi observado. Se a causa observada for outra, corrigir a causa real e adaptar o Step 2 (o redesenho abaixo resolve o caso de altura por construção).

- [ ] **Step 2: Reescrever o componente**

Substituir o componente `CameraCapture` (mantendo `drawWatermark` e a interface de props, atualizando o doc-comment):

```tsx
export function CameraCapture({ open, onClose, onCapture, watermarkLines = [] }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [lastThumb, setLastThumb] = useState<string | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (!open) {
      stopStream()
      setError(null)
      setCount(0)
      setLastThumb((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setError("Não foi possível acessar a câmera. Verifique as permissões."))
    return () => {
      cancelled = true
      stopStream()
    }
  }, [open, stopStream])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    drawWatermark(canvas, watermarkLines)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onCapture(new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }))
        setCount((c) => c + 1)
        setLastThumb((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
      },
      "image/jpeg",
      0.88,
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      {/* flex-col + max-h em dvh: controles NUNCA saem da viewport (bug do
          botão de captura invisível em telas baixas/celular) */}
      <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Camera className="h-4 w-4" />
            Capturar fotos
            {count > 0 && (
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {count} foto{count !== 1 ? "s" : ""}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
          {error ? (
            <p className="p-6 text-center text-sm text-error-400">{error}</p>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full max-h-[60dvh] w-full object-contain"
            />
          )}
          {lastThumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lastThumb}
              alt="Última foto"
              className="absolute bottom-2 left-2 h-14 w-14 rounded-md border-2 border-white/70 object-cover shadow-lg"
            />
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 p-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            {count > 0 ? "Concluir" : "Cancelar"}
          </Button>
          <button
            type="button"
            onClick={capture}
            disabled={!!error}
            aria-label="Tirar foto"
            className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-border bg-primary text-primary-foreground shadow-lg transition-transform active:scale-90 disabled:opacity-40"
          >
            <Camera className="h-6 w-6" />
          </button>
          <div className="w-20" aria-hidden />{/* balanceia o layout — botão central */}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

Atualizar o doc-comment do topo do arquivo: fluxo agora é sequencial (cada captura chama `onCapture` e a câmera segue aberta; sem preview/confirmação). Remover imports não usados (`RefreshCw`) e os estados antigos `preview`/`previewBlob`/`retake`.

- [ ] **Step 3: Typecheck + lint**

Run: `cd apps/dscar-web && npx tsc --noEmit && npx eslint src/components/camera/CameraCapture.tsx`
Expected: 0 erros.

- [ ] **Step 4: Verificar no browser (desktop + mobile)**

Desktop (janela ~600px de altura): abrir câmera → botão redondo de captura SEMPRE visível; tirar 3 fotos seguidas → contador "3 fotos", miniatura atualiza, itens aparecem na fila do dialog ao concluir. Mobile (celular real via HTTPS ou devtools device mode): mesmo fluxo; conferir marca d'água (data/hora + "Pasta: ...") nas fotos enviadas abrindo-as na galeria. `getUserMedia` exige HTTPS fora de localhost — testar no celular via URL de staging/produção ou túnel HTTPS.

- [ ] **Step 5: Commit**

```bash
git add apps/dscar-web/src/components/camera/CameraCapture.tsx
git commit -m "fix(dscar): botão de captura sempre visível + câmera sequencial com contador"
```

---

### Task 8: Frontend — modo seleção: baixar ZIP e excluir em massa

**Files:**
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/_hooks/useOSItems.ts` (2 hooks novos após `useSoftDeletePhoto`, linha ~221)
- Modify: `apps/dscar-web/src/app/(app)/os/[numero]/_components/tabs/FilesTab.tsx` (`PhotoThumb`, `FolderSection`, `FilesTab`)

**Interfaces:**
- Consumes: endpoints das Tasks 2 e 3; `usePermission("MANAGER")` de `@/hooks/usePermission`; `ConfirmDialog` de `@/components/ui/ConfirmDialog`.
- Produces:

```typescript
export function useBulkDeletePhotos(orderId: string): UseMutationResult<{ deleted: number }, Error, string[]>
export function useDownloadPhotosZip(orderId: string, orderNumber: number): {
  download: (photoIds: string[]) => Promise<void>
  downloading: boolean
}
```

- [ ] **Step 1: Hooks de bulk delete e download**

Em `useOSItems.ts`, após `useSoftDeletePhoto` (linha ~221):

```typescript
export function useBulkDeletePhotos(orderId: string) {
  const qc = useQueryClient()
  return useMutation<{ deleted: number }, Error, string[]>({
    mutationFn: (photoIds) =>
      apiFetch<{ deleted: number }>(`${API}/service-orders/${orderId}/photos/bulk-delete/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_ids: photoIds }),
        offline: false,
      }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["os-photos", orderId] })
      toast.success(`${data.deleted} foto${data.deleted !== 1 ? "s" : ""} removida${data.deleted !== 1 ? "s" : ""}.`)
    },
    onError: () => {
      toast.error("Erro ao remover fotos.")
    },
  })
}

export function useDownloadPhotosZip(orderId: string, orderNumber: number) {
  const [downloading, setDownloading] = useState(false)

  async function download(photoIds: string[]): Promise<void> {
    setDownloading(true)
    try {
      // fetch direto (não apiFetch): resposta é binária, não JSON
      const res = await fetch(`${API}/service-orders/${orderId}/photos/download/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_ids: photoIds }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `OS-${orderNumber}-fotos.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      toast.error("Erro ao baixar fotos.")
    } finally {
      setDownloading(false)
    }
  }

  return { download, downloading }
}
```

Adicionar `import { useState } from "react"` no topo de `useOSItems.ts` se ausente.

- [ ] **Step 2: Modo seleção na FilesTab**

Em `FilesTab.tsx`:

2a. Imports: adicionar `CheckSquare`, `Square`, `CheckCircle2` (se já não veio da Task 6) ao import de `lucide-react`; `import { usePermission } from "@/hooks/usePermission"`; `import { ConfirmDialog } from "@/components/ui/ConfirmDialog"`; adicionar `useBulkDeletePhotos, useDownloadPhotosZip` ao import de `../../_hooks/useOSItems`.

2b. `PhotoThumbProps` ganha seleção; substituir o componente `PhotoThumb`:

```tsx
interface PhotoThumbProps {
  photo: ServiceOrderPhoto
  orderId: string
  canDelete: boolean
  onOpen: () => void
  selectionMode: boolean
  selected: boolean
  onToggleSelect: () => void
}

function PhotoThumb({
  photo, orderId, canDelete, onOpen, selectionMode, selected, onToggleSelect,
}: PhotoThumbProps) {
  const deleteMutation = useSoftDeletePhoto(orderId)
  const [showDelete, setShowDelete] = useState(false)

  if (!photo.url) return null

  return (
    <div
      className={cn(
        "group relative rounded-lg overflow-hidden border aspect-square bg-muted/30",
        selected ? "border-primary ring-2 ring-primary/50" : "border-border",
      )}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <button
        type="button"
        onClick={selectionMode ? onToggleSelect : onOpen}
        className={cn("block h-full w-full", selectionMode ? "cursor-pointer" : "cursor-zoom-in")}
        aria-label={
          selectionMode
            ? (selected ? "Desmarcar foto" : "Selecionar foto")
            : (photo.caption ? `Ampliar: ${photo.caption}` : "Ampliar foto")
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption || "Foto OS"}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
      </button>
      {selectionMode && (
        <span className="pointer-events-none absolute top-1.5 left-1.5 rounded bg-background/80 p-0.5 shadow">
          {selected
            ? <CheckSquare className="h-4 w-4 text-primary" />
            : <Square className="h-4 w-4 text-foreground/50" />}
        </span>
      )}
      {photo.caption && (
        <div className="pointer-events-none absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1">
          <p className="text-xs text-white truncate">{photo.caption}</p>
        </div>
      )}
      {canDelete && showDelete && !selectionMode && (
        <button
          onClick={() => deleteMutation.mutate(photo.id)}
          className="absolute top-1.5 right-1.5 bg-background/80 hover:bg-error-500/20 rounded-full p-1 shadow transition-colors"
          aria-label="Remover foto"
        >
          {deleteMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <Trash2 className="h-3 w-3 text-error-400" />
          )}
        </button>
      )}
    </div>
  )
}
```

2c. `FolderSection` repassa a seleção. Adicionar às props:

```tsx
interface FolderSectionProps {
  folder: OSPhotoFolder
  photos: ServiceOrderPhoto[]
  orderId: string
  isOpen: boolean
  onToggle: () => void
  canUpload: boolean
  canDelete: boolean
  selectionMode: boolean
  selectedIds: Set<string>
  onToggleSelect: (photoId: string) => void
  onSelectFolder: (photoIds: string[]) => void
}
```

No header da pasta (dentro do `div` de ações, antes do botão "+Foto"), quando `selectionMode && count > 0`:

```tsx
          {selectionMode && count > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelectFolder(photos.map((p) => p.id)) }}
              className="text-xs font-semibold px-2 py-1 rounded-md bg-background/70 hover:bg-muted/60 border border-border"
            >
              Selecionar todas
            </button>
          )}
```

No grid, repassar para cada `PhotoThumb`:

```tsx
                <PhotoThumb
                  key={photo.id}
                  photo={photo}
                  orderId={orderId}
                  canDelete={canDelete}
                  onOpen={() => setLightboxIndex(i)}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(photo.id)}
                  onToggleSelect={() => onToggleSelect(photo.id)}
                />
```

E esconder o tile "+Foto" do grid quando `selectionMode` (`{canUpload && !selectionMode && (...)}`).

2d. `FilesTab` — estado de seleção + barra de ações. Substituir o corpo do componente principal:

```tsx
export function FilesTab({ order }: FilesTabProps) {
  const { data: photos = [], isLoading } = useOSPhotos(order.id)
  const isManager = usePermission("MANAGER")
  const bulkDelete = useBulkDeletePhotos(order.id)
  const { download, downloading } = useDownloadPhotosZip(order.id, order.number)

  const [openFolders, setOpenFolders] = useState<Set<OSPhotoFolder>>(
    () => new Set<OSPhotoFolder>(["vistoria_inicial"])
  )
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)

  function toggleFolder(folder: OSPhotoFolder) {
    setOpenFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folder)) next.delete(folder)
      else next.add(folder)
      return next
    })
  }

  function toggleSelect(photoId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }

  function selectFolder(photoIds: string[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allSelected = photoIds.every((id) => next.has(id))
      photoIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)))
      return next
    })
  }

  function exitSelection() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  async function handleBulkDelete() {
    try {
      await bulkDelete.mutateAsync(Array.from(selectedIds))
      exitSelection()
    } catch {
      // toast já exibido no onError do hook
    }
  }

  const canUpload = !["delivered", "cancelled"].includes(order.status)
  const canDelete = canUpload && isManager

  const photosByFolder = OS_PHOTO_FOLDER_ORDER.reduce<Record<string, ServiceOrderPhoto[]>>(
    (acc, f) => {
      acc[f] = photos.filter((p: ServiceOrderPhoto) => p.folder === f && p.is_active)
      return acc
    },
    {}
  )

  const totalPhotos = photos.filter((p: ServiceOrderPhoto) => p.is_active).length
  const foldersWithPhotos = OS_PHOTO_FOLDER_ORDER.filter(
    (f) => (photosByFolder[f]?.length ?? 0) > 0
  ).length
  const selectedCount = selectedIds.size

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-2.5 border border-border">
        <div className="flex items-center gap-2 text-sm text-foreground/60">
          <Images className="h-4 w-4 text-muted-foreground" />
          <span>
            <strong className="text-foreground/90">{totalPhotos}</strong>{" "}
            foto{totalPhotos !== 1 ? "s" : ""} em{" "}
            <strong className="text-foreground/90">{foldersWithPhotos}</strong>{" "}
            pasta{foldersWithPhotos !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex gap-1">
          {totalPhotos > 0 && (
            <Button
              variant={selectionMode ? "secondary" : "ghost"}
              size="sm"
              className="text-xs h-7"
              onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
            >
              <CheckSquare className="mr-1 h-3.5 w-3.5" />
              {selectionMode ? "Cancelar seleção" : "Selecionar"}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => setOpenFolders(new Set(OS_PHOTO_FOLDER_ORDER))}
          >
            Expandir tudo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => setOpenFolders(new Set())}
          >
            Recolher tudo
          </Button>
        </div>
      </div>

      {/* Folder sections */}
      <div className="space-y-2">
        {OS_PHOTO_FOLDER_ORDER.map((folder) => (
          <FolderSection
            key={folder}
            folder={folder}
            photos={photosByFolder[folder] ?? []}
            orderId={order.id}
            isOpen={openFolders.has(folder)}
            onToggle={() => toggleFolder(folder)}
            canUpload={canUpload && !selectionMode}
            canDelete={canDelete}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectFolder={selectFolder}
          />
        ))}
      </div>

      {/* Barra de ações da seleção */}
      {selectionMode && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-2 rounded-xl border border-border bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur">
          <span className="text-sm text-foreground/70">
            <strong className="text-foreground/90">{selectedCount}</strong> selecionada
            {selectedCount !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={selectedCount === 0 || downloading}
              onClick={() => void download(Array.from(selectedIds))}
            >
              {downloading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              Baixar ({selectedCount})
            </Button>
            {canDelete && (
              <Button
                size="sm"
                variant="destructive"
                disabled={selectedCount === 0 || bulkDelete.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                {bulkDelete.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                Excluir ({selectedCount})
              </Button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Remover ${selectedCount} foto${selectedCount !== 1 ? "s" : ""}?`}
        description="As fotos saem da galeria, mas permanecem arquivadas como evidência (não são apagadas do storage)."
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={() => void handleBulkDelete()}
      />
    </div>
  )
}
```

Nota: `PhotoThumb` dentro do `FolderSection` recebe `canDelete` (novo) em vez de `canUpload` para o hover-delete — o delete individual agora também respeita MANAGER+ na UI (o backend já bloqueia pela Task 1).

- [ ] **Step 3: Typecheck + lint + testes**

Run: `cd apps/dscar-web && npx tsc --noEmit && npx eslint "src/app/(app)/os/[numero]/" && npx vitest run`
Expected: 0 erros, suíte vitest verde.

- [ ] **Step 4: Verificação no browser**

Como ADMIN: "Selecionar" → marcar 3 fotos de 2 pastas → "Baixar (3)" baixa `OS-{n}-fotos.zip` com 2 pastas dentro; "Excluir (3)" pede confirmação e some com as fotos da galeria. Como CONSULTANT (logar com user consultor): botão "Excluir" NÃO aparece; "Baixar" funciona; hover em thumbnail não mostra lixeira.

- [ ] **Step 5: Commit**

```bash
git add "apps/dscar-web/src/app/(app)/os/[numero]/"
git commit -m "feat(dscar): seleção múltipla de fotos com download ZIP e exclusão em massa"
```

---

### Task 9: Verificação final

**Files:** nenhum novo (correções pontuais se algo falhar).

- [ ] **Step 1: Suítes completas**

```bash
cd backend/core && .venv/bin/pytest apps/service_orders/ --tb=short -q
cd apps/dscar-web && npx vitest run && npx tsc --noEmit
```
Expected: tudo verde.

- [ ] **Step 2: Build do frontend**

Run: `cd apps/dscar-web && npm run build` (lembrar: PWA exige webpack — o script de build do app já cuida disso).
Expected: build OK.

- [ ] **Step 3: Verify manual de ponta a ponta (usar a skill `verify` se disponível)**

Roteiro: abrir OS → aba arquivos → (1) upload de 5 imagens de uma vez com fila e retry forçado (derrubar rede no meio pra ver o item cair na fila offline com toast); (2) câmera desktop: 3 fotos sequenciais com marca d'água; (3) celular real (HTTPS): câmera abre, botão de captura visível, fotos com marca d'água; (4) seleção → baixar ZIP no celular; (5) exclusão em massa como ADMIN e ausência do botão como CONSULTANT.

- [ ] **Step 4: Commit final (se houve ajustes) e push**

```bash
git push origin main
```
(Deploy: push em main → staging automático, conforme convenção do repo.)
