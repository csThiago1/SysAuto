import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { apiFetch } from "@/lib/api"
import type { PersonPatch } from "../../_hooks/useCustomerSearch"
import type { ServiceOrderUpdateInput } from "../../_schemas/service-order.schema"
import { CustomerSection } from "./CustomerSection"

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }))

const COBRANCA = {
  id: 12,
  address_type: "COBRANCA",
  zip_code: "69900000",
  street: "Rua da Cobrança",
  number: "5",
  complement: "",
  neighborhood: "Centro",
  city: "Rio Branco",
  state: "AC",
  municipio_ibge: "1200401",
  is_primary: false,
}
const PRINCIPAL = {
  id: 11,
  address_type: "PRINCIPAL",
  zip_code: "",
  street: "Rua do usuário",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  municipio_ibge: "",
  is_primary: true,
}
const PERSON = {
  id: 5,
  full_name: "Maria Souza",
  birth_date: null,
  contacts: [],
  addresses: [COBRANCA, PRINCIPAL],
}
const CEP = {
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

function Harness({ onPersonDataChange }: { onPersonDataChange: (p: PersonPatch | null) => void }) {
  const form = useForm<ServiceOrderUpdateInput>({
    defaultValues: { customer_person_id: 5, customer_name: "Maria Souza" } as ServiceOrderUpdateInput,
  })
  return <CustomerSection form={form} onPersonDataChange={onPersonDataChange} hideHeading />
}

function lastPatch(spy: ReturnType<typeof vi.fn>): PersonPatch {
  const patch = spy.mock.calls.at(-1)?.[0] as PersonPatch | null | undefined
  if (!patch) throw new Error("nenhum PersonPatch emitido")
  return patch
}

describe("CustomerSection — endereço da pessoa", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(apiFetch).mockImplementation(async (input: RequestInfo) => {
      const url = String(input)
      if (url.includes("/lookups/cep/")) return CEP
      if (url.includes("/persons/5/")) return PERSON
      throw new Error(`apiFetch inesperado: ${url}`)
    })
  })

  function renderSection() {
    const spy = vi.fn()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <Harness onPersonDataChange={spy} />
      </QueryClientProvider>,
    )
    return spy
  }

  it("o CEP preenche só o que está vazio e o patch leva municipio_ibge e os outros endereços", async () => {
    const spy = renderSection()
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: "Editar" }))
    await user.type(screen.getByPlaceholderText("00000-000"), "69050000")
    await user.tab()

    await waitFor(() => expect(screen.getByPlaceholderText("Centro")).toHaveValue("Centro"))
    expect(screen.getByPlaceholderText("Av. Eduardo Ribeiro")).toHaveValue("Rua do usuário")
    expect(screen.getByPlaceholderText("Manaus")).toHaveValue("Manaus")
    const cepCall = vi.mocked(apiFetch).mock.calls.find(([u]) => String(u).includes("/lookups/cep/"))
    expect(JSON.parse(String(cepCall?.[1]?.body))).toEqual({ key: "69050000" })

    const addresses = lastPatch(spy).addresses!
    expect(addresses).toHaveLength(2)
    expect(addresses.find((a) => a.address_type === "COBRANCA")).toEqual({
      address_type: "COBRANCA",
      zip_code: "69900000",
      street: "Rua da Cobrança",
      number: "5",
      complement: "",
      neighborhood: "Centro",
      city: "Rio Branco",
      state: "AC",
      municipio_ibge: "1200401",
      is_primary: false,
    })
    expect(addresses.find((a) => a.is_primary)).toMatchObject({
      address_type: "PRINCIPAL",
      zip_code: "69050000",
      street: "Rua do usuário",
      neighborhood: "Centro",
      city: "Manaus",
      state: "AM",
      municipio_ibge: "1302603",
    })
  })

  it("editar só a rua mantém o municipio_ibge; editar a cidade à mão o zera", async () => {
    const spy = renderSection()
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: "Editar" }))
    await user.type(screen.getByPlaceholderText("00000-000"), "69050000")
    await user.tab()
    await waitFor(() => expect(screen.getByPlaceholderText("Manaus")).toHaveValue("Manaus"))

    await user.type(screen.getByPlaceholderText("123"), "77")
    expect(lastPatch(spy).addresses!.find((a) => a.is_primary)).toMatchObject({
      number: "77",
      municipio_ibge: "1302603",
    })

    await user.type(screen.getByPlaceholderText("Manaus"), "x")
    expect(lastPatch(spy).addresses!.find((a) => a.is_primary)).toMatchObject({
      city: "Manausx",
      municipio_ibge: "",
    })
  })

  it("cidade já preenchida diferente da do CEP e IBGE vazio: o grupo cidade/UF/IBGE não muda", async () => {
    const itacoatiara = { ...PRINCIPAL, city: "Itacoatiara", state: "AM", municipio_ibge: "" }
    vi.mocked(apiFetch).mockImplementation(async (input: RequestInfo) => {
      const url = String(input)
      if (url.includes("/lookups/cep/")) return CEP
      if (url.includes("/persons/5/")) return { ...PERSON, addresses: [itacoatiara] }
      throw new Error(`apiFetch inesperado: ${url}`)
    })
    const spy = renderSection()
    const user = userEvent.setup()
    await user.click(await screen.findByRole("button", { name: "Editar" }))
    await user.type(screen.getByPlaceholderText("00000-000"), "69050000")
    await user.tab()
    await waitFor(() => expect(screen.getByPlaceholderText("Centro")).toHaveValue("Centro"))

    expect(lastPatch(spy).addresses!.find((a) => a.is_primary)).toMatchObject({
      neighborhood: "Centro",
      city: "Itacoatiara",
      state: "AM",
      municipio_ibge: "",
    })
  })
})
