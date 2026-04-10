"use client";

/**
 * TabSalario — Histórico de reajustes salariais.
 * Registros imutáveis — correções via novo reajuste.
 */

import React from "react";
import { TrendingUp } from "lucide-react";
import type { Employee, CreateSalaryHistoryPayload } from "@paddock/types";
import { useSalaryHistory, useCreateSalaryHistory } from "@/hooks";
import { Skeleton } from "@/components/ui";

interface TabSalarioProps {
  employee: Employee;
}

export function TabSalario({ employee }: TabSalarioProps): React.ReactElement {
  const { data, isLoading } = useSalaryHistory(employee.id);
  const create = useCreateSalaryHistory(employee.id);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState<CreateSalaryHistoryPayload>({
    previous_salary: parseFloat(employee.base_salary),
    new_salary: 0,
    effective_date: "",
    reason: "",
  });

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    create.mutate(form, { onSuccess: () => setShowForm(false) });
  };

  const historyItems = data?.results ?? [];

  return (
    <div className="space-y-5">
      {/* Current salary */}
      <div className="rounded-md bg-white shadow-card p-card-padding">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
              Salário base atual
            </p>
            <p className="mt-1 text-2xl font-bold text-neutral-900 font-plate">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(parseFloat(employee.base_salary))}
            </p>
          </div>
          <button
            onClick={() => setShowForm((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Novo reajuste
          </button>
        </div>
      </div>

      {/* Reajuste form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-md bg-white shadow-card p-card-padding space-y-4"
        >
          <h3 className="text-sm font-semibold text-neutral-900">
            Registrar reajuste
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">
                Salário anterior (R$)
              </label>
              <input
                type="number"
                step="0.01"
                required
                className="rounded border border-neutral-200 px-2 py-1.5 text-sm"
                value={form.previous_salary}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    previous_salary: parseFloat(e.target.value),
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">
                Novo salário (R$)
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0.01"
                className="rounded border border-neutral-200 px-2 py-1.5 text-sm"
                value={form.new_salary || ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    new_salary: parseFloat(e.target.value),
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">
                Data de vigência
              </label>
              <input
                type="date"
                required
                className="rounded border border-neutral-200 px-2 py-1.5 text-sm"
                value={form.effective_date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, effective_date: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">Motivo</label>
              <input
                type="text"
                placeholder="Promoção, dissídio, mérito..."
                className="rounded border border-neutral-200 px-2 py-1.5 text-sm"
                value={form.reason ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, reason: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-neutral-500 hover:underline"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {create.isPending ? "Salvando..." : "Confirmar reajuste"}
            </button>
          </div>
        </form>
      )}

      {/* History */}
      <div className="rounded-md bg-white shadow-card overflow-hidden">
        <div className="px-card-padding py-3 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-900">
            Histórico de reajustes
          </h3>
        </div>
        {isLoading ? (
          <div className="p-card-padding space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : historyItems.length === 0 ? (
          <div className="px-card-padding py-8 text-center text-sm text-neutral-500">
            Nenhum reajuste registrado.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {historyItems.map((item, index) => {
              const diff =
                parseFloat(item.new_salary) - parseFloat(item.previous_salary);
              const pct =
                parseFloat(item.previous_salary) > 0
                  ? (diff / parseFloat(item.previous_salary)) * 100
                  : 0;
              return (
                <div key={item.id} className="px-card-padding py-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-900">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(parseFloat(item.new_salary))}
                      </span>
                      {diff > 0 && (
                        <span className="text-xs text-success-600 font-medium">
                          +{pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Anterior:{" "}
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(parseFloat(item.previous_salary))}
                      {item.reason && ` · ${item.reason}`}
                    </p>
                    {item.authorized_by_name && (
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Autorizado por {item.authorized_by_name}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-neutral-400 shrink-0">
                    {new Date(item.effective_date).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
