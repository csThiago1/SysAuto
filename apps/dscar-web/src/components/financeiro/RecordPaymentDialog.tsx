"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { PaymentMethod } from "@paddock/types";
import { PAYMENT_METHOD_LABELS } from "@paddock/types";

interface RecordPaymentDialogProps {
  /** The document being paid/received */
  document: {
    id: string;
    amount_remaining: string;
    supplier_name?: string;
    customer_name?: string;
    description: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mutation function — called with { documentId, payment_date, amount, payment_method, bank_account?, notes? } */
  onSubmit: (data: {
    documentId: string;
    payment_date: string;
    amount: string;
    payment_method: PaymentMethod;
    bank_account?: string;
    notes?: string;
  }) => void;
  isPending: boolean;
  isError: boolean;
  errorMessage?: string;
  /** "Registrar Pagamento" or "Registrar Recebimento" */
  submitLabel?: string;
  /** "Valor a pagar" or "Valor a receber" */
  amountLabel?: string;
  /** Title: "Registrar Pagamento" or "Registrar Recebimento" */
  title?: string;
}

export function RecordPaymentDialog({
  document,
  open,
  onOpenChange,
  onSubmit,
  isPending,
  isError,
  errorMessage,
  submitLabel = "Registrar Pagamento",
  amountLabel = "Valor a pagar *",
  title = "Registrar Pagamento",
}: RecordPaymentDialogProps) {
  const todayStr = new Date().toISOString().split("T")[0] ?? "";

  const [amount, setAmount] = React.useState("");
  const [paymentDate, setPaymentDate] = React.useState(todayStr);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("pix");
  const [bankAccount, setBankAccount] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (document) {
      setAmount(document.amount_remaining);
      setPaymentDate(todayStr);
      setPaymentMethod("pix");
      setBankAccount("");
      setNotes("");
    }
  }, [document, todayStr]);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!document) return;
    onSubmit({
      documentId: document.id,
      payment_date: paymentDate,
      amount,
      payment_method: paymentMethod,
      bank_account: bankAccount || undefined,
      notes: notes || undefined,
    });
  };

  const entityName = document?.supplier_name ?? document?.customer_name ?? "";
  const paymentMethods = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {document && (
          <p className="text-sm text-muted-foreground -mt-2">
            {entityName} — {document.description}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground/70">{amountLabel}</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground/70">Data do pagamento *</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground/70">Forma de pagamento *</Label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              {paymentMethods.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground/70">Conta bancaria</Label>
            <Input
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="Ex: Bradesco C/C 1234-5"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground/70">Observacoes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Opcional..."
            />
          </div>

          {isError && (
            <p className="text-xs text-error-400 bg-error-500/10 rounded px-3 py-2">
              {errorMessage || "Erro ao registrar."}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-sm text-muted-foreground hover:underline px-3 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Salvando..." : submitLabel}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
