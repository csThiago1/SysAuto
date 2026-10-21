import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ServiceOrder } from "@paddock/types";
import { KanbanCard } from "./KanbanCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function order(vehicle_needs_review: boolean): ServiceOrder {
  return {
    id: "os-1",
    number: 101,
    status: "repair",
    plate: "ABC1D23",
    make: "Chevrolet",
    model: "Onix Plus",
    year: 2025,
    customer_name: "Cliente",
    days_in_shop: 2,
    estimated_delivery_date: null,
    insurer_detail: null,
    vehicle_needs_review,
  } as unknown as ServiceOrder;
}

describe("KanbanCard", () => {
  it("mostra o selo quando o veículo está a confirmar", () => {
    render(<KanbanCard order={order(true)} />);
    expect(screen.getByText("Veículo a confirmar")).toBeInTheDocument();
  });

  it("sem pendência de veículo, não há selo", () => {
    render(<KanbanCard order={order(false)} />);
    expect(screen.queryByText("Veículo a confirmar")).not.toBeInTheDocument();
  });
});
