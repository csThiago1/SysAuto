import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationBell } from "./NotificationBell";

// Mock do hook useOverdueOrders
vi.mock("@/hooks/useOverdueOrders", () => ({
  useOverdueOrders: vi.fn(),
}));

// Mock next/link para evitar erros no jsdom
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock dos componentes Radix UI Popover — renderiza filhos diretamente
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock do Skeleton
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

import { useOverdueOrders } from "@/hooks/useOverdueOrders";
import type { UseQueryResult } from "@tanstack/react-query";
import type { PaginatedResponse, ServiceOrder } from "@paddock/types";

const baseOrder: ServiceOrder = {
  id: "1",
  number: 101,
  plate: "ABC1D23",
  make: "Toyota",
  model: "Corolla",
  year: 2020,
  customer_name: "João Silva",
  customer_id: "cust-1",
  status: "repair",
  opened_at: "2024-01-01T10:00:00Z",
  estimated_delivery: "2024-01-01",
  total: 500,
};

type OverdueQueryResult = UseQueryResult<PaginatedResponse<ServiceOrder>>;

function mockHook(results: ServiceOrder[], extra?: Partial<OverdueQueryResult>) {
  vi.mocked(useOverdueOrders).mockReturnValue({
    data: { count: results.length, results, next: null, previous: null },
    isLoading: false,
    isError: false,
    error: null,
    isPending: false,
    status: "success",
    fetchStatus: "idle",
    isSuccess: true,
    isFetching: false,
    isRefetching: false,
    isLoadingError: false,
    isRefetchError: false,
    isPlaceholderData: false,
    isStale: false,
    dataUpdatedAt: 0,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isFetched: true,
    isFetchedAfterMount: true,
    isInitialLoading: false,
    isPaused: false,
    refetch: vi.fn(),
    ...extra,
  } as unknown as OverdueQueryResult);
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("badge oculto quando count === 0", () => {
    mockHook([]);

    render(<NotificationBell />);
    // Badge não deve existir — nenhum texto numérico
    expect(screen.queryByText(/^\d+$|^99\+$/)).toBeNull();
  });

  it("badge exibe 3 quando hook retorna 3 OS", () => {
    const orders = [
      { ...baseOrder, id: "1" },
      { ...baseOrder, id: "2" },
      { ...baseOrder, id: "3" },
    ];
    mockHook(orders);

    render(<NotificationBell />);
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("badge exibe 99+ quando results.length > 99", () => {
    // NotificationBell usa orders.length (results.length) para o count
    const orders = Array.from({ length: 100 }, (_, i) => ({
      ...baseOrder,
      id: String(i),
    }));
    mockHook(orders);

    render(<NotificationBell />);
    expect(screen.getByText("99+")).toBeTruthy();
  });

  it("exibe mensagem vazia quando sem OS pendentes", () => {
    mockHook([]);

    const { container } = render(<NotificationBell />);
    // O componente renderizou sem erro e contém o botão de sino
    expect(container.querySelector("button")).toBeTruthy();
    expect(screen.getByText("Nenhuma OS com prazo hoje ou vencida.")).toBeTruthy();
  });

  it("exibe skeletons enquanto carregando", () => {
    vi.mocked(useOverdueOrders).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      isPending: true,
      status: "pending",
      fetchStatus: "fetching",
      isSuccess: false,
      isFetching: true,
    } as unknown as OverdueQueryResult);

    render(<NotificationBell />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });
});
