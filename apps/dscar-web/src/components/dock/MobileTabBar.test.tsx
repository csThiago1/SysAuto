import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

/** A folha "Mais" passou a abrigar o sino, que usa react-query. */
function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("MobileTabBar (modo operação)", () => {
  beforeEach(() => {
    push.mockClear();
    mockRole = "OWNER";
  });

  it("mostra as tabs do modo operação + Mais + FAB", () => {
    wrap(<MobileTabBar />);
    expect(screen.getByRole("button", { name: "Início" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apontar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conta e mais módulos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova OS" })).toBeInTheDocument();
  });

  it("Mais abre sheet com a navegação completa e navega", () => {
    wrap(<MobileTabBar />);
    fireEvent.click(screen.getByRole("button", { name: "Conta e mais módulos" }));
    fireEvent.click(screen.getByRole("button", { name: /Estoque/ }));
    expect(push).toHaveBeenCalledWith("/estoque");
  });

  it("FAB Nova OS navega pro wizard de recepção", () => {
    wrap(<MobileTabBar />);
    fireEvent.click(screen.getByRole("button", { name: "Nova OS" }));
    expect(push).toHaveBeenCalledWith("/recepcao");
  });

  // A folha deixou de ser so "mais modulos": sem o header, ela e o unico
  // caminho pra sair do app. Um almoxarife nao tem modulos extras, mas continua
  // precisando sair — entao a aba fica, so a secao de modulos e que some.
  it("técnico (STOREKEEPER) mantém a folha da conta, sem módulos e sem FAB", () => {
    mockRole = "STOREKEEPER";
    wrap(<MobileTabBar />);
    expect(screen.getByRole("button", { name: "Apontar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conta e mais módulos" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Conta e mais módulos" }));
    expect(screen.getByRole("button", { name: /sair/i })).toBeInTheDocument();
    expect(screen.queryByText("Módulos")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nova OS" })).not.toBeInTheDocument();
  });
});
