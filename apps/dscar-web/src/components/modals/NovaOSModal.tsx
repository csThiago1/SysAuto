"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ModalProps } from "@paddock/types";

export function NovaOSModal({ open, onOpenChange }: ModalProps): React.ReactElement {
  const router = useRouter();

  function handleConfirm() {
    onOpenChange(false);
    router.push("/service-orders/new");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova Ordem de Serviço</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-white/60 mt-1">
          Você será redirecionado para o formulário de criação de OS.
        </p>
        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/[0.03]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Criar OS
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
