"use client"

import { toast } from "sonner"
import type { PartCatalogReference, TipoQualidade } from "@paddock/types"
import {
  useAddPartCompra,
  useAddPartEstoque,
  useAddPartSeguradora,
} from "@/app/(app)/os/[numero]/_hooks/useOSItems"
import { EstoqueBuscaModal } from "@/components/purchasing/EstoqueBuscaModal"
import { CompraFormModal } from "@/components/purchasing/CompraFormModal"
import { SeguradoraFormModal } from "@/components/purchasing/SeguradoraFormModal"
import { useServiceOrder } from "../../../_hooks/useServiceOrder"

export type PartAddMode = "estoque" | "compra" | "seguradora" | null

export interface CompraPrefill {
  description?: string
  partNumber?: string
  catalogRef?: PartCatalogReference
}

interface PartAddModalsProps {
  orderId: string
  mode: PartAddMode
  /** Fecha (null) ou troca de modal; o estoque passa para "compra" com a peça do catálogo. */
  onModeChange: (mode: PartAddMode, prefill?: CompraPrefill) => void
  compraPrefill?: CompraPrefill
}

/** As três origens de peça (estoque, compra, seguradora): usadas pela aba Peças e pela aba Orçamento. */
export function PartAddModals({ orderId, mode, onModeChange, compraPrefill }: PartAddModalsProps) {
  const { data: osData } = useServiceOrder(orderId)
  const addPartEstoque = useAddPartEstoque(orderId)
  const addPartCompra = useAddPartCompra(orderId)
  const addPartSeguradora = useAddPartSeguradora(orderId)
  const close = () => onModeChange(null)

  async function handleEstoqueSelect(data: {
    unidade_fisica_id: string
    tipo_qualidade: TipoQualidade
    unit_price: string
    description: string
  }) {
    try {
      await addPartEstoque.mutateAsync(data)
      toast.success("Peça adicionada do estoque.")
      close()
    } catch {
      toast.error("Erro ao adicionar peça do estoque.")
    }
  }

  async function handleCompraSubmit(data: {
    description: string
    part_number: string
    tipo_qualidade: TipoQualidade
    unit_price: string
    quantity: string
    observacoes: string
  }) {
    try {
      await addPartCompra.mutateAsync(data)
      toast.success("Peça adicionada para compra.")
      close()
    } catch {
      toast.error("Erro ao adicionar peça para compra.")
    }
  }

  async function handleSeguradoraSubmit(data: {
    description: string
    tipo_qualidade: TipoQualidade
    unit_price: string
    quantity: string
  }) {
    try {
      await addPartSeguradora.mutateAsync(data)
      toast.success("Peça da seguradora adicionada.")
      close()
    } catch {
      toast.error("Erro ao adicionar peça da seguradora.")
    }
  }

  return (
    <>
      <EstoqueBuscaModal
        open={mode === "estoque"}
        onClose={close}
        osId={orderId}
        onSelect={handleEstoqueSelect}
        vehicleMakeName={osData?.make}
        vehicleModelName={osData?.model}
        vehicleLabel={osData ? `${osData.make} ${osData.model} ${osData.year ?? ""}`.trim() : undefined}
        onCatalogSelect={(ref) =>
          onModeChange("compra", {
            description: ref.description,
            partNumber: ref.manufacturer_code,
            catalogRef: ref,
          })
        }
      />
      <CompraFormModal
        open={mode === "compra"}
        onClose={close}
        onSubmit={handleCompraSubmit}
        vehicleMakeName={osData?.make}
        vehicleModelName={osData?.model}
        prefill={compraPrefill}
      />
      <SeguradoraFormModal open={mode === "seguradora"} onClose={close} onSubmit={handleSeguradoraSubmit} />
    </>
  )
}
