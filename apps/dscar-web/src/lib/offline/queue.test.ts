import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import { discardDraft, drainQueue, enqueueMutation, isQueueable, keepMine } from "./queue";

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

beforeEach(async () => {
  await db.drafts.clear();
  vi.restoreAllMocks();
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("caches", { match: vi.fn().mockResolvedValue(undefined) });
});

describe("isQueueable", () => {
  it("aceita writes de OS/fotos/peças/apontamento/assinatura", () => {
    expect(isQueueable("/api/proxy/service-orders/", { method: "POST" })).toBe(true);
    expect(isQueueable("/api/proxy/service-orders/abc-123/photos/", { method: "POST" })).toBe(true);
    expect(isQueueable("/api/proxy/signatures/signatures/capture/", { method: "POST" })).toBe(true);
  });

  it("rejeita GET, fiscal e transição pra delivered", () => {
    expect(isQueueable("/api/proxy/service-orders/", {})).toBe(false);
    expect(isQueueable("/api/proxy/fiscal/nfe/", { method: "POST" })).toBe(false);
    expect(
      isQueueable("/api/proxy/service-orders/abc/transition/", {
        method: "POST",
        body: JSON.stringify({ new_status: "delivered" }),
      }),
    ).toBe(false);
  });
});

describe("enqueueMutation", () => {
  it("injeta client_uuid no payload JSON", async () => {
    const draft = await enqueueMutation(
      "/api/proxy/service-orders/",
      jsonInit("POST", { plate: "ABC1D23" }),
    );
    expect(draft.payload?.client_uuid).toBe(draft.id);
    expect(draft.payload?.plate).toBe("ABC1D23");
    expect(await db.drafts.count()).toBe(1);
  });

  it("separa blob dos campos texto em FormData", async () => {
    const fd = new FormData();
    fd.append("folder", "initial_survey");
    fd.append("file", new Blob(["x"], { type: "image/jpeg" }), "foto.jpg");
    const draft = await enqueueMutation("/api/proxy/service-orders/abc/photos/", {
      method: "POST",
      body: fd,
    });
    expect(draft.payload?.folder).toBe("initial_survey");
    expect(draft.blobField).toBe("file");
    expect(draft.blob).toBeInstanceOf(Blob);
  });

  it("PATCH de OS anexa If-Match do cache do SW", async () => {
    vi.stubGlobal("caches", {
      match: vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ updated_at: "2026-07-10T12:00:00" }))),
    });
    const draft = await enqueueMutation(
      "/api/proxy/service-orders/0198c0de-aaaa-7000-8000-000000000001/",
      jsonInit("PATCH", { plate: "B" }),
    );
    expect(draft.headers["If-Match"]).toBe("2026-07-10T12:00:00");
  });
});

describe("drainQueue", () => {
  it("2xx remove o draft e reconcilia o id nos drafts dependentes", async () => {
    const os = await enqueueMutation("/api/proxy/service-orders/", jsonInit("POST", { plate: "A" }));
    await enqueueMutation(
      `/api/proxy/service-orders/${os.id}/photos/`,
      jsonInit("POST", { folder: "initial_survey" }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "real-1" }), { status: 201 }))
      .mockResolvedValueOnce(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await drainQueue();

    expect(await db.drafts.count()).toBe(0);
    expect(String(fetchMock.mock.calls[1][0])).toContain("real-1");
  });

  it("409 marca conflict e mantém o draft", async () => {
    const d = await enqueueMutation(
      "/api/proxy/service-orders/abc/",
      jsonInit("PATCH", { plate: "B" }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "alterada" }), { status: 409 })),
    );

    await drainQueue();

    const after = await db.drafts.get(d.id);
    expect(after?.status).toBe("conflict");
    expect(after?.lastError).toBe("alterada");
  });

  it("erro de rede mantém pending e interrompe o drain", async () => {
    const d = await enqueueMutation("/api/proxy/service-orders/", jsonInit("POST", { plate: "C" }));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));

    await drainQueue();

    const after = await db.drafts.get(d.id);
    expect(after?.status).toBe("pending");
  });
});

describe("resolução de conflito", () => {
  it("keepMine remove If-Match e re-drena", async () => {
    const d = await enqueueMutation(
      "/api/proxy/service-orders/abc/",
      jsonInit("PATCH", { plate: "D" }),
    );
    await db.drafts.update(d.id, { status: "conflict", headers: { "If-Match": "2020-01-01" } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));

    await keepMine(d.id);

    expect(await db.drafts.count()).toBe(0); // re-drenado com sucesso
  });

  it("discardDraft deleta", async () => {
    const d = await enqueueMutation("/api/proxy/service-orders/", jsonInit("POST", { plate: "E" }));
    await discardDraft(d.id);
    expect(await db.drafts.count()).toBe(0);
  });
});
