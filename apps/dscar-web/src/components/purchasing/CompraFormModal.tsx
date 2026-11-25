"use client"

import { useState, useEffect } from "react"
import type { TipoQualidade, PartCatalogReference } from "@paddock/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CatalogSearchCombobox } from "./CatalogSearchCombobox"
import { CatalogContextCard } from "./CatalogContextCard"
import { NativeSelect } from "@/components/ui/native-select"

interface CompraFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    description: string
    part_number: string
    tipo_qualidade: TipoQualidade
    unit_price: string
    quantity: string
    observacoes: string
  }) => void
  vehicleMakeName?: string
  vehicleModelName?: string
  prefill?: {
    description?: string
    partNumber?: string
    catalogRef?: PartCatalogReference
  }
}

const TIPO_QUALIDADE_OPTIONS: { value: TipoQualidade; label: string }[] = [
  { value: "genuina", label: "Genuína" },
  { value: "reposicao", label: "Reposição" },
  { value: "similar", label: "Similar" },
  { value: "usada", label: "Usada" },
]

export function CompraFormModal({
  open,
  onClose,
  onSubmit,
  vehicleMakeName,
  vehicleModelName,
  prefill,
}: CompraFormModalProps) {
  const [description, setDescription] = useState("")
  const [partNumber, setPartNumber] = useState("")
  const [tipoQualidade, setTipoQualidade] = useState<TipoQualidade>("genuina")
  const [unitPrice, setUnitPrice] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [observacoes, setObservacoes] = useState("")
  const [catalogRef, setCatalogRef] = useState<PartCatalogReference | null>(null)

  useEffect(() => {
    if (open && prefill) {
      if (prefill.description) setDescription(prefill.description)
      if (prefill.partNumber) setPartNumber(prefill.partNumber)
      if (prefill.catalogRef) setCatalogRef(prefill.catalogRef)
    }
  }, [open, prefill])

  function handleReset() {
    setDescription("")
    setPartNumber("")
    setTipoQualidade("genuina")
    setUnitPrice("")
    setQuantity("1")
    setObservacoes("")
    setCatalogRef(null)
  }

  function handleClose() {
    handleReset()
    onClose()
  }

  function handleCatalogSelect(ref: PartCatalogReference) {
    setDescription(ref.description)
    setPartNumber(ref.manufacturer_code)
    setCatalogRef(ref)
  }

  function handleClearCatalog() {
    setCatalogRef(null)
  }

  function handleSubmit() {
    if (!description || !unitPrice) return
    onSubmit({
      description,
      part_number: partNumber,
      tipo_qualidade: tipoQualidade,
      unit_price: unitPrice,
      quantity,
      observacoes,
    })
    handleReset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar compra de peça</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-foreground/60">
          Um pedido de compra será criado automaticamente para o setor de compras.
        </p>

        <div className="space-y-4">
          {/* Descricao — with catalog search */}
          <div>
            <label className="label-mono text-muted-foreground mb-1.5 block">
              Descrição *
            </label>
            <CatalogSearchCombobox
              value={description}
              onChange={setDescription}
              onSelect={handleCatalogSelect}
              vehicleMakeName={vehicleMakeName}
              vehicleModelName={vehicleModelName}
              placeholder="Buscar no catálogo ou digitar a descrição…"
            />
          </div>

          {/* Catalog context card */}
          {catalogRef && (
            <CatalogContextCard
              reference={catalogRef}
              onClear={handleClearCatalog}
            />
          )}

          {/* Codigo / Referencia */}
          <div>
            <label className="label-mono text-muted-foreground mb-1.5 block">
              Codigo / Referencia
            </label>
            <Input
              type="text"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              placeholder="Ex: 5C6807221GRU, TYC-20-9646"
              className="w-full"
            />
          </div>

          {/* Tipo de peca + Valor cobrado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-mono text-muted-foreground mb-1.5 block">
                Tipo de peça *
              </label>
              <NativeSelect
                value={tipoQualidade}
                onChange={(e) =>
                  setTipoQualidade(e.target.value as TipoQualidade)
                }
              >
                {TIPO_QUALIDADE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <label className="label-mono text-muted-foreground mb-1.5 block">
                Valor cobrado ao cliente *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  type="text"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-9 pr-3"
                />
              </div>
            </div>
          </div>

          {/* Quantidade */}
          <div className="w-24">
            <label className="label-mono text-muted-foreground mb-1.5 block">
              Quantidade
            </label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Observacoes */}
          <div>
            <label className="label-mono text-muted-foreground mb-1.5 block">
              Observações para compras
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Informações para o setor de compras…"
              className="w-full bg-muted/50 border border-border text-foreground rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!description || !unitPrice}>
            Solicitar compra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
