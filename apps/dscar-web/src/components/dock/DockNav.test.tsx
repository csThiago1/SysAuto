import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("DockNav", () => {
  it("filtra módulos por role e marca ativo pelo pathname", () => {
    render(<DockNav />);
    expect(screen.getByRole("button", { name: "Ordens de Serviço" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.queryByRole("button", { name: "Financeiro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recursos Humanos" })).not.toBeInTheDocument();
  });

  it("mostra badge de OS atrasadas", () => {
    render(<DockNav />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
