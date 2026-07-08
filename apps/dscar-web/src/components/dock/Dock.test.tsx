import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClipboardList, LayoutDashboard, KanbanSquare } from "lucide-react";
import { Dock, type DockModule } from "./Dock";

const modules: DockModule[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", active: false },
  {
    id: "os",
    label: "Ordens de Serviço",
    icon: ClipboardList,
    active: true,
    badge: 3,
    children: [
      { id: "os-lista", label: "Lista de OS", href: "/os", icon: ClipboardList, active: true },
      { id: "os-kanban", label: "Kanban", href: "/os/kanban", icon: KanbanSquare, active: false },
    ],
  },
];

describe("Dock", () => {
  it("navega direto em módulo sem filhos", () => {
    const onNavigate = vi.fn();
    render(<Dock modules={modules} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(onNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("abre popover com filhos e navega ao clicar num filho", () => {
    const onNavigate = vi.fn();
    render(<Dock modules={modules} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Ordens de Serviço" }));
    fireEvent.click(screen.getByRole("button", { name: /Kanban/ }));
    expect(onNavigate).toHaveBeenCalledWith("/os/kanban");
  });

  it("mostra badge e aria-current no módulo ativo", () => {
    render(<Dock modules={modules} onNavigate={vi.fn()} />);
    const osBtn = screen.getByRole("button", { name: "Ordens de Serviço" });
    expect(osBtn).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
