import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileTabBar } from "./MobileTabBar";

const push = vi.fn();
let mockRole = "OWNER";
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push }),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { role: mockRole, extraPermissions: [] } }),
}));
vi.mock("@/hooks/useOverdueOrders", () => ({
  useOverdueOrders: () => ({ data: [] }),
}));

describe("MobileTabBar (modo operação)", () => {
  beforeEach(() => {
    push.mockClear();
    mockRole = "OWNER";
  });

  it("mostra as tabs do modo operação + Mais + FAB", () => {
    render(<MobileTabBar />);
    expect(screen.getByRole("button", { name: "Início" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apontar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais módulos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova OS" })).toBeInTheDocument();
  });

  it("Mais abre sheet com a navegação completa e navega", () => {
    render(<MobileTabBar />);
    fireEvent.click(screen.getByRole("button", { name: "Mais módulos" }));
    fireEvent.click(screen.getByRole("button", { name: /Estoque/ }));
    expect(push).toHaveBeenCalledWith("/estoque");
  });

  it("FAB Nova OS navega pro wizard de recepção", () => {
    render(<MobileTabBar />);
    fireEvent.click(screen.getByRole("button", { name: "Nova OS" }));
    expect(push).toHaveBeenCalledWith("/recepcao");
  });

  it("esconde Mais e FAB para técnico (STOREKEEPER)", () => {
    mockRole = "STOREKEEPER";
    render(<MobileTabBar />);
    expect(screen.getByRole("button", { name: "Apontar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mais módulos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nova OS" })).not.toBeInTheDocument();
  });
});
