import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar, activeHref } from "./Sidebar";

const t = vi.hoisted(() => ({ path: "/os/kanban", role: "STOREKEEPER", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => t.path,
  useRouter: () => ({ push: t.push }),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { role: t.role, extraPermissions: [] } }),
  signOut: vi.fn(),
}));
vi.mock("@/components/header/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/offline/OfflineStatusBar", () => ({ OfflineStatusBar: () => null }));
vi.mock("@/hooks/useOverdueOrders", () => ({
  useOverdueOrders: () => ({ data: [{ urgency: "overdue" }, { urgency: "due_today" }, { urgency: "due_today" }] }),
}));
vi.mock("@/hooks/useServiceOrders", () => ({
  useServiceOrders: () => ({ data: { count: 23, results: [] } }),
}));

// tela de desktop (o placar e o sino só carregam em md+)
window.matchMedia = vi.fn().mockReturnValue({
  matches: true,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}) as unknown as typeof window.matchMedia;

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("activeHref", () => {
  it("escolhe o caminho mais específico", () => {
    expect(activeHref("/financeiro/dre", ["/financeiro", "/financeiro/dre"])).toBe("/financeiro/dre");
    expect(activeHref("/os/123", ["/os", "/os/kanban"])).toBe("/os");
    expect(activeHref("/agenda", ["/os"])).toBeUndefined();
  });
});

describe("Sidebar", () => {
  beforeEach(() => {
    t.path = "/os/kanban";
    t.role = "STOREKEEPER";
    t.push.mockClear();
    sessionStorage.clear();
  });

  it("OWNER em /os/kanban: área Oficina, com Kanban e sem Retornos", () => {
    t.role = "OWNER";
    wrap(<Sidebar />);
    expect(screen.getByRole("tab", { name: "Oficina" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: "Kanban" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Retornos" })).not.toBeInTheDocument();
  });

  it("OWNER em /crm/retornos: área Comercial, com Retornos e sem Kanban", () => {
    t.role = "OWNER";
    t.path = "/crm/retornos";
    wrap(<Sidebar />);
    expect(screen.getByRole("tab", { name: "Comercial" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: "Retornos" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Kanban" })).not.toBeInTheDocument();
  });

  it("almoxarife não vê a área Financeiro", () => {
    wrap(<Sidebar />);
    expect(screen.queryByRole("tab", { name: "Financeiro" })).not.toBeInTheDocument();
  });

  it("clicar em Financeiro leva para /financeiro", () => {
    t.role = "OWNER";
    wrap(<Sidebar />);
    fireEvent.click(screen.getByRole("tab", { name: "Financeiro" }));
    expect(t.push).toHaveBeenCalledWith("/financeiro");
  });

  it("acende só o Kanban, mostra o placar e esconde módulos do papel", () => {
    wrap(<Sidebar />);
    expect(screen.getByRole("link", { name: "Kanban" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Ordens de Serviço/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByLabelText("23 no pátio, 1 atrasadas, 2 para entregar hoje")).toBeInTheDocument();
    expect(screen.queryByText("Financeiro")).not.toBeInTheDocument();
    // almoxarife não abre OS
    expect(screen.queryByRole("link", { name: "Nova OS" })).not.toBeInTheDocument();
  });
});
