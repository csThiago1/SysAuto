import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePermission } from "./usePermission";

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

import { useSession } from "next-auth/react";

import type { PaddockRole } from "@paddock/types";

const mockSession = (role: PaddockRole) => {
  vi.mocked(useSession).mockReturnValue({
    data: { role, user: { name: "Test", email: "test@test.com" }, expires: "" },
    status: "authenticated",
    update: vi.fn(),
  });
};

describe("usePermission", () => {
  it("ADMIN satisfaz qualquer papel exigido", () => {
    mockSession("ADMIN");
    const { result: r1 } = renderHook(() => usePermission("STOREKEEPER"));
    expect(r1.current).toBe(true);
    const { result: r2 } = renderHook(() => usePermission("CONSULTANT"));
    expect(r2.current).toBe(true);
    const { result: r3 } = renderHook(() => usePermission("MANAGER"));
    expect(r3.current).toBe(true);
    const { result: r4 } = renderHook(() => usePermission("ADMIN"));
    expect(r4.current).toBe(true);
  });

  it("OWNER satisfaz qualquer papel incluindo ADMIN", () => {
    mockSession("OWNER");
    const { result } = renderHook(() => usePermission("ADMIN"));
    expect(result.current).toBe(true);
  });

  it("STOREKEEPER não satisfaz CONSULTANT nem acima", () => {
    mockSession("STOREKEEPER");
    const { result: r1 } = renderHook(() => usePermission("CONSULTANT"));
    expect(r1.current).toBe(false);
    const { result: r2 } = renderHook(() => usePermission("MANAGER"));
    expect(r2.current).toBe(false);
    const { result: r3 } = renderHook(() => usePermission("ADMIN"));
    expect(r3.current).toBe(false);
  });

  it("STOREKEEPER satisfaz STOREKEEPER", () => {
    mockSession("STOREKEEPER");
    const { result } = renderHook(() => usePermission("STOREKEEPER"));
    expect(result.current).toBe(true);
  });

  it("MANAGER satisfaz MANAGER e CONSULTANT, não satisfaz ADMIN", () => {
    mockSession("MANAGER");
    const { result: r1 } = renderHook(() => usePermission("CONSULTANT"));
    expect(r1.current).toBe(true);
    const { result: r2 } = renderHook(() => usePermission("MANAGER"));
    expect(r2.current).toBe(true);
    const { result: r3 } = renderHook(() => usePermission("ADMIN"));
    expect(r3.current).toBe(false);
  });

  it("retorna false quando não autenticado", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    });
    const { result } = renderHook(() => usePermission("STOREKEEPER"));
    expect(result.current).toBe(false);
  });

  it("retorna false enquanto sessão está carregando", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "loading",
      update: vi.fn(),
    });
    const { result } = renderHook(() => usePermission("STOREKEEPER"));
    expect(result.current).toBe(false);
  });
});
