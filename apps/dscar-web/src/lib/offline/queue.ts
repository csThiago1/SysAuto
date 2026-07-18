import { v7 as uuidv7 } from "uuid";
import { db, type DraftMutation } from "./db";

// Operações que a fila offline pode replayar. Tudo fora daqui (NF-e,
// faturamento, aprovação de OC, transição → delivered) falha rápido como hoje.
const QUEUEABLE: RegExp[] = [
  /^\/api\/proxy\/service-orders\/$/,
  /^\/api\/proxy\/service-orders\/[0-9a-f-]+\/$/,
  /^\/api\/proxy\/service-orders\/[0-9a-f-]+\/(photos|parts|parts\/estoque|labor|apontamentos|transition|checklist-items\/bulk)\/$/,
  // prefixo dobrado é o path real (app /signatures/ + router "signatures")
  /^\/api\/proxy\/signatures\/signatures\/capture\/$/,
];

export function isQueueable(url: string, init: RequestInit): boolean {
  const method = init.method ?? "GET";
  if (method === "GET") return false;
  const path = url.startsWith("/") ? url : new URL(url, window.location.origin).pathname;
  if (!QUEUEABLE.some((re) => re.test(path))) return false;
  // Transição → delivered é online-only (dispara faturamento/NF-e no backend)
  if (
    /\/transition\/$/.test(path) &&
    typeof init.body === "string" &&
    init.body.includes('"delivered"')
  ) {
    return false;
  }
  return true;
}

function normalizeHeaders(h: HeadersInit | undefined): Record<string, string> {
  if (!h) return {};
  if (h instanceof Headers) return Object.fromEntries(h.entries());
  if (Array.isArray(h)) return Object.fromEntries(h);
  return { ...h };
}

export async function enqueueMutation(url: string, init: RequestInit): Promise<DraftMutation> {
  const id = uuidv7();
  const headers = normalizeHeaders(init.headers);
  let payload: Record<string, unknown> | undefined;
  let blob: Blob | undefined;
  let blobField: string | undefined;

  if (init.body instanceof FormData) {
    payload = {};
    for (const [key, value] of init.body.entries()) {
      if (value instanceof Blob) {
        blob = value;
        blobField = key;
      } else {
        payload[key] = value;
      }
    }
    payload.client_uuid = id;
    delete headers["Content-Type"]; // multipart é remontado no drain
  } else if (typeof init.body === "string") {
    payload = { ...(JSON.parse(init.body) as Record<string, unknown>), client_uuid: id };
  }

  // PATCH de OS: If-Match com o updated_at da última versão vista (cache do SW).
  // Sem cache → sem If-Match → sem detecção de conflito (comportamento atual).
  if (/\/service-orders\/[0-9a-f-]+\/$/.test(url) && init.method === "PATCH") {
    const cached = await caches.match(url).catch(() => undefined);
    if (cached) {
      const data = (await cached.json().catch(() => ({}))) as { updated_at?: string };
      if (data.updated_at) headers["If-Match"] = data.updated_at;
    }
  }

  const draft: DraftMutation = {
    id,
    url,
    method: (init.method ?? "POST") as DraftMutation["method"],
    headers,
    payload,
    blob,
    blobField,
    createdAt: Date.now(),
    attempts: 0,
    status: "pending",
  };
  await db.drafts.add(draft);
  return draft;
}

function buildRequest(draft: DraftMutation): RequestInit {
  if (draft.blob && draft.blobField) {
    const fd = new FormData();
    Object.entries(draft.payload ?? {}).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append(draft.blobField, draft.blob);
    return { method: draft.method, headers: draft.headers, body: fd };
  }
  return {
    method: draft.method,
    headers: { "Content-Type": "application/json", ...draft.headers },
    body: draft.payload ? JSON.stringify(draft.payload) : undefined,
  };
}

async function errDetail(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { detail?: string };
  return body.detail ?? `HTTP ${res.status}`;
}

/** Substitui o client_uuid recém-sincado pelo id real nos drafts dependentes. */
async function reconcileId(clientUuid: string, remoteId: string): Promise<void> {
  const all = await db.drafts.toArray();
  for (const d of all) {
    const url = d.url.replaceAll(clientUuid, remoteId);
    const payloadStr = d.payload ? JSON.stringify(d.payload) : undefined;
    const newPayloadStr = payloadStr?.replaceAll(clientUuid, remoteId);
    if (url !== d.url || newPayloadStr !== payloadStr) {
      await db.drafts.update(d.id, {
        url,
        payload: newPayloadStr
          ? (JSON.parse(newPayloadStr) as Record<string, unknown>)
          : d.payload,
      });
    }
  }
}

/** @returns false se a rede caiu de novo (interrompe o drain) */
async function syncDraft(draft: DraftMutation): Promise<boolean> {
  await db.drafts.update(draft.id, { status: "syncing", attempts: draft.attempts + 1 });
  let res: Response;
  try {
    res = await fetch(draft.url, buildRequest(draft));
  } catch {
    await db.drafts.update(draft.id, { status: "pending", lastError: "network_error" });
    return false;
  }
  if (res.ok) {
    const body = (await res.json().catch(() => ({}))) as { id?: number | string };
    if (draft.method === "POST" && body.id != null) {
      await reconcileId(draft.id, String(body.id));
    }
    await db.drafts.delete(draft.id);
  } else if (res.status === 409) {
    await db.drafts.update(draft.id, { status: "conflict", lastError: await errDetail(res) });
  } else {
    await db.drafts.update(draft.id, { status: "failed", lastError: await errDetail(res) });
  }
  return true;
}

let draining = false;

export async function drainQueue(): Promise<void> {
  if (draining || !navigator.onLine) return;
  draining = true;
  let synced = 0;
  try {
    const pending = await db.drafts.where("status").equals("pending").sortBy("createdAt");
    for (const stale of pending) {
      // reler: reconciliações de drafts anteriores podem ter alterado url/payload
      const draft = await db.drafts.get(stale.id);
      if (!draft || draft.status !== "pending") continue;
      const ok = await syncDraft(draft);
      if (!ok) break;
      synced++;
    }
  } finally {
    draining = false;
    // avisa a UI que dados chegaram no servidor (invalidação de queries)
    if (synced > 0) window.dispatchEvent(new CustomEvent("offline-queue-drained"));
  }
}

/** Conflito → "manter minhas alterações": re-envia sem If-Match (sobrescreve). */
export async function keepMine(draftId: string): Promise<void> {
  const draft = await db.drafts.get(draftId);
  if (!draft) return;
  const headers = { ...draft.headers };
  delete headers["If-Match"];
  await db.drafts.update(draftId, { status: "pending", headers, lastError: undefined });
  await drainQueue();
}

export async function discardDraft(draftId: string): Promise<void> {
  await db.drafts.delete(draftId);
}
