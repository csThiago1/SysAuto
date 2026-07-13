# Galeria de Fotos da OS — Seleção múltipla, upload em fila e câmera sequencial

**Data:** 2026-07-13
**Status:** Aprovado
**Escopo:** PWA (apps/dscar-web) + backend (backend/core/apps/service_orders). Mobile RN não é tocado.

## Contexto

A aba de arquivos da OS (`FilesTab.tsx`) já tem galeria por pastas, lightbox, upload de 1 foto
por vez, câmera com marca d'água (`CameraCapture.tsx`) e soft delete individual. Fila offline
Dexie já aceita POSTs de fotos (`src/lib/offline/queue.ts`).

Problemas a resolver:

1. Não há seleção múltipla — nem para baixar, nem para excluir.
2. Upload aceita apenas 1 arquivo por vez, sem fila nem progresso.
3. Câmera abre mas o botão de captura não aparece (mobile e desktop) — bug de layout.
4. Exclusão hoje é permitida a qualquer usuário com permissão de escrita.

## Decisões

| Decisão | Valor |
|---|---|
| Quem exclui fotos | MANAGER ou acima (individual e em massa) |
| Quem baixa fotos | Qualquer role com `os.view` |
| Exclusão | Soft delete (`is_active=False`) — fotos são evidência de sinistro, S3 key preservado |
| Download múltiplo | ZIP gerado no servidor (stdlib `zipfile`, sem dependência nova) |
| Fluxo da câmera | Sequencial: foto → fila de upload → câmera continua aberta |
| Fila de upload | Em memória no componente, concorrência 2; offline cai na fila Dexie existente |

## 1. Backend

### 1.1 Endpoint de download em ZIP

`POST /api/v1/service-orders/{id}/photos/download/`

- Body: `{"photo_ids": ["uuid", ...]}`.
- Valida que todas as fotos pertencem à OS e estão ativas; ids desconhecidos → 400.
- Resposta: `application/zip` em streaming, `Content-Disposition: attachment;
  filename="OS-{numero}-fotos.zip"`.
- Estrutura interna do zip: `{pasta_display}/{n}-{caption-ou-uuid}.{ext}` (fotos agrupadas
  por pasta).
- Lê os arquivos do storage (`default_storage.open(s3_key)`).
- Permissão: leitura (`os.view`), mesma da listagem.

### 1.2 Endpoint de exclusão em massa

`POST /api/v1/service-orders/{id}/photos/bulk-delete/`

- Body: `{"photo_ids": ["uuid", ...]}`.
- Soft delete em lote (`update(is_active=False)`); só fotos da própria OS.
- Um único registro no `ServiceOrderActivityLog`: "N fotos removidas" (com pastas envolvidas).
- Permissão: MANAGER+.
- Resposta: `{"deleted": N}`.

### 1.3 Endurecer o delete individual

`DELETE /photos/{photo_pk}/` passa a exigir MANAGER+ (hoje herda escrita genérica).
Ajuste no `get_permissions()` do `ServiceOrderViewSet` para as actions de exclusão de foto.

## 2. Frontend — Modo seleção na galeria

Em `FilesTab.tsx`:

- Botão "Selecionar" na barra de resumo ativa o modo seleção.
- No modo seleção: checkbox sobreposto em cada thumbnail; tap alterna seleção (não abre
  lightbox); header de cada pasta ganha "selecionar todas".
- Barra de ações fixa (bottom, sticky) com contagem e ações:
  - **Baixar (N)** — sempre visível; chama o endpoint de ZIP via proxy e dispara o download.
  - **Excluir (N)** — visível apenas para MANAGER+ (role da sessão); abre confirmação
    ("N fotos serão removidas") e chama bulk-delete; invalida `["os-photos", orderId]`.
- Sair do modo seleção limpa o estado.
- Download usa `fetch` + blob + `URL.createObjectURL` (POST não permite link direto).

## 3. Frontend — Upload múltiplo com fila

Em `UploadDialog` (dentro de `FilesTab.tsx`):

- `<input type="file" multiple>`; cada arquivo vira um item da fila.
- Validação client-side ao enfileirar (espelha o backend): imagens JPEG/PNG/WebP/HEIC ≤10MB;
  PDF ≤20MB só na pasta `orcamentos`. Arquivo inválido entra como erro com motivo, sem request.
- Estado por item: `pending | uploading | done | error` + mensagem de erro + botão de retry.
- Concorrência: 2 uploads simultâneos (worker simples em memória no componente/hook).
- Legenda (caption) opcional aplica-se ao lote.
- Offline: `apiFetch` já enfileira no Dexie — item marcado como "na fila offline" e o
  banner/sync existente cuida do resto.
- Diálogo pode ser fechado com uploads em andamento? **Não** — botão fechar desabilitado
  enquanto houver `uploading` (simples e evita estado órfão); itens `pending` restantes são
  cancelados ao fechar após conclusão dos ativos.

## 4. Câmera — correção do bug + captura sequencial

### 4.1 Bug do botão de captura

Sintoma: câmera abre, botão de disparo não aparece (mobile e desktop). Causa provável:
layout do `CameraCapture.tsx` — vídeo sem altura limitada empurra os controles pra fora
da viewport. Correção na raiz: container flex de altura limitada (`max-h`/`dvh`), vídeo com
`object-contain` e controles em barra fixa. Reproduzir antes de corrigir (systematic
debugging), validar em desktop e mobile.

### 4.2 Fluxo sequencial

- Captura → marca d'água (função `drawWatermark` existente) → arquivo entra na fila de
  upload → câmera permanece aberta.
- UI: contador de fotos tiradas + miniatura da última no canto + botão "Concluir".
- "Concluir" fecha a câmera e mostra a fila de upload (mesma fila do item 3).
- Sem tela de preview/confirmação entre fotos.

## 5. Types

- Adicionar `slot` e `checklist_type` a `ServiceOrderPhoto` em
  `packages/types/src/service-order.types.ts` (mismatch atual com o backend).

## 6. Testes

- **Backend (pytest):** download ZIP (conteúdo, fotos de outra OS → 400, foto inativa → 400);
  bulk-delete (soft delete, permissão MANAGER+ vs CONSULTANT → 403, activity log único);
  delete individual agora 403 para CONSULTANT.
- **Frontend (vitest):** fila de upload — concorrência 2, retry em erro, validação de
  tipo/tamanho antes do request.
- **Manual/verify:** câmera em desktop (Chrome) e celular (HTTPS), captura sequencial com
  marca d'água, download de zip no celular.

## Fora de escopo

- Mobile React Native (pausado).
- ZIP no cliente (JSZip) e novas dependências.
- Aprovação em duas etapas para exclusão.
- Hard delete / limpeza de storage.
