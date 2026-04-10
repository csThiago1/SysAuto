"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Calendar, Clock, Edit3, X, Check } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type DateFieldInfo = {
  key: string;
  label: string;
  type: "date" | "datetime-local";
  description?: string;
};

const MILESTONES: DateFieldInfo[] = [
  { key: "opened_at", label: "Abertura da OS", type: "datetime-local" },
  { key: "survey_date", label: "Vistoria Inicial Secundária", type: "date" },
  { key: "scheduling_date", label: "Data de Agendamento", type: "datetime-local" },
  { key: "entry_date", label: "Entrada na Oficina", type: "datetime-local" },
  { key: "authorization_date", label: "Aprovação / Autorização", type: "datetime-local" },
  { key: "estimated_delivery_date", label: "Previsão de Entrega", type: "date" },
  { key: "final_survey_date", label: "Vistoria Final", type: "datetime-local" },
  { key: "client_delivery_date", label: "Entrega do Veículo", type: "datetime-local" },
];

export function OSDatesTimeline({ os }: { os: any }) {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: async (payload: Record<string, string | null>) => {
      return apiFetch(`/api/v1/service-orders/${os.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success("Data atualizada com sucesso!");
      setEditingKey(null);
      queryClient.invalidateQueries({ queryKey: ["service-orders", os.id] });
      queryClient.invalidateQueries({ queryKey: ["service-orders", "history", os.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao atualizar a data.");
    },
  });

  const handleEdit = (field: DateFieldInfo) => {
    const rawVal = os[field.key];
    if (!rawVal) {
      setEditValue("");
    } else {
      // Force local formatting for input default values to avoid timezone shifts
      // "2024-05-10T14:30:00Z" -> "2024-05-10T10:30" (Manaus)
      try {
        const d = new Date(rawVal);
        if (field.type === "date") {
          setEditValue(d.toISOString().split("T")[0] || "");
        } else {
           // For datetime-local format is YYYY-MM-DDThh:mm
           const year = d.getFullYear();
           const month = String(d.getMonth() + 1).padStart(2, '0');
           const day = String(d.getDate()).padStart(2, '0');
           const hours = String(d.getHours()).padStart(2, '0');
           const min = String(d.getMinutes()).padStart(2, '0');
           setEditValue(`${year}-${month}-${day}T${hours}:${min}`);
        }
      } catch {
        setEditValue("");
      }
    }
    setEditingKey(field.key);
  };

  const handleSave = (key: string) => {
    const payloadVal = editValue ? (editValue.length === 10 ? `${editValue}T00:00:00` : new Date(editValue).toISOString()) : null;
    mutate({ [key]: payloadVal });
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Datas e Lançamentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-4 border-l-2 border-neutral-100 space-y-6">
          {MILESTONES.map((milestone) => {
             const rawVal = os[milestone.key];
             const isFilled = !!rawVal;
             const isEditing = editingKey === milestone.key;
             const readonly = milestone.key === "opened_at";

             return (
               <div key={milestone.key} className="relative group">
                 {/* Dot Timeline */}
                 <div className={cn(
                   "absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2",
                   isFilled ? "bg-primary-500 border-primary-500" : "bg-white border-neutral-300"
                 )} />
                 
                 <div className="flex justify-between items-start gap-4">
                   <div className="flex flex-col">
                     <p className="text-sm font-medium text-neutral-900 group-hover:text-primary-700 transition">
                       {milestone.label}
                     </p>
                     {!isEditing && (
                       <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                         {isFilled ? (
                           <>
                             {milestone.type === "datetime-local" ? <Clock className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                             {format(new Date(rawVal), milestone.type === "datetime-local" ? "dd/MM/yyyy 'às' HH:mm" : "dd/MM/yyyy", { locale: ptBR })}
                           </>
                         ) : (
                           <span className="text-neutral-400 italic">Pendente</span>
                         )}
                       </p>
                     )}
                   </div>

                   {/* Editor */}
                   {isEditing ? (
                     <div className="flex items-center gap-2">
                       <Input 
                         type={milestone.type} 
                         value={editValue} 
                         onChange={e => setEditValue(e.target.value)} 
                         className="h-8 text-xs py-1"
                       />
                       <Button size="icon" variant="ghost" className="h-8 w-8 text-success-600" onClick={() => handleSave(milestone.key)} disabled={isPending}>
                         {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                       </Button>
                       <Button size="icon" variant="ghost" className="h-8 w-8 text-neutral-400 hover:text-error-600" onClick={() => setEditingKey(null)} disabled={isPending}>
                         <X className="h-4 w-4" />
                       </Button>
                     </div>
                   ) : (
                     !readonly && (
                       <Button 
                         size="icon" 
                         variant="ghost" 
                         className="h-7 w-7 opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-primary-600 transition"
                         onClick={() => handleEdit(milestone)}
                       >
                         <Edit3 className="h-3.5 w-3.5" />
                       </Button>
                     )
                   )}
                 </div>
               </div>
             );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
