import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { Person } from "@paddock/types"
import { apiFetch } from "@/lib/api"
import { PersonFormModal } from "./PersonFormModal"

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn(), handleApiFormError: vi.fn() }))

const NOT_FOUND = { found: false, fields: {}, source: "", unmatched: [] }
const CEP_FOUND = {
  found: true,
  source: "viacep",
  unmatched: [],
  fields: {
    cep: "69050000",
    logradouro: "Avenida Eduardo Ribeiro",
    complemento: "",
    bairro: "Centro",
    municipio: { id: "1302603", label: "Manaus" },
    uf: "AM",
  },
}
const cnpjResult = (situacao: string) => ({
  found: true,
  source: "cnpja",
  unmatched: [],
  fields: {
    razao_social: "ACME COMERCIO LTDA",
    nome_fantasia: "Acme",
    situacao,
    logradouro: "Rua das Flores",
    numero: "10",
    complemento: "",
    bairro: "Adrianópolis",
    cep: "69057000",
    municipio: { id: "1302603", label: "Manaus" },
    uf: "AM",
    cnae_codigo: "",
    cnae_descricao: "",
    simples: null,
    mei: null,
    email: "",
    telefone: "",
  },
})
const MUNICIPIOS = {
  count: 2,
  next: null,
  previous: null,
  results: [
    { codigo_ibge: "1302603", nome: "Manaus", uf: "AM" },
    { codigo_ibge: "1301902", nome: "Itacoatiara", uf: "AM" },
  ],
}

type Reply = { cep?: unknown; cnpj?: unknown; person?: unknown }

function mockApi({ cep = NOT_FOUND, cnpj = NOT_FOUND, person }: Reply = {}) {
  vi.mocked(apiFetch).mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
    const url = String(input)
    if (url.includes("/lookups/cep/")) return cep
    if (url.includes("/lookups/cnpj/")) return cnpj
    if (url.includes("/lookups/municipios/")) return MUNICIPIOS
    if (init?.method === "POST" && url === "/api/proxy/persons/") return { id: 1 }
    if (url.startsWith("/api/proxy/persons/") && person) return person
    throw new Error(`apiFetch inesperado: ${url}`)
  })
}

/** Chamada ao apiFetch cuja URL contém o trecho. */
const callTo = (fragment: string) =>
  vi.mocked(apiFetch).mock.calls.find(([url]) => String(url).includes(fragment))

function personSaved(): Record<string, unknown> {
  const call = vi
    .mocked(apiFetch)
    .mock.calls.find(([url, init]) => url === "/api/proxy/persons/" && init?.method === "POST")
  if (!call) throw new Error("a pessoa não foi enviada")
  return JSON.parse(String(call[1]?.body))
}

function renderModal(props: Partial<React.ComponentProps<typeof PersonFormModal>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <PersonFormModal open onOpenChange={vi.fn()} {...props} />
    </QueryClientProvider>,
  )
}

const addButtons = () => screen.getAllByRole("button", { name: "+ Adicionar" })
// ordem na tela: documentos, contatos, endereços
const addDocument = (user: ReturnType<typeof userEvent.setup>) => user.click(addButtons()[0]!)
const addAddress = (user: ReturnType<typeof userEvent.setup>) => user.click(addButtons()[2]!)

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Nome Completo/), "Maria Souza")
  await user.type(screen.getByPlaceholderText("(92) 99999-1234"), "92991234567")
  await user.type(screen.getByPlaceholderText("cliente@email.com"), "maria@email.com")
}

