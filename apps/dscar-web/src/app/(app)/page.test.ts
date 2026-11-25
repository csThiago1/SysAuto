import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppRootPage from "./page";

const authMock = auth as unknown as ReturnType<typeof vi.fn>;

describe("AppRootPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("OWNER vai para /dashboard", async () => {
    authMock.mockResolvedValue({ role: "OWNER" });
    await expect(AppRootPage()).rejects.toThrow();
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("CONSULTANT vai para /os/kanban", async () => {
    authMock.mockResolvedValue({ role: "CONSULTANT" });
    await expect(AppRootPage()).rejects.toThrow();
    expect(redirect).toHaveBeenCalledWith("/os/kanban");
  });

  it("sem sessão vai para /os/kanban", async () => {
    authMock.mockResolvedValue(null);
    await expect(AppRootPage()).rejects.toThrow();
    expect(redirect).toHaveBeenCalledWith("/os/kanban");
  });
});
