"use client";

/**
 * TabDescontos — Descontos aplicados por mês.
 * Suporta desconto por valor fixo (R$) ou percentual (% do salário base).
 */

import React from "react";
import type { Employee, CreateDeductionPayload, DeductionType } from "@paddock/types";
import { DEDUCTION_TYPE_LABELS } from "@paddock/types";
import { useEmployeeDeductions, useCreateDeduction } from "@/hooks";
import { Skeleton } from "@/components/ui";

interface TabDescontosProps {
  employee: Employee;
}

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function TabDescontos({ employee }: TabDescontosProps): React.ReactElement {
  const { data, isLoading } = useEmployeeDeductions(employee.id);
  const create = useCreateDeduction(employee.id);
  const [showForm, setShowForm] = React.useState(false);
  const [discountType, setDiscountType] = React.useState<"fixed" | "percentage">("fixed");
  const [form, setForm] = React.useState<CreateDeductionPayload>({
    deduction_type: "inss",
    description: "",
    discount_type: "fixed",
    amount: 0,
    reference_month: new Date().toISOString().slice(0, 7) + "-01",
  });

  const deductions = data?.results ?? [];
  const total = deductions.reduce((s, d) => s + (d.amount ?? 0), 0);

  const handleDiscountTypeChange = (value: "fixed" | "percentage"): void => {
    setDiscountType(value);
    if (value === "fixed") {
      setForm((p) => ({ ...p, discount_type: "fixed", rate: undefined, amount: 0 }));
    } else {
      setForm((p) => ({ ...p, discount_type: "percentage", amount: undefined, rate: 0 }));
    }
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    create.mutate(form, { onSuccess: () => setShowForm(false) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">
          Descontos ({deductions.length})
        </h3>
        <button
          onClick={() => setShowForm((p) => !p)}
          className="text-xs font-medium text-primary-600 hover:underline"
        >
          + Adicionar desconto
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-md bg-white/5 shadow-card p-card-padding space-y-3"
        >
          {/* Tipo de desconto toggle */}
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                checked={discountType === "fixed"}
                onChange={() => handleDiscountTypeChange("fixed")}
              />
              Valor Fixo
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                checked={discountType === "percentage"}
                onChange={() => handleDiscountTypeChange("percentage")}
              />
              Percentual
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Tipo</label>
              <select
                value={form.deduction_type}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    deduction_type: e.target.value as DeductionType,
                  }))
                }
                className="rounded border border-white/10 px-2 py-1.5 text-sm"
              >
                {(
                  Object.entries(DEDUCTION_TYPE_LABELS) as [DeductionType, string][]
                ).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {discountType === "fixed" ? (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/50">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="rounded border border-white/10 px-2 py-1.5 text-sm"
                  value={form.amount ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, amount: parseFloat(e.target.value) }))
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/50">Taxa (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  required
                  className="rounded border border-white/10 px-2 py-1.5 text-sm"
                  value={form.rate ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, rate: parseFloat(e.target.value) }))
                  }
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Mês referência</label>
              <input
                type="month"
                required
                className="rounded border border-white/10 px-2 py-1.5 text-sm"
                value={form.reference_month.slice(0, 7)}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    reference_month: e.target.value + "-01",
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Descrição</label>
              <input
                type="text"
                required
                className="rounded border border-white/10 px-2 py-1.5 text-sm"
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-white/50 hover:underline"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {create.isPending ? "Salvando..." : "Registrar desconto"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : deductions.length === 0 ? (
        <div className="rounded-md bg-white/5 shadow-card p-8 text-center text-sm text-white/50">
          Nenhum desconto registrado.
        </div>
      ) : (
        <>
          <div className="rounded-md bg-white/5 shadow-card divide-y divide-neutral-100">
            {deductions.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between px-card-padding py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white">
                      {DEDUCTION_TYPE_LABELS[d.deduction_type]} — {d.description}
                    </p>
                    <span
                      className={
                        d.discount_type === "percentage"
                          ? "rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700"
                          : "rounded-full px-2 py-0.5 text-xs font-medium bg-white/5 text-white/60"
                      }
                    >
                      {d.discount_type === "percentage" ? "Percentual" : "Fixo"}
                    </span>
                  </div>
                  <p className="text-xs text-white/50">
                    Ref:{" "}
                    {new Date(d.reference_month).toLocaleDateString("pt-BR", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span className="text-sm font-semibold text-red-600 shrink-0">
                  −{" "}
                  {d.discount_type === "percentage" && d.rate !== null
                    ? `${d.rate}% do salário`
                    : d.amount !== null
                    ? fmt.format(d.amount)
                    : "—"}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <span className="text-sm font-semibold text-white/70">
              Total fixo:{" "}
              {fmt.format(total)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
