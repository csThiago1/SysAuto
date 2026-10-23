"use client";

/**
 * Fila de retornos ao cliente.
 *
 * Três grupos por vencimento: Vencidos, Hoje, Próximos 7 dias. Cada cartão traz
 * a mensagem já renderizada e os atalhos de contato; as ações encerram ou adiam
 * o retorno.
 */

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Check, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Button,
  Card,
  CardContent,
  Skeleton,
  Textarea,
} from "@/components/ui";
import {
  useCompleteFollowup,
  useFollowups,
  useRescheduleFollowup,
  useSkipFollowup,
  type FollowUp,
  type FollowUpOutcome,
} from "@/hooks/useFollowups";
import { formatDate } from "@paddock/utils";
import { cn } from "@/lib/utils";

const OUTCOME_LABELS: Record<FollowUpOutcome, string> = {
  satisfied: "Cliente satisfeito",
  dissatisfied: "Cliente insatisfeito",
  no_answer: "Não atendeu",
  scheduled_os: "Agendou serviço",
  not_interested: "Sem interesse",
};

export default function RetornosPage(): React.ReactElement {
  return (
    <ErrorBoundary>
      <RetornosContent />
    </ErrorBoundary>
  );
}

function RetornosContent(): React.ReactElement {
  const [onlyMine, setOnlyMine] = useState(false);
  const { data: followups, isLoading, isError } = useFollowups({ onlyMine });

  const groups = useMemo(() => {
    const open = (followups ?? []).filter(
      (f) => f.status === "scheduled" || f.status === "pending"
    );
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const in7Days = new Date(endOfToday);
    in7Days.setDate(in7Days.getDate() + 7);

    return {
      vencidos: open.filter((f) => new Date(f.due_at) < now),
      hoje: open.filter((f) => {
        const due = new Date(f.due_at);
        return due >= now && due <= endOfToday;
      }),
      proximos: open.filter((f) => {
        const due = new Date(f.due_at);
        return due > endOfToday && due <= in7Days;
      }),
    };
  }, [followups]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Não foi possível carregar os retornos.
      </p>
    );
  }

  const total =
    groups.vencidos.length + groups.hoje.length + groups.proximos.length;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <Bell className="h-5 w-5 shrink-0 text-muted-foreground" />
          <h1 className="truncate text-xl font-bold">Retornos</h1>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant={onlyMine ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyMine((v) => !v)}
          >
            Só os meus
          </Button>
        </div>
      </div>

      {total === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhum retorno pendente. Bom sinal.
        </p>
      ) : (
        <>
          <Group title="Vencidos" items={groups.vencidos} tone="danger" />
          <Group title="Hoje" items={groups.hoje} tone="warning" />
          <Group title="Próximos 7 dias" items={groups.proximos} tone="muted" />
        </>
      )}
    </div>
  );
}

function Group({
  title,
  items,
  tone,
}: {
  title: string;
  items: FollowUp[];
  tone: "danger" | "warning" | "muted";
}): React.ReactElement | null {
  if (items.length === 0) return null;

  const toneClass =
    tone === "danger"
      ? "text-danger-500"
      : tone === "warning"
        ? "text-warning-500"
        : "text-muted-foreground";

  return (
    <section className="space-y-2">
      <h2 className={cn("text-xs font-semibold uppercase tracking-wide", toneClass)}>
        {title} · {items.length}
      </h2>
      <div className="space-y-2">
        {items.map((f) => (
          <FollowUpCard key={f.id} followup={f} />
        ))}
      </div>
    </section>
  );
}

function FollowUpCard({ followup }: { followup: FollowUp }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const complete = useCompleteFollowup();
  const reschedule = useRescheduleFollowup();
  const skip = useSkipFollowup();

  const busy = complete.isPending || reschedule.isPending || skip.isPending;

  async function handleComplete(outcome: FollowUpOutcome): Promise<void> {
    try {
      await complete.mutateAsync({ id: followup.id, body: { outcome, notes } });
      toast.success("Retorno concluído.");
      setOpen(false);
    } catch {
      toast.error("Erro ao concluir. Tente novamente.");
    }
  }

  async function handleReschedule(days: number): Promise<void> {
    const due = new Date();
    due.setDate(due.getDate() + days);
    try {
      await reschedule.mutateAsync({
        id: followup.id,
        body: { due_at: due.toISOString() },
      });
      toast.success(`Reagendado para daqui a ${days} dia(s).`);
      setOpen(false);
    } catch {
      toast.error("Erro ao reagendar. Tente novamente.");
    }
  }

  async function handleSkip(): Promise<void> {
    try {
      await skip.mutateAsync({ id: followup.id, body: { notes } });
      toast.success("Retorno dispensado.");
      setOpen(false);
    } catch {
      toast.error("Erro ao dispensar. Tente novamente.");
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 px-3 py-2.5">
        <div className="grid grid-cols-[minmax(0,1fr)_96px] items-start gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">
              {followup.customer_name || "Sem cliente"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {followup.rule_name}
            </span>
            <Link
              href={`/os/${followup.os_number}`}
              className="truncate font-mono text-xs text-primary hover:underline"
            >
              OS #{followup.os_number} · {followup.plate}
            </Link>
          </div>
          <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
            {formatDate(followup.due_at)}
          </span>
        </div>

        <p className="rounded-md bg-muted/40 px-3 py-2 text-xs leading-relaxed text-foreground">
          {followup.message}
        </p>

        {followup.link && (
          <a
            href={followup.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-xs text-primary hover:underline"
          >
            {followup.link}
          </a>
        )}

        {!open ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setOpen(true)} disabled={busy}>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Registrar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReschedule(7)}
              disabled={busy}
            >
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              +7 dias
            </Button>
            <Button size="sm" variant="ghost" onClick={handleSkip} disabled={busy}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Dispensar
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="O que o cliente disse? (opcional)"
              rows={2}
            />
            <div className="flex flex-wrap gap-2">
              {(Object.keys(OUTCOME_LABELS) as FollowUpOutcome[]).map((outcome) => (
                <Button
                  key={outcome}
                  size="sm"
                  variant="outline"
                  onClick={() => handleComplete(outcome)}
                  disabled={busy}
                >
                  {OUTCOME_LABELS[outcome]}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
