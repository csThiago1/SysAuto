"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import type { ServiceOrder } from "@paddock/types"
import { Button } from "@/components/ui/button"
import { SignatureSheet } from "@/components/signatures/SignatureSheet"
import {
  getSignatureCodeConfig,
  type SignatureCodeConfig,
} from "@/components/signatures/signatureCodeMap"
import { useSignatureExists } from "@/hooks/useSignatureExists"
import { useCustomer } from "@/hooks/useCustomer"
import { FallbackResolver } from "./FallbackResolver"
import type { ResolverProps } from "./index"

// Outer component: só decide qual variante renderizar. Sem hooks aqui pra evitar
// rules-of-hooks violation no early return pro Fallback.
export function SignatureResolver({ block, order, onResolved }: ResolverProps) {
  const config = getSignatureCodeConfig(block.code)
  if (!config) {
    return <FallbackResolver block={block} order={order} onResolved={onResolved} />
  }
  return (
    <KnownSignatureResolver config={config} order={order} onResolved={onResolved} />
  )
}

interface KnownProps {
  config: SignatureCodeConfig
  order: ServiceOrder
  onResolved: () => void
}

function KnownSignatureResolver({ config, order, onResolved }: KnownProps) {
  const [open, setOpen] = useState(false)
  const exists = useSignatureExists(order.id, config.documentType)
  const customer = useCustomer(order.customer_uuid ?? "")
  const resolvedFired = useRef(false)

  // Dispara onResolved no máximo uma vez por instância — onResolved do pai
  // pode mudar de identidade a cada re-render sem useCallback.
  useEffect(() => {
    if (exists.data === true && !resolvedFired.current) {
      resolvedFired.current = true
      onResolved()
    }
  }, [exists.data, onResolved])

  if (exists.isLoading) {
    return <div className="text-sm text-muted-foreground">Verificando assinaturas…</div>
  }

  if (exists.data === true) {
    return (
      <div className="text-sm text-success-600 inline-flex items-center gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Assinatura já capturada
      </div>
    )
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Coletar assinatura — {config.label}
      </Button>
      <SignatureSheet
        open={open}
        onOpenChange={setOpen}
        serviceOrderId={order.id}
        documentType={config.documentType}
        title={config.label}
        defaultSignerName={order.customer_name ?? ""}
        defaultSignerCpf={customer.data?.cpf_cnpj ?? ""}
        onCaptured={() => onResolved()}
      />
    </>
  )
}
