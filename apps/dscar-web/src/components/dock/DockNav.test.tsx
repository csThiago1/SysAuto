import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DockNav } from "./DockNav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/os",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { role: "STOREKEEPER", extraPermissions: [] } }),
}));
vi.mock("@/hooks/useOverdueOrders", () => ({
  useOverdueOrders: () => ({ data: [{ urgency: "overdue" }, { urgency: "due_today" }] }),
}));

/** A doca passou a carregar as utilidades, e OfflineStatusBar usa react-query. */
function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("DockNav", () => {
  it("filtra módulos por role e marca ativo pelo pathname", () => {
    wrap(<DockNav />);
    expect(screen.getByRole("button", { name: "Ordens de Serviço" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.queryByRole("button", { name: "Financeiro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recursos Humanos" })).not.toBeInTheDocument();
  });

  it("mostra badge de OS atrasadas", () => {
    wrap(<DockNav />);
    // O sino tambem mostra "2" desde que as utilidades entraram na doca —
    // procurar o numero solto casa com os dois. O badge do modulo e o que
    // mora dentro do <nav aria-label="Modulos">.
    const nav = screen.getByRole("navigation", { name: "Módulos" });
    expect(within(nav).getByText("2")).toBeInTheDocument();
  });
});
