"use client";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
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
import { DateField } from "@/components/ui/date-field"
import { todayISO } from "@paddock/utils";
import { toast } from "sonner"

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
  /** Como os rótulos e avisos chamam a operação */
  noun?: "pagamento" | "recebimento";
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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
  noun = "pagamento",
}: RecordPaymentDialogProps) {
  const todayStr = todayISO();

  const [amount, setAmount] = React.useState("");
  const [paymentDate, setPaymentDate] = React.useState(todayStr);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("pix");
  const [bankAccount, setBankAccount] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // pelo id e pelo saldo, não pelo objeto: quem passa um objeto novo a cada render
  // (o detalhe do título) apagava o que o usuário digitou assim que o servidor recusava
  const documentId = document?.id;
  const remaining = document?.amount_remaining;
  React.useEffect(() => {
    if (open && remaining !== undefined) {
      setAmount(remaining);
      setPaymentDate(todayStr);
      setPaymentMethod("pix");
      setBankAccount("");
      setNotes("");
    }
  }, [open, documentId, remaining, todayStr]);

  // O servidor recusa valor acima do saldo; aqui o aviso chega antes do envio.
  const overBalance =
    document !== null && Number(amount) > Number(document.amount_remaining);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!document) return;
    // O `required` do input nativo era a única validação desta data; o
    // DateField é um botão, então o browser não bloqueia mais o submit.
    if (!paymentDate) {
      toast.error(`Informe a data do ${noun}.`);
      return;
    }
    if (overBalance) return;
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
          {document && (
            <p className="text-sm text-muted-foreground pt-1">
              {entityName} — {document.description}
            </p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground/70">{amountLabel}</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={document?.amount_remaining}
              aria-invalid={overBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            {overBalance && document && (
              <p role="alert" className="text-xs text-error-400">
                O valor passa do saldo do título, que é {brl.format(Number(document.amount_remaining))}.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground/70">Data do {noun} *</Label>
            <DateField value={paymentDate} onChange={setPaymentDate} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground/70">Forma de {noun} *</Label>
            <NativeSelect
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              required
            >
              {paymentMethods.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
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
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-base md:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
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
            <Button
              type="submit"
              disabled={isPending}
            >
              {isPending ? "Salvando..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
