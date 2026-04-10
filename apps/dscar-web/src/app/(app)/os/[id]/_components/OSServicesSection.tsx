"use client";

import React, { useState } from "react";
import { Wrench, Trash2, Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionGate } from "@/components/PermissionGate";
import { useOSLabor, useAddOSLabor, useDeleteOSLabor } from "@/hooks/useServiceOrders";
import { formatCurrency } from "@paddock/utils";
import type { ServiceOrderStatus, ServiceOrderLaborPayload } from "@paddock/types";

const CLOSED_STATUSES: ServiceOrderStatus[] = ["delivered", "cancelled"];

interface OSServicesSectionProps {
  osId: string;
  osStatus: ServiceOrderStatus;
}

interface LaborForm {
  description: string;
  quantity: string;
  unit_price: string;
  discount: string;
}

const EMPTY_FORM: LaborForm = {
  description: "",
  quantity: "1",
  unit_price: "",
  discount: "0",
};

function validateForm(form: LaborForm): string | null {
  if (!form.description.trim()) return "Descrição é obrigatória.";
  const qty = parseFloat(form.quantity);
  if (isNaN(qty) || qty <= 0) return "Quantidade deve ser maior que zero.";
  const price = parseFloat(form.unit_price);
  if (isNaN(price) || price < 0) return "Valor unitário inválido.";
  const disc = parseFloat(form.discount);
  if (!isNaN(disc) && disc > qty * price) return "Desconto não pode exceder o total da linha.";
  return null;
}

export function OSServicesSection({ osId, osStatus }: OSServicesSectionProps): React.ReactElement {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<LaborForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: laborItems = [], isLoading } = useOSLabor(osId);
  const addLabor = useAddOSLabor(osId);
  const deleteLabor = useDeleteOSLabor(osId);
  const isClosed = CLOSED_STATUSES.includes(osStatus);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const err = validateForm(form);
    if (err) { setFormError(err); return; }

    const payload: ServiceOrderLaborPayload = {
      description: form.description,
      quantity: form.quantity,
      unit_price: form.unit_price,
      discount: form.discount || "0",
    };

    addLabor.mutate(payload, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        setShowForm(false);
        setFormError(null);
      },
      onError: () => setFormError("Erro ao adicionar serviço. Tente novamente."),
    });
  };

  const handleDelete = (laborId: string, desc: string): void => {
    if (window.confirm(`Remover serviço "${desc}"? Esta ação não pode ser desfeita.`)) {
      deleteLabor.mutate(laborId);
    }
  };

  const servicesTotal = laborItems.reduce((sum, l) => sum + l.total, 0);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Carregando serviços...</span>
        </div>
      ) : laborItems.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-12 text-neutral-400 gap-2">
          <Wrench className="h-8 w-8" />
          <p className="text-sm">Nenhum serviço adicionado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-600">Descrição</th>
                <th className="text-right px-3 py-2.5 font-medium text-neutral-600">Qtd/Horas</th>
                <th className="text-right px-3 py-2.5 font-medium text-neutral-600">Valor Unit.</th>
                <th className="text-right px-3 py-2.5 font-medium text-neutral-600">Desconto</th>
                <th className="text-right px-3 py-2.5 font-medium text-neutral-600">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {laborItems.map((labor) => (
                <tr key={labor.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2.5 font-medium">{labor.description}</td>
                  <td className="px-3 py-2.5 text-right">{labor.quantity}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(parseFloat(labor.unit_price))}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(parseFloat(labor.discount))}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{formatCurrency(labor.total)}</td>
                  <td className="px-3 py-2.5">
                    <PermissionGate role="CONSULTANT">
                      <button
                        type="button"
                        onClick={() => handleDelete(labor.id, labor.description)}
                        disabled={isClosed || deleteLabor.isPending}
                        title={isClosed ? "OS encerrada — edição bloqueada" : "Remover serviço"}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded text-neutral-400 transition-colors",
                          isClosed
                            ? "opacity-30 cursor-not-allowed"
                            : "hover:bg-red-50 hover:text-red-600"
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </PermissionGate>
                  </td>
                </tr>
              ))}
            </tbody>
            {laborItems.length > 0 && (
              <tfoot className="border-t-2 border-neutral-200 bg-neutral-50">
                <tr>
                  <td colSpan={4} className="px-3 py-2.5 text-right text-sm font-semibold text-neutral-700">
                    Total de Serviços
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-base text-neutral-900">
                    {formatCurrency(servicesTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Formulário inline de adição */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3"
        >
          <p className="text-sm font-medium text-neutral-700">Novo serviço</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input
                name="description"
                placeholder="Descrição *"
                value={form.description}
                onChange={handleChange}
                autoFocus
              />
            </div>
            <Input
              name="quantity"
              placeholder="Qtd / Horas *"
              value={form.quantity}
              onChange={handleChange}
            />
            <Input
              name="unit_price"
              placeholder="Valor / Hora *"
              value={form.unit_price}
              onChange={handleChange}
            />
            <Input
              name="discount"
              placeholder="Desconto (padrão: 0)"
              value={form.discount}
              onChange={handleChange}
            />
          </div>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(null); }}
            >
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={addLabor.isPending}>
              {addLabor.isPending
                ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                : <Plus className="h-4 w-4 mr-1" />
              }
              Adicionar
            </Button>
          </div>
        </form>
      )}

      {/* Botão adicionar */}
      {!showForm && (
        <PermissionGate role="CONSULTANT">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(true)}
            disabled={isClosed}
            title={isClosed ? "OS encerrada — edição bloqueada" : undefined}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Adicionar Serviço
          </Button>
        </PermissionGate>
      )}
    </div>
  );
}
