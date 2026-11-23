"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { toast } from "sonner";
import { v7 as uuidv7 } from "uuid";
import { ArrowLeft, ArrowRight, FileText, Loader2 } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PhotoCaptureGrid } from "@/components/photos/PhotoCaptureGrid";
import { newOSSchema, toCreatePayload, type NewOSInput } from "../os/_components/new-os.schema";
import { useServiceOrderCreate } from "../os/[numero]/_hooks/useServiceOrder";
import { useCreateBudget } from "@/hooks/useBudgets";
import { PlacaMercosul } from "@/components/vehicle/PlacaMercosul";
import { StepCliente } from "./_components/StepCliente";
import { StepPlaca } from "./_components/StepPlaca";
import { cn } from "@/lib/utils";

const STEPS = ["Placa", "Cliente", "Fotos", "Confirmar"] as const;

/** Campos validados antes de avançar cada passo. */
const STEP_FIELDS: Array<Array<keyof NewOSInput>> = [
  ["plate", "catalog_selection"],
  ["customer_type", "customer_name", "insurer", "insured_type"],
  [],
  [],
];

export default function RecepcaoPage(): React.ReactElement {
  const router = useRouter();
  const createMutation = useServiceOrderCreate();
  const createBudget = useCreateBudget();
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
      catalog_selection: null,
      year_manufacture: null,
      color: "",
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
      const os = await createMutation.mutateAsync(toCreatePayload(data));
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
    // segue direto pro checklist de entrada (conferência 3D + assinatura)
    router.push(`/os/${osNumber}/checklist` as Route);
  }

  /** Carro conhecido: tudo do passo 1 e 2 já veio da última OS — vai direto confirmar. */
  async function abrirDireto(): Promise<void> {
    const ok = await form.trigger([...STEP_FIELDS[0], ...STEP_FIELDS[1]]);
    if (ok) setStep(STEPS.length - 1);
    else setStep(1);
  }

  /** Mesmos dados, sem abrir OS: vira orçamento particular (cliente que não deixa o carro). */
  async function handleSoOrcamento(data: NewOSInput): Promise<void> {
    const family = data.catalog_selection?.family;
    if (!data.customer_id || !family) return;
    try {
      const budget = await createBudget.mutateAsync({
        customer_id: data.customer_id,
        vehicle_plate: data.plate,
        catalog_family: family.id,
        catalog_version: data.catalog_selection?.version?.id ?? null,
        vehicle_color: data.color || "NAO_INFORMADA",
        vehicle_year_manufacture: data.year_manufacture ?? null,
        vehicle_chassis: data.chassis ?? "",
      });
      toast.success(`Orçamento ${budget.number} criado.`);
      router.push(`/orcamentos-particulares/${budget.id}` as Route);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar orçamento.");
    }
  }

  const values = form.watch();
  const busy = form.formState.isSubmitting || uploading !== null;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 px-0 pb-6">
      <PageHeader title="Nova OS" backHref="/dashboard" />

      {/* Setores da volta: o passo atual acende em cima, os feitos ficam brancos. */}
      <ol className="grid grid-cols-4 border-y border-border" aria-label="Passos da Nova OS">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "border-r border-border px-2 py-2 font-cond text-[15px] font-bold uppercase tracking-[0.02em] last:border-r-0",
              i === step
                ? "text-foreground shadow-[inset_0_3px_0_hsl(var(--primary))]"
                : i < step
                  ? "text-foreground/80"
                  : "text-muted-foreground",
            )}
          >
            {label}
          </li>
        ))}
      </ol>

      <FormProvider {...form}>
        <div>
          {step === 0 && <StepPlaca onAbrirDireto={() => void abrirDireto()} />}
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
            <dl className="space-y-3 text-[15px]">
              <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
                <PlacaMercosul plate={values.plate} size="md" />
                <span className="font-cond text-[22px] font-bold uppercase leading-tight">
                  {values.catalog_selection?.make.label} {values.catalog_selection?.family?.label}
                </span>
              </div>
              <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3">
                <dt className="label-mono self-center">Cliente</dt>
                <dd className="min-w-0 truncate">{values.customer_name}</dd>
              </div>
              <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3">
                <dt className="label-mono self-center">Atendimento</dt>
                <dd>{values.customer_type === "insurer" ? "Seguradora" : "Particular"}</dd>
              </div>
              <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3">
                <dt className="label-mono self-center">Fotos</dt>
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

      {step === STEPS.length - 1 && values.customer_type === "private" && values.customer_id && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="order-last w-full"
          disabled={busy || createBudget.isPending}
          onClick={() => void form.handleSubmit(handleSoOrcamento)()}
        >
          {createBudget.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Só orçamento (cliente não deixa o carro)
        </Button>
      )}

      <div className="flex gap-2">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-1"
            disabled={busy}
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" size="lg" className="flex-1" onClick={() => void next()}>
            Avançar
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
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
