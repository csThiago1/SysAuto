"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { v7 as uuidv7 } from "uuid";
import { apiFetch, fetchList } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { SignaturePadDialog } from "@/components/signature/SignaturePadDialog";

const API = "/api/proxy";

interface SignatureRead {
  id: string;
  document_type: string;
  signer_name: string;
  signed_at: string;
}

interface SignatureSectionProps {
  osId: string;
  customerName: string;
  /** VISTORIA_ENTRADA (entrada) ou OS_DELIVERY (saída) */
  documentType: "VISTORIA_ENTRADA" | "OS_DELIVERY";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Falha ao ler assinatura"));
    reader.readAsDataURL(file);
  });
}

export function SignatureSection({
  osId,
  customerName,
  documentType,
}: SignatureSectionProps): React.ReactElement {
  const qc = useQueryClient();
  const [padOpen, setPadOpen] = useState(false);
  const queryKey = ["os-signatures", osId, documentType];

  const { data: signatures } = useQuery<SignatureRead[]>({
    queryKey,
    queryFn: () =>
      fetchList<SignatureRead>(
        `${API}/signatures/?service_order=${osId}&document_type=${documentType}`
      ),
  });

  const capture = useMutation({
    mutationFn: async (file: File) => {
      const png = await fileToBase64(file);
      return apiFetch(`${API}/signatures/capture/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_type: documentType,
          method: "CANVAS_TABLET",
          signer_name: customerName,
          signature_png_base64: png,
          service_order_id: osId,
          client_uuid: uuidv7(),
        }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey });
      toast.success("Assinatura registrada.");
    },
    onError: () => toast.error("Erro ao registrar assinatura. Tente novamente."),
  });

  const signed = (signatures ?? []).length > 0;

  return (
    <div className="rounded-[11px] bg-card px-3 py-2.5">
      {signed ? (
        <p className="flex items-center gap-2 text-sm text-success-400">
          <CheckCircle2 className="h-4 w-4" />
          Assinado por {signatures?.[0]?.signer_name}
        </p>
      ) : (
        <Button
          className="w-full"
          disabled={capture.isPending}
          onClick={() => setPadOpen(true)}
        >
          <PenLine className="mr-2 h-4 w-4" />
          Coletar assinatura do cliente
        </Button>
      )}
      <SignaturePadDialog
        open={padOpen}
        onClose={() => setPadOpen(false)}
        title={`Assinatura — ${customerName}`}
        onConfirm={(file) => {
          setPadOpen(false);
          capture.mutate(file);
        }}
      />
    </div>
  );
}
