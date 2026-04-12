"use client"

import { useState } from "react"
import { useExperts, useExpertCreate } from "../../_hooks/useExperts"
import type { Expert } from "@paddock/types"

interface ExpertComboboxProps {
  value: string | null
  onChange: (expertId: string | null, expert: Expert | null) => void
  insurerId?: string | null
  disabled?: boolean
}

export function ExpertCombobox({ value, onChange, insurerId, disabled }: ExpertComboboxProps) {
  const [search, setSearch] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const { data } = useExperts(insurerId ?? undefined, search)
  const createMutation = useExpertCreate()
  const experts = data?.results ?? []
  const selected = experts.find((e) => e.id === value) ?? null

  async function handleCreate() {
    if (!newName.trim()) return
    const expert = await createMutation.mutateAsync({
      name: newName.trim(),
      phone: newPhone.trim(),
      insurer_ids: insurerId ? [insurerId] : [],
    })
    onChange(expert.id, expert)
    setShowCreate(false)
    setNewName("")
    setNewPhone("")
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Buscar perito..."
            className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={selected ? selected.name : search}
            onChange={(e) => {
              setSearch(e.target.value)
              if (value) onChange(null, null)
            }}
            disabled={disabled}
          />
          {search && !selected && experts.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg">
              {experts.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="flex w-full items-start px-3 py-2 text-left text-sm hover:bg-gray-50"
                  onClick={() => {
                    onChange(e.id, e)
                    setSearch("")
                  }}
                >
                  <span className="font-medium">{e.name}</span>
                  {e.phone && <span className="ml-2 text-gray-500 text-xs">{e.phone}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="shrink-0 rounded-md border border-dashed border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:border-gray-400 hover:bg-gray-50"
          title="Cadastrar novo perito"
        >
          + Novo
        </button>
      </div>

      {showCreate && (
        <div className="rounded-md border border-dashed bg-gray-50 p-3 space-y-2">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Novo perito</p>
          <input
            type="text"
            placeholder="Nome *"
            className="flex h-8 w-full rounded-md border border-input bg-white px-3 py-1 text-sm"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Telefone"
            className="flex h-8 w-full rounded-md border border-input bg-white px-3 py-1 text-sm"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded px-3 py-1 text-xs text-gray-600 hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || createMutation.isPending}
              className="rounded bg-[#ea0e03] px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
