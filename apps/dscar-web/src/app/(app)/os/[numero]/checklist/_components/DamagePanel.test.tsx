import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

const { createDamage, noop } = vi.hoisted(() => ({
  createDamage: vi.fn().mockResolvedValue({}),
  noop: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock("../_hooks/useEntryChecklist", () => ({
  useCreateDamage: () => ({ mutateAsync: createDamage, isPending: false }),
  usePatchDamage: noop,
  useDeactivateDamage: noop,
}))
vi.mock("../_hooks/useChecklistPhotos", () => ({
  useChecklistPhotos: () => ({ data: [], isLoading: false, isError: false }),
  useUploadChecklistPhoto: noop,
}))

import { DamagePanel } from "./DamagePanel"

describe("DamagePanel", () => {
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
})
