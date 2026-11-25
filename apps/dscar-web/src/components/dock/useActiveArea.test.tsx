import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useActiveArea } from "./useActiveArea";

const state = { pathname: "/os/123", role: "OWNER" as string, perms: [] as string[] };
const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ push }),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { role: state.role, extraPermissions: state.perms } }),
}));

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
  push.mockClear();
  state.pathname = "/os/123";
  state.role = "OWNER";
  state.perms = [];
});

describe("useActiveArea", () => {
  it("rota de área manda e é gravada", async () => {
    state.pathname = "/crm/retornos";
    const { result } = renderHook(() => useActiveArea());
    expect(result.current.area).toBe("comercial");
    await waitFor(() => expect(sessionStorage.getItem("dscar-area")).toBe("comercial"));
  });

  it("rota compartilhada usa a área gravada", async () => {
    sessionStorage.setItem("dscar-area", "comercial");
    const { result } = renderHook(() => useActiveArea());
    await waitFor(() => expect(result.current.area).toBe("comercial"));
  });

  it("Kanban -> OS mantém a área já no primeiro render", () => {
    state.pathname = "/os/kanban";
    const { result, rerender } = renderHook(() => useActiveArea());
    state.pathname = "/os/123";
    rerender();
    expect(result.current.area).toBe("oficina");
  });

  it("CONSULTANT com financeiro gravado em /os/123 cai em oficina", async () => {
    state.role = "CONSULTANT";
    sessionStorage.setItem("dscar-area", "financeiro");
    const { result } = renderHook(() => useActiveArea());
    await act(async () => {});
    expect(result.current.area).toBe("oficina");
  });

  it("sem nada gravado usa o padrão do papel", () => {
    expect(renderHook(() => useActiveArea()).result.current.area).toBe("gestao");
    state.role = "CONSULTANT";
    expect(renderHook(() => useActiveArea()).result.current.area).toBe("oficina");
  });

  it("valor gravado inválido cai no padrão", async () => {
    sessionStorage.setItem("dscar-area", "xyz");
    const { result } = renderHook(() => useActiveArea());
    await act(async () => {});
    expect(result.current.area).toBe("gestao");
  });

  it("área sem permissão cai em oficina", () => {
    state.pathname = "/financeiro";
    state.role = "CONSULTANT";
    const { result } = renderHook(() => useActiveArea());
    expect(result.current.area).toBe("oficina");
    expect(result.current.areas).not.toContain("financeiro");
  });

  it("storage com erro não quebra", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("x"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("x"); });
    const { result } = renderHook(() => useActiveArea());
    await act(async () => {});
    expect(result.current.area).toBe("gestao");
  });

  it("setArea grava e navega", async () => {
    const { result } = renderHook(() => useActiveArea());
    act(() => result.current.setArea("financeiro"));
    expect(push).toHaveBeenCalledWith("/financeiro");
    expect(sessionStorage.getItem("dscar-area")).toBe("financeiro");
  });
});
