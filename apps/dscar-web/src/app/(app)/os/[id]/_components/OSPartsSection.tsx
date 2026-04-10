"use client";

import React, { useState } from "react";
import { Package, Trash2, Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionGate } from "@/components/PermissionGate";
import { useOSParts, useAddOSPart, useDeleteOSPart } from "@/hooks/useServiceOrders";
import { formatCurrency } from "@paddock/utils";
import type { ServiceOrderStatus, ServiceOrderPartPayload } from "@paddock/types";

const CLOSED_STATUSES: ServiceOrderStatus[] = ["delivered", "cancelled"];

interface OSPartsSectionProps {
  osId: string;
  osStatus: ServiceOrderStatus;
}

interface PartForm {
  description: string;
  part_number: string;
  quantity: string;
  unit_price: string;
  discount: string;
}

const EMPTY_FORM: PartForm = {
  description: "",
  part_number: "",
  quantity: "1",
  unit_price: "",
  discount: "0",
};

function validateForm(form: PartForm): string | null {
  if (!form.description.trim()) return "Descrição é obrigatória.";
  const qty = parseFloat(form.quantity);
  if (isNaN(qty) || qty <= 0) return "Quantidade deve ser maior que zero.";
  const price = parseFloat(form.unit_price);
  if (isNaN(price) || price < 0) return "Preço unitário inválido.";
  const disc = parseFloat(form.discount);
  if (!isNaN(disc) && disc > qty * price) return "Desconto não pode exceder o total da linha.";
  return null;
}

export function OSPartsSection({ osId, osStatus }: OSPartsSectionProps): React.ReactElement {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PartForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: parts = [], isLoading } = useOSParts(osId);
  const addPart = useAddOSPart(osId);
  const deletePart = useDeleteOSPart(osId);
  const isClosed = CLOSED_STATUSES.includes(osStatus);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const err = validateForm(form);
    if (err) { setFormError(err); return; }

    const payload: ServiceOrderPartPayload = {
      description: form.description,
      part_number: form.part_number || undefined,
      quantity: form.quantity,
      unit_price: form.unit_price,
      discount: form.discount || "0",
    };

    addPart.mutate(payload, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
        setShowForm(false);
        setFormError(null);
      },
      onError: () => setFormError("Erro ao adicionar peça. Tente novamente."),
    });
  };

  const handleDelete = (partId: string, desc: string): void => {
    if (window.confirm(`Remover peça "${desc}"? Esta ação não pode ser desfeita.`)) {
      deletePart.mutate(partId);
    }
  };

  const partsTotal = parts.reduce((sum, p) => sum + p.total, 0);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Carregando peças...</span>
        </div>
      ) : parts.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-12 text-neutral-400 gap-2">
          <Package className="h-8 w-8" />
          <p className="text-sm">Nenhuma peça adicionada.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-600">Descrição</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-600">Código</th>
                <th className="text-right px-3 py-2.5 font-medium text-neutral-600">Qtd</th>
                <th className="text-right px-3 py-2.5 font-medium text-neutral-600">Preço Unit.</th>
                <th className="text-right px-3 py-2.5 font-medium text-neutral-600">Desconto</th>
                <th className="text-right px-3 py-2.5 font-medium text-neutral-600">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {parts.map((part) => (
                <tr key={part.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{part.description}</span>
                    {part.product_name && (
                      <span className="block text-xs text-neutral-400">{part.product_name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-neutral-500">{part.part_number || "—"}</td>
                  <td className="px-3 py-2.5 text-right">{part.quantity}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(parseFloat(part.unit_price))}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(parseFloat(part.discount))}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{formatCurrency(part.total)}</td>
                  <td className="px-3 py-2.5">
                    <PermissionGate role="CONSULTANT">
                      <button
                        type="button"
                        onClick={() => handleDelete(part.id, part.description)}
                        disabled={isClosed || deletePart.isPending}
                        title={isClosed ? "OS encerrada — edição bloqueada" : "Remover peça"}
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
            {parts.length > 0 && (
              <tfoot className="border-t-2 border-neutral-200 bg-neutral-50">
                <tr>
                  <td colSpan={5} className="px-3 py-2.5 text-right text-sm font-semibold text-neutral-700">
                    Total de Peças
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-base text-neutral-900">
                    {formatCurrency(partsTotal)}
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
          <p className="text-sm font-medium text-neutral-700">Nova peça</p>
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
              name="part_number"
              placeholder="Código (opcional)"
              value={form.part_number}
              onChange={handleChange}
            />
            <Input
              name="quantity"
              placeholder="Quantidade *"
              value={form.quantity}
              onChange={handleChange}
            />
            <Input
              name="unit_price"
              placeholder="Preço unitário *"
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
            <Button type="submit" size="sm" disabled={addPart.isPending}>
              {addPart.isPending
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
            Adicionar Peça
          </Button>
        </PermissionGate>
      )}
    </div>
  );
}
