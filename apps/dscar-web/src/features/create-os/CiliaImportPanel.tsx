"use client";

import React, { useState } from "react";
import { CloudDownload, Loader2 } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type CiliaData = {
  plate: string;
  make: string;
  model: string;
  year?: number;
  color?: string;
  client_name?: string;
  client_document?: string;
};

interface CiliaImportPanelProps {
  onImportSuccess: (data: CiliaData) => void;
}

export function CiliaImportPanel({ onImportSuccess }: CiliaImportPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sinistro, setSinistro] = useState("");
  const [orcamento, setOrcamento] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      return apiFetch<any>("/api/v1/cilia/consultar/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sinistro, orcamento }),
      });
    },
    onSuccess: (response: any) => {
      toast.success("Orçamento Cilia importado com sucesso!");
      const data = response.data || response;
      onImportSuccess({
        plate: data.placa || data.license_plate || "",
        make: data.veiculo?.split(" ")[0] || data.vehicle_brand || "",
        model: data.veiculo?.substring(data.veiculo?.indexOf(" ") + 1) || data.vehicle_model || "",
        color: data.vehicle_color || "",
        year: data.vehicle_year || undefined,
        client_name: data.cliente || data.client_name || "",
        client_document: data.client_document || "",
      });
      setIsOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.erro || err.message || "Erro ao consultar orçamento no Cilia.");
    },
  });

  if (!isOpen) {
    return (
      <Button 
        type="button" 
        variant="outline" 
        className="w-full justify-center border-dashed border-2 py-6 text-white/50 hover:text-primary-600 hover:border-primary-300"
        onClick={() => setIsOpen(true)}
      >
        <CloudDownload className="mr-2 h-5 w-5" />
        Importar Dados do Cilia Web Service
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 space-y-4 animate-in fade-in">
      <div className="flex items-center gap-2 text-primary-800 font-medium">
        <CloudDownload className="h-5 w-5" />
        Consultar Orçamento Cilia
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nº do Sinistro <span className="text-error-500">*</span></Label>
          <Input 
            value={sinistro} 
            onChange={e => setSinistro(e.target.value)} 
            placeholder="Ex: 406571903" 
            className="bg-card"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Nº do Orçamento <span className="text-error-500">*</span></Label>
          <Input 
            value={orcamento} 
            onChange={e => setOrcamento(e.target.value)} 
            placeholder="Ex: 1446508.2" 
            className="bg-card"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} disabled={isPending}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => mutate()} disabled={isPending || !sinistro || !orcamento}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Buscar e Preencher Form
        </Button>
      </div>
    </div>
  );
}
