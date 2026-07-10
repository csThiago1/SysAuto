import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn() } }));

import { apiFetch } from "@/lib/api";
import { db } from "./db";

beforeEach(async () => {
  await db.drafts.clear();
  vi.stubGlobal("navigator", { onLine: false });
  vi.stubGlobal("caches", { match: vi.fn().mockResolvedValue(undefined) });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));
});

describe("apiFetch offline", () => {
  it("write enfileirável cai por rede → enfileira e resolve otimista", async () => {
    const res = await apiFetch<{ _offline?: boolean; client_uuid?: string }>(
      "/api/proxy/service-orders/",
      { method: "POST", body: JSON.stringify({ plate: "ABC1D23" }) },
    );
    expect(res._offline).toBe(true);
    expect(res.client_uuid).toBeTruthy();
    expect(await db.drafts.count()).toBe(1);
  });

  it("GET cai por rede → lança network_error (SW cobre o fallback)", async () => {
    await expect(apiFetch("/api/proxy/service-orders/")).rejects.toThrow("network_error");
    expect(await db.drafts.count()).toBe(0);
  });

  it("URL fora da whitelist falha rápido mesmo sendo write", async () => {
    await expect(
      apiFetch("/api/proxy/fiscal/nfe/", { method: "POST", body: "{}" }),
    ).rejects.toThrow("network_error");
    expect(await db.drafts.count()).toBe(0);
  });

  it("offline:false força falha rápida mesmo em URL enfileirável", async () => {
    await expect(
      apiFetch("/api/proxy/service-orders/", { method: "POST", body: "{}", offline: false }),
    ).rejects.toThrow("network_error");
    expect(await db.drafts.count()).toBe(0);
  });
});