describe("PersonFormModal — CEP e município", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it("o CEP preenche só a rua vazia e grava o municipio_ibge", async () => {
    mockApi({ cep: CEP_FOUND })
    const user = userEvent.setup()
    renderModal()
    await addAddress(user)
    await user.type(screen.getByPlaceholderText("Rua, Av..."), "Rua que o usuário digitou")
    await user.type(screen.getByPlaceholderText("00000-000"), "69050000")
    await user.tab()

    expect(await screen.findByDisplayValue("Centro")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Rua, Av...")).toHaveValue("Rua que o usuário digitou")
    const cepCall = callTo("/lookups/cep/")
    expect(cepCall?.[0]).not.toContain("69050000")
    expect(JSON.parse(String(cepCall?.[1]?.body))).toEqual({ key: "69050000" })

    await fillRequired(user)
    await user.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(personSaved()).toBeTruthy())
    expect((personSaved().addresses as unknown[])[0]).toMatchObject({
      street: "Rua que o usuário digitou",
      neighborhood: "Centro",
      city: "Manaus",
      state: "AM",
      municipio_ibge: "1302603",
    })
  })

  it("o complemento da faixa do CEP (\"lado ímpar\") não entra no endereço", async () => {
    mockApi({ cep: { ...CEP_FOUND, fields: { ...CEP_FOUND.fields, complemento: "lado ímpar" } } })
    const user = userEvent.setup()
    renderModal()
    await addAddress(user)
    await user.type(screen.getByPlaceholderText("00000-000"), "69050000")
    await user.tab()
    expect(await screen.findByDisplayValue("Centro")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Apto...")).toHaveValue("")
  })

  it("UF escolhida à mão diferente da do CEP: cidade, UF e IBGE ficam como estão", async () => {
    mockApi({ cep: CEP_FOUND })
    const user = userEvent.setup()
    renderModal()
    await addAddress(user)
    await user.selectOptions(screen.getByLabelText("UF"), "SP")
    await user.type(screen.getByPlaceholderText("00000-000"), "69050000")
    await user.tab()
    expect(await screen.findByDisplayValue("Centro")).toBeInTheDocument()
    expect(screen.getByLabelText("UF")).toHaveValue("SP")

    await fillRequired(user)
    await user.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(personSaved()).toBeTruthy())
    expect((personSaved().addresses as unknown[])[0]).toMatchObject({
      neighborhood: "Centro",
      state: "SP",
      city: "",
      municipio_ibge: "",
    })
  })

  it("com a consulta do CEP sem resposta, escolhe UF e depois o município", async () => {
    mockApi({ cep: NOT_FOUND })
    const user = userEvent.setup()
    renderModal()
    await addAddress(user)
    await user.type(screen.getByPlaceholderText("00000-000"), "69050000")
    await user.tab()
    await waitFor(() => expect(callTo("/lookups/cep/")).toBeTruthy())
    // sem texto livre de cidade nem de código IBGE
    expect(screen.queryByPlaceholderText("1302603")).toBeNull()
    expect(screen.getByLabelText("Município")).toBeDisabled()

    await user.selectOptions(screen.getByLabelText("UF"), "AM")
    await user.click(screen.getByLabelText("Município"))
    await user.click(await screen.findByRole("option", { name: "Itacoatiara" }))
    const munCall = callTo("/lookups/municipios/")
    expect(munCall?.[0]).toContain("uf=AM")

    await fillRequired(user)
    await user.click(screen.getByRole("button", { name: "Salvar" }))
    await waitFor(() => expect(personSaved()).toBeTruthy())
    expect((personSaved().addresses as unknown[])[0]).toMatchObject({
      state: "AM",
      city: "Itacoatiara",
      municipio_ibge: "1301902",
    })
  })
})

