import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConfirmChecklistPage from "./page";

vi.mock("next/navigation", () => ({ useParams: () => ({ token: "tok123" }) }));

const BASE = "/api/proxy/public/checklist-confirm/tok123/";
const DATA = {
  placa: "ABC1D23",
  modelo: "Chevrolet Onix",
  pdf_url: "/api/v1/public/checklist-confirm/tok123/pdf/",
  version: 2,
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function mockFetch(get: Response, post?: Response) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "POST" ? (post ?? json({})) : get,
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ConfirmChecklistPage />
    </QueryClientProvider>,
  );
}

describe("ConfirmChecklistPage", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("410 mostra que o link venceu", async () => {
    mockFetch(json({ detail: "Link expirado ou já utilizado.", code: "link_expired" }, 410));
    renderPage();
    expect(await screen.findByText("Este link venceu. Peça um novo à DS Car.")).toBeInTheDocument();
  });

  it("404 mostra link inválido", async () => {
    mockFetch(json({ detail: "Not found." }, 404));
    renderPage();
    expect(await screen.findByText("Link inválido.")).toBeInTheDocument();
  });

  it("mostra placa, modelo e o PDF pelo proxy", async () => {
    const fetchMock = mockFetch(json(DATA));
    renderPage();
    expect(await screen.findByText("ABC1D23")).toBeInTheDocument();
    expect(screen.getByText("Chevrolet Onix")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(BASE);
    expect(screen.getByRole("link", { name: /Ver checklist \(PDF\)/ })).toHaveAttribute(
      "href",
      "/api/proxy/public/checklist-confirm/tok123/pdf/",
    );
  });

  it("sem PDF não oferece o botão", async () => {
    mockFetch(json({ ...DATA, pdf_url: null }));
    renderPage();
    await screen.findByText("ABC1D23");
    expect(screen.queryByRole("link", { name: /Ver checklist/ })).not.toBeInTheDocument();
    expect(screen.getByText(/PDF do checklist ainda não está disponível/)).toBeInTheDocument();
  });

  it("confirma com o nome e agradece", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(json(DATA), json({ signed_at: "2026-11-11T12:00:00Z" }));
    renderPage();
    await screen.findByText("ABC1D23");
    const button = screen.getByRole("button", {
      name: "Confirmo que o veículo entrou nestas condições",
    });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText("Seu nome"), "Maria Cliente");
    await user.click(button);
    expect(await screen.findByText("Obrigado! Confirmação registrada.")).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[0]).toBe(BASE);
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ signer_name: "Maria Cliente" });
  });

  it("410 no POST mostra que o link venceu", async () => {
    const user = userEvent.setup();
    mockFetch(json(DATA), json({ code: "link_expired" }, 410));
    renderPage();
    await screen.findByText("ABC1D23");
    await user.type(screen.getByLabelText("Seu nome"), "Maria");
    await user.click(screen.getByRole("button", { name: /Confirmo/ }));
    expect(await screen.findByText("Este link venceu. Peça um novo à DS Car.")).toBeInTheDocument();
  });

  it("erro de rede no GET mostra erro genérico com nova tentativa", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    renderPage();
    // Uma nova tentativa automática (~1s) antes de desistir.
    expect(
      await screen.findByText(/Não foi possível abrir o checklist/, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});
