"use client";

import React from "react";
import { toast } from "sonner";
import type { PaymentMethod } from "@paddock/types";
import { PAYMENT_METHOD_LABELS } from "@paddock/types";
import { todayISO } from "@paddock/utils";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

interface ReceiveBatchDialogProps {
  /** Quantos títulos estão selecionados */
  count: number;
  /** "N títulos · R$ soma", o mesmo texto da barra de seleção */
  summary: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    receipt_date: string;
    payment_method: PaymentMethod;
    bank_account?: string;
    notes?: string;
  }) => void;
  isPending: boolean;
  isError: boolean;
  errorMessage?: string;
}

const paymentMethods = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][];

export function ReceiveBatchDialog({
  count,
  summary,
  open,
  onOpenChange,
  onSubmit,
  isPending,
  isError,
  errorMessage,
}: ReceiveBatchDialogProps) {
  const [receiptDate, setReceiptDate] = React.useState(todayISO());
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("pix");
  const [bankAccount, setBankAccount] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setReceiptDate(todayISO());
      setPaymentMethod("pix");
      setBankAccount("");
      setNotes("");
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    // DateField é um botão: o navegador não barra o envio com a data vazia.
    if (!receiptDate) {
      toast.error("Informe a data do recebimento.");
      return;
    }
    onSubmit({
      receipt_date: receiptDate,
      payment_method: paymentMethod,
      bank_account: bankAccount || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receber selecionados</DialogTitle>
          <p className="text-sm text-foreground pt-1">{summary}</p>
          <p className="text-xs text-muted-foreground">
            Cada título é baixado pelo saldo, todos com a mesma data, forma e conta.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground/70">Data do recebimento *</Label>
            <DateField value={receiptDate} onChange={setReceiptDate} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground/70">Forma de recebimento *</Label>
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
            <Label className="text-xs font-medium text-foreground/70">Conta bancária</Label>
            <Input
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="Ex: Bradesco C/C 1234-5"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground/70">Observações</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-base md:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Opcional..."
            />
          </div>

          {isError && (
            <p role="alert" className="text-xs text-error-400 bg-error-500/10 rounded px-3 py-2">
              {errorMessage || "Erro ao registrar os recebimentos."}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || count === 0}>
              {isPending
                ? "Salvando..."
                : `Receber ${count} título${count !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