describe("PersonFormModal — CNPJ", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  async function typeCnpj(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /Pessoa Jurídica/ }))
    await addDocument(user)
    await user.type(screen.getByPlaceholderText("00.000.000/0000-00"), "11222333000181")
    await user.tab()
  }

  it("situação BAIXADA mostra o aviso âmbar e o cadastro continua preenchido", async () => {
    mockApi({ cnpj: cnpjResult("BAIXADA") })
    const user = userEvent.setup()
    renderModal()
    await typeCnpj(user)

    expect(await screen.findByRole("alert")).toHaveTextContent("BAIXADA")
    expect(screen.getByLabelText(/Razão Social/)).toHaveValue("ACME COMERCIO LTDA")
    expect(screen.getByLabelText("Nome Fantasia")).toHaveValue("Acme")
    expect(screen.getByDisplayValue("Rua das Flores")).toBeInTheDocument()
    const call = callTo("/lookups/cnpj/")
    expect(call?.[0]).not.toContain("11222333000181")
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ key: "11222333000181" })
  })

  it("situação ATIVA não mostra aviso e não sobrescreve a razão social digitada", async () => {
    mockApi({ cnpj: cnpjResult("ATIVA") })
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole("button", { name: /Pessoa Jurídica/ }))
    await user.type(screen.getByLabelText(/Razão Social/), "Nome do usuário")
    await addDocument(user)
    await user.type(screen.getByPlaceholderText("00.000.000/0000-00"), "11222333000181")
    await user.tab()

    expect(await screen.findByLabelText("Nome Fantasia")).toHaveValue("Acme")
    expect(screen.getByLabelText(/Razão Social/)).toHaveValue("Nome do usuário")
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("CNPJ alfanumérico mantém as letras e é consultado limpo", async () => {
    mockApi({ cnpj: cnpjResult("ATIVA") })
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole("button", { name: /Pessoa Jurídica/ }))
    await addDocument(user)
    const input = screen.getByPlaceholderText("00.000.000/0000-00")
    await user.type(input, "12.abc.345/01de-35")
    expect(input).toHaveValue("12.ABC.345/01DE-35")
    await user.tab()
    await waitFor(() => expect(callTo("/lookups/cnpj/")).toBeTruthy())
    expect(JSON.parse(String(callTo("/lookups/cnpj/")?.[1]?.body))).toEqual({
      key: "12ABC34501DE35",
    })
  })

  it("CNPJ numérico continua com a máscara de sempre", async () => {
    mockApi({ cnpj: cnpjResult("ATIVA") })
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole("button", { name: /Pessoa Jurídica/ }))
    await addDocument(user)
    const input = screen.getByPlaceholderText("00.000.000/0000-00")
    await user.type(input, "11222333000181")
    expect(input).toHaveValue("11.222.333/0001-81")
  })

  it("CNPJ com dígito verificador errado não é consultado", async () => {
    mockApi({ cnpj: cnpjResult("ATIVA") })
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByRole("button", { name: /Pessoa Jurídica/ }))
    await addDocument(user)
    await user.type(screen.getByPlaceholderText("00.000.000/0000-00"), "11222333000182")
    await user.tab()
    expect(callTo("/lookups/cnpj/")).toBeUndefined()
  })
})

describe("PersonFormModal — papéis e CPF", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it("não oferece Seguradora ao cadastrar", () => {
    mockApi()
    renderModal()
    expect(screen.getByRole("button", { name: "Cliente" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Seguradora" })).toBeNull()
  })

  it("mantém Seguradora para a pessoa que já tem o papel", async () => {
    const person = {
      id: 9,
      person_kind: "PJ",
      full_name: "Porto Seguro",
      fantasy_name: "",
      is_active: true,
      followup_opt_out: false,
      notes: "",
      roles: [{ id: 1, role: "INSURER" }],
      documents: [],
      contacts: [],
      addresses: [],
    } as unknown as Person
    mockApi({ person })
    renderModal({ person })
    const btn = await screen.findByRole("button", { name: "Seguradora" })
    expect(btn.className).toContain("bg-primary")
  })

  it("link Conferir na Receita abre em nova aba sem levar o CPF na URL", async () => {
    mockApi()
    const user = userEvent.setup()
    renderModal()
    await addDocument(user)
    await user.type(screen.getByPlaceholderText("000.000.000-00"), "52998224725")
    const link = screen.getByRole("link", { name: "Conferir na Receita" })
    expect(link).toHaveAttribute(
      "href",
      "https://servicos.receita.fazenda.gov.br/servicos/cpf/consultasituacao/consultapublica.asp",
    )
    expect(link).toHaveAttribute("target", "_blank")
    expect(link.getAttribute("rel")).toContain("noopener")
  })
})
