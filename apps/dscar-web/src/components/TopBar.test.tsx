import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopBar } from "./TopBar";

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { role: "ADMIN", user: { name: "Thiago Campos" } },
  }),
  signOut: vi.fn(),
}));
vi.mock("@/components/header/NotificationBell", () => ({
  NotificationBell: () => <span data-testid="bell" />,
}));
vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <span data-testid="theme" />,
}));

describe("TopBar", () => {
  it("dispara evento ⌘K ao clicar em Buscar", () => {
    const spy = vi.spyOn(document, "dispatchEvent");
    render(<TopBar />);
    fireEvent.click(screen.getByRole("button", { name: /Buscar/ }));
    const evt = spy.mock.calls.at(-1)?.[0] as KeyboardEvent;
    expect(evt.key).toBe("k");
    expect(evt.metaKey).toBe(true);
  });

  // Radix DropdownMenu requer userEvent (pointer events) para abrir no jsdom —
  // fireEvent.click não dispara o estado de abertura do Radix em ambiente de teste.
  it("mostra iniciais do usuário e role no dropdown", async () => {
    const user = userEvent.setup();
    render(<TopBar />);
    await user.click(screen.getByRole("button", { name: "Menu do usuário" }));
    expect(screen.getByText("Thiago Campos")).toBeInTheDocument();
    expect(screen.getByText(/Administrador/)).toBeInTheDocument();
  });
});
