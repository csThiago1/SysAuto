"use client";

import React, { useState } from "react";
import { CloudDownload, Loader2 } from "lucide-react";
import { Button, Input, Label, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface CiliaUpdateModalProps {
  osId: string;
  defaultCasualtyNumber?: string;
}

export function CiliaUpdateModal({ osId, defaultCasualtyNumber }: CiliaUpdateModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sinistro, setSinistro] = useState(defaultCasualtyNumber || "");
  const [orcamento, setOrcamento] = useState("");
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      return apiFetch<any>(`/api/v1/service-orders/${osId}/import-cilia/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sinistro, orcamento }),
      });
    },
    onSuccess: (data) => {
      toast.success(`Orçamento sincronizado! Novo total: ${data.total}`);
      setIsOpen(false);
      // Invalidate so OS data refreshes
      queryClient.invalidateQueries({ queryKey: ["service-orders", osId] });
      queryClient.invalidateQueries({ queryKey: ["service-orders", "history", osId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao consultar orçamento no Cilia.");
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto flex items-center gap-2 border-primary-200 text-primary-700 hover:bg-primary-50">
          <CloudDownload className="h-4 w-4" />
          Importar / Atualizar do Cilia
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sincronizar Orçamento Cilia</DialogTitle>
          <DialogDescription>
            Busca os dados mais recentes do orçamento na Cilia (peças, mão de obra, tempo) e atualiza a OS atual.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-1.5">
            <Label>Nº do Sinistro <span className="text-error-500">*</span></Label>
            <Input 
              value={sinistro} 
              onChange={e => setSinistro(e.target.value)} 
              placeholder="Ex: 406571903" 
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nº do Orçamento <span className="text-error-500">*</span></Label>
            <Input 
              value={orcamento} 
              onChange={e => setOrcamento(e.target.value)} 
              placeholder="Ex: 1446508.2" 
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mutate()} disabled={isPending || !sinistro || !orcamento}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Buscar e Atualizar OS
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
