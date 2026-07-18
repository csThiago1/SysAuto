"use client";

import { use, useEffect, useMemo, useState } from "react";
import { drainQueue } from "@/lib/offline/queue";
import { useQuery } from "@tanstack/react-query";
import { v7 as uuidv7 } from "uuid";
import { toast } from "sonner";
import type { ServiceOrder, ServiceOrderPhoto } from "@paddock/types";
import { apiFetch, fetchList } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { PhotoCaptureGrid } from "@/components/photos/PhotoCaptureGrid";
import { cn } from "@/lib/utils";
import { ChecklistSection } from "./_components/ChecklistSection";
import { SignatureSection } from "./_components/SignatureSection";

const API = "/api/proxy";

const SEGMENTS = [
  { value: "entrada", label: "Entrada", folder: "vistoria_inicial", docType: "VISTORIA_ENTRADA" },
  { value: "saida", label: "Saída", folder: "vistoria_final", docType: "OS_DELIVERY" },
] as const;

type Segment = (typeof SEGMENTS)[number];

export default function VistoriaPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}): React.ReactElement {
  const { numero } = use(params);
  const qc = useQueryClient();
  const [segment, setSegment] = useState<Segment>(SEGMENTS[0]);
  const [pendingUploads, setPendingUploads] = useState(0);

  const { data: os } = useQuery<ServiceOrder>({
    queryKey: ["service-orders", numero],
    queryFn: () => apiFetch<ServiceOrder>(`${API}/service-orders/${numero}/`),
  });

  const photosQuery = useQuery<ServiceOrderPhoto[]>({
    queryKey: ["os-photos", os?.id],
    queryFn: () => fetchList<ServiceOrderPhoto>(`${API}/service-orders/${os?.id}/photos/`),
    enabled: Boolean(os?.id),
    // fotos podem chegar pela fila offline (wizard/uploads em background) —
    // sem push do servidor, poll leve mantém a tela viva
    refetchInterval: 6000,
  });

  // cutuca a fila ao abrir a tela: drafts pendentes de foto sobem já
  useEffect(() => {
    void drainQueue();
  }, []);

  const photos = useMemo(
    () => (photosQuery.data ?? []).filter((p) => p.folder === segment.folder),
    [photosQuery.data, segment.folder]
  );

  async function handleAdd(files: File[]): Promise<void> {
    if (!os) return;
    setPendingUploads((n) => n + files.length);
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", segment.folder);
      fd.append("client_uuid", uuidv7());
      try {
        await apiFetch(`${API}/service-orders/${os.id}/photos/`, {
          method: "POST",
          body: fd,
        });
      } catch {
        toast.error("Foto pendente de envio — será sincronizada.");
      }
      setPendingUploads((n) => n - 1);
    }
    void qc.invalidateQueries({ queryKey: ["os-photos", os.id] });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-0">
      <PageHeader
        title="Vistoria"
        description={os ? `${os.plate} · OS ${os.number}` : `OS ${numero}`}
        backHref={`/os/${numero}`}
      />

      {/* Segmento Entrada / Saída */}
      <div
        className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
        role="tablist"
        aria-label="Tipo de vistoria"
      >
        {SEGMENTS.map((seg) => (
          <button
            key={seg.value}
            type="button"
            role="tab"
            aria-selected={segment.value === seg.value}
            onClick={() => setSegment(seg)}
            className={cn(
              "rounded-full py-1.5 text-sm font-medium transition-colors",
              segment.value === seg.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            )}
          >
            {seg.label}
          </button>
        ))}
      </div>

      {/* Fotos */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Fotos ({photos.length}
          {pendingUploads > 0 ? ` · enviando ${pendingUploads}` : ""})
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="aspect-square overflow-hidden rounded-lg bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url ?? undefined}
                alt={p.caption || "Foto da vistoria"}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
        <PhotoCaptureGrid
          photos={[]}
          onAdd={(files) => void handleAdd(files)}
          onRemove={() => undefined}
          disabled={!os || pendingUploads > 0}
        />
      </section>

      {/* Checklist */}
      {os && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Checklist</h2>
          <ChecklistSection osId={os.id} checklistType={segment.value} />
        </section>
      )}

      {/* Assinatura */}
      {os && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Assinatura</h2>
          <SignatureSection
            osId={os.id}
            customerName={os.customer_name ?? "Cliente"}
            documentType={segment.docType}
          />
        </section>
      )}
    </div>
  );
}
