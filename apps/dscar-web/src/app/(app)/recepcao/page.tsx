"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { toast } from "sonner";
import { v7 as uuidv7 } from "uuid";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PhotoCaptureGrid } from "@/components/photos/PhotoCaptureGrid";
import { newOSSchema, type NewOSInput } from "../os/_components/new-os.schema";
import { useServiceOrderCreate } from "../os/[numero]/_hooks/useServiceOrder";
import { StepCliente } from "./_components/StepCliente";
import { StepPlaca } from "./_components/StepPlaca";
import { cn } from "@/lib/utils";

const STEPS = ["Placa", "Cliente", "Fotos", "Confirmar"] as const;

/** Campos validados antes de avançar cada passo. */
const STEP_FIELDS: Array<Array<keyof NewOSInput>> = [
  ["plate", "make", "model"],
  ["customer_type", "customer_name", "insurer", "insured_type"],
  [],
  [],
];

export default function RecepcaoPage(): React.ReactElement {
  const router = useRouter();
  const createMutation = useServiceOrderCreate();
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);

  const form = useForm<NewOSInput>({
    resolver: zodResolver(newOSSchema),
    defaultValues: {
      customer_type: "private",
      customer_id: null,
      customer_name: "",
      plate: "",
      make: "",
      model: "",
      vehicle_version: "",
      color: "",
      fuel_type: "",
      chassis: "",
    },
  });

  async function next(): Promise<void> {
    const ok = await form.trigger(STEP_FIELDS[step]);
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function handleCreate(data: NewOSInput): Promise<void> {
    let osNumber: number;
    let osId: string;
    try {
      const os = await createMutation.mutateAsync(data);
      osNumber = os.number;
      osId = os.id;
    } catch {
      toast.error("Erro ao criar OS. Tente novamente.");
      return;
    }

    // OS criada — falha de foto não perde a OS (fica na fila offline com retry)
    let failed = 0;
    setUploading({ done: 0, total: photos.length });
    for (let i = 0; i < photos.length; i++) {
      const fd = new FormData();
      fd.append("file", photos[i]);
      fd.append("folder", "vistoria_inicial");
      fd.append("client_uuid", uuidv7());
      try {
        await apiFetch(`/api/proxy/service-orders/${osId}/photos/`, {
          method: "POST",
          body: fd,
        });
      } catch {
        failed++;
      }
      setUploading({ done: i + 1, total: photos.length });
    }

    if (failed > 0) {
      toast.warning(`OS ${osNumber} criada — ${failed} foto(s) pendente(s) de envio.`);
    } else {
      toast.success(`OS ${osNumber} criada.`);
    }
    // segue direto pra vistoria de entrada (checklist + assinatura)
    router.push(`/os/${osNumber}/vistoria` as Route);
  }

  const values = form.watch();
  const busy = form.formState.isSubmitting || uploading !== null;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-0">
      <PageHeader
        title="Recepção"
        description="Nova OS em 4 passos"
        backHref="/dashboard"
      />

      {/* Stepper */}
      <ol className="flex items-center gap-1" aria-label="Progresso">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col items-center gap-1">
            <span
              className={cn(
                "h-1 w-full rounded-full",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
            <span
              className={cn(
                "text-[10px]",
                i === step ? "font-semibold text-primary" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <FormProvider {...form}>
        <div className="rounded-[11px] bg-card px-3 py-3">
          {step === 0 && <StepPlaca />}
          {step === 1 && <StepCliente />}
          {step === 2 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Fotos de entrada do veículo — ficam na vistoria inicial da OS.
              </p>
              <PhotoCaptureGrid
                photos={photos}
                onAdd={(files) => setPhotos((p) => [...p, ...files])}
                onRemove={(i) => setPhotos((p) => p.filter((_, idx) => idx !== i))}
              />
            </div>
          )}
          {step === 3 && (
            <dl className="space-y-2 text-sm">
              <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">Veículo</dt>
                <dd className="min-w-0">
                  <span className="font-mono tabular-nums">{values.plate}</span>
                  {" · "}
                  {values.make} {values.model}
                </dd>
              </div>
              <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="min-w-0 truncate">{values.customer_name}</dd>
              </div>
              <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">Atendimento</dt>
                <dd>{values.customer_type === "insurer" ? "Seguradora" : "Particular"}</dd>
              </div>
              <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">Fotos</dt>
                <dd>{photos.length}</dd>
              </div>
              {uploading && (
                <p className="text-xs text-muted-foreground">
                  Enviando fotos… {uploading.done}/{uploading.total}
                </p>
              )}
            </dl>
          )}
        </div>
      </FormProvider>

      <div className="flex gap-2">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" className="flex-1" onClick={() => void next()}>
            Avançar
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            className="flex-1"
            disabled={busy}
            onClick={() => void form.handleSubmit(handleCreate)()}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar OS
          </Button>
        )}
      </div>
    </div>
  );
}
