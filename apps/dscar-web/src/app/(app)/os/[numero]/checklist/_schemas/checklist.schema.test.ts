import { describe, expect, it } from "vitest"

import { ChecklistDamageSchema, EntryChecklistStateSchema } from "./checklist.schema"

const damage = {
  id: "0b6f8a52-7c1e-4d53-9a6e-3f1c2b4d5e6f",
  number: 1,
  panel_key: "porta_diant_e",
  damage_type: "amassado",
  severity: "moderada",
  relation: "sinistro",
  point: { x: 0.81, y: 0.62, z: 0.4 },
  notes: "Amassado na altura da maçaneta",
  photo_ids: ["5a1e2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b"],
  photos: [{ id: "5a1e2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b", url: "https://cdn.example/foto.jpg" }],
  budget_match: "no_orcamento",
  matched_budget_items: [12, 15],
  client_uuid: null,
}

describe("ChecklistDamageSchema", () => {
  it("aceita o payload completo do backend", () => {
    expect(ChecklistDamageSchema.parse(damage)).toEqual(damage)
  })

  it('rejeita gravidade fora da taxonomia ("media")', () => {
    expect(() => ChecklistDamageSchema.parse({ ...damage, severity: "media" })).toThrow()
  })
})

const state = {
  id: "7d2f1e0a-1b2c-4d3e-8f90-a1b2c3d4e5f6",
  body_type: "",
  suggested_body_type: "sedan",
  stops_done: { frente: "done", teto: "sem_dano" },
  finalized_at: null,
  version: 1,
  signature_status: "pendente",
  pdf_url: null,
  vehicle_color_hex: "#9a9a9a",
  customer_type: "insurer",
  items_summary: { ok: 3, attention: 1, critical: 0, pending: 2 },
  vehicle_make: "chevrolet",
  vehicle_family: null,
  allow_nc_models: false,
}

describe("EntryChecklistStateSchema", () => {
  it('body_type "" (checklist novo) vira null', () => {
    expect(EntryChecklistStateSchema.parse(state).body_type).toBeNull()
  })

  it.each([null, ""])("customer_type %j (OS sem tipo, ex.: migrada do Databox) vira null", (v) => {
    expect(EntryChecklistStateSchema.parse({ ...state, customer_type: v }).customer_type).toBeNull()
  })
})
