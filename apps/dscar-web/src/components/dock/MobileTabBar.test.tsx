import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileTabBar } from "./MobileTabBar";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push }),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { role: "OWNER", extraPermissions: [] } }),
}));
vi.mock("@/hooks/useOverdueOrders", () => ({
  useOverdueOrders: () => ({ data: [] }),
}));

describe("MobileTabBar", () => {
  it("mostra 4 módulos fixos + botão Mais", () => {
    render(<MobileTabBar />);
    expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ordens de Serviço" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Orçamentos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais módulos" })).toBeInTheDocument();
  });

  it("Mais abre sheet com os módulos restantes e navega", () => {
    render(<MobileTabBar />);
    fireEvent.click(screen.getByRole("button", { name: "Mais módulos" }));
    fireEvent.click(screen.getByRole("button", { name: /Estoque/ }));
    expect(push).toHaveBeenCalledWith("/estoque");
  });
});
