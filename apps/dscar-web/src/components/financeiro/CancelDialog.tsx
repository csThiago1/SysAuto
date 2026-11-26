"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface CancelDialogProps {
  /** Entity name + amount for display */
  entityName: string;
  amount: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => void;
  isPending: boolean;
  isError: boolean;
  errorMessage?: string;
  /** Rótulos: o mesmo diálogo confirma o estorno de uma baixa */
  title?: string;
  reasonLabel?: string;
  submitLabel?: string;
  pendingLabel?: string;
  reasonMaxLength?: number;
}

export function CancelDialog({
  entityName,
  amount,
  open,
  onOpenChange,
  onSubmit,
  isPending,
  isError,
  errorMessage,
  title = "Cancelar Titulo",
  reasonLabel = "Motivo do cancelamento *",
  submitLabel = "Confirmar Cancelamento",
  pendingLabel = "Cancelando...",
  // 200 é o tamanho da coluna do motivo, no título e na baixa
  reasonMaxLength = 200,
}: CancelDialogProps) {
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    onSubmit(reason);
  };

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            {entityName} — {brl.format(Number(amount))}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground/70">
              {reasonLabel}
            </Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              maxLength={reasonMaxLength}
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-base md:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Informe o motivo..."
            />
          </div>

          {isError && (
            <p className="text-xs text-error-400 bg-error-500/10 rounded px-3 py-2">
              {errorMessage || "Erro ao cancelar titulo."}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-sm text-muted-foreground hover:underline px-3 py-2"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={isPending || !reason.trim()}
              className="rounded-md bg-error-600 px-4 py-2 text-sm font-medium text-foreground hover:bg-error-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? pendingLabel : submitLabel}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
