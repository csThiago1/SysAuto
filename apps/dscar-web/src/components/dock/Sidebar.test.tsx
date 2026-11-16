import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar, activeHref } from "./Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/os/kanban",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { role: "STOREKEEPER", extraPermissions: [] } }),
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
