import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import type { ChecklistDamage } from "../_schemas/checklist.schema"

const { createDamage, patchDamage, photosData, noop } = vi.hoisted(() => ({
  createDamage: vi.fn().mockResolvedValue({}),
  patchDamage: vi.fn().mockResolvedValue({}),
  photosData: { current: [] as { id: string; url: string | null }[] },
  noop: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock("../_hooks/useEntryChecklist", () => ({
  useCreateDamage: () => ({ mutateAsync: createDamage, isPending: false }),
  usePatchDamage: () => ({ mutateAsync: patchDamage, isPending: false }),
  useDeactivateDamage: noop,
}))
vi.mock("../_hooks/useChecklistPhotos", () => ({
  useChecklistPhotos: () => ({ data: photosData.current, isLoading: false, isError: false }),
  useUploadChecklistPhoto: noop,
}))

import { DamagePanel } from "./DamagePanel"

// dano 2 com as fotos A e B; a B sofreu soft delete (sai da lista de fotos ativas)
const damage: ChecklistDamage = {
  id: "d2",
  number: 2,
  panel_key: "porta_diant_e",
  damage_type: "amassado",
  severity: "leve",
  relation: "nao_sei",
  point: null,
  notes: "",
  photo_ids: ["A", "B"],
  photos: [
    { id: "A", url: null },
    { id: "B", url: null },
  ],
  budget_match: "sem_orcamento",
  matched_budget_items: [],
  client_uuid: null,
}

describe("DamagePanel", () => {
  beforeEach(() => {
    photosData.current = [{ id: "A", url: null }]
    createDamage.mockClear()
    patchDamage.mockClear()
  })

  it("escolher Amassado + Moderada e salvar cria o dano naquela peça", async () => {
    render(
      <DamagePanel osId="os-1" panelKey="porta_diant_e" point={null} locked={false} onClose={vi.fn()} />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Amassado" }))
    fireEvent.click(screen.getByRole("button", { name: "Moderada" }))
    fireEvent.click(screen.getByRole("button", { name: "Salvar dano" }))

    expect(createDamage).toHaveBeenCalledWith({
      panel_key: "porta_diant_e",
      damage_type: "amassado",
      severity: "moderada",
      relation: "nao_sei",
    })
  })

  it("editar só a gravidade não reenvia as fotos (a apagada faria o backend recusar)", () => {
    render(<DamagePanel osId="os-1" panelKey={null} point={null} damage={damage} locked={false} onClose={vi.fn()} />)

    expect(screen.getByText("Fotos (1)")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Grave" }))
    fireEvent.click(screen.getByRole("button", { name: "Salvar dano" }))

    expect(patchDamage).toHaveBeenCalledWith({
      id: "d2",
      damage_type: "amassado",
      severity: "grave",
      relation: "nao_sei",
      notes: "",
    })
  })

  it("mexer nas fotos envia só as que estão ativas", () => {
    photosData.current = [
      { id: "A", url: null },
      { id: "C", url: null },
    ]
    render(<DamagePanel osId="os-1" panelKey={null} point={null} damage={damage} locked={false} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: "Usar foto no dano" }))
    fireEvent.click(screen.getByRole("button", { name: "Salvar dano" }))

    expect(patchDamage).toHaveBeenCalledWith(expect.objectContaining({ photo_ids: ["A", "C"] }))
  })
})
