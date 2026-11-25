import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommandPalette } from "./CommandPalette";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/os/kanban",
  useRouter: () => ({ push }),
}));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { role: "OWNER", extraPermissions: [] } }),
}));

beforeEach(() => {
  push.mockClear();
  sessionStorage.clear();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("CommandPalette", () => {
  it("lista outras áreas e navega para a tela inicial", () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.queryByText("Ir para Oficina")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Ir para Financeiro"));
    expect(push).toHaveBeenCalledWith("/financeiro");
  });
});
