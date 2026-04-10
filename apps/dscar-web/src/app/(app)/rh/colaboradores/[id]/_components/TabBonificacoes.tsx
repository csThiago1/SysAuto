"use client";

/**
 * TabBonificacoes — Bonificações do colaborador por mês.
 */

import React from "react";
import type { Employee, CreateBonusPayload, BonusType } from "@paddock/types";
import { BONUS_TYPE_LABELS } from "@paddock/types";
import { useEmployeeBonuses, useCreateBonus } from "@/hooks";
import { Skeleton } from "@/components/ui";

interface TabBonificacoesProps {
  employee: Employee;
}

export function TabBonificacoes({
  employee,
}: TabBonificacoesProps): React.ReactElement {
  const { data, isLoading } = useEmployeeBonuses(employee.id);
  const create = useCreateBonus(employee.id);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState<CreateBonusPayload>({
    bonus_type: "performance",
    description: "",
    amount: 0,
    reference_month: new Date().toISOString().slice(0, 7) + "-01",
  });

  const bonuses = data?.results ?? [];

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    create.mutate(form, { onSuccess: () => setShowForm(false) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-neutral-900">
          Bonificações ({bonuses.length})
        </h3>
        <button
          onClick={() => setShowForm((p) => !p)}
          className="text-xs font-medium text-primary-600 hover:underline"
        >
          + Adicionar bônus
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-md bg-white shadow-card p-card-padding space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">Tipo</label>
              <select
                value={form.bonus_type}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    bonus_type: e.target.value as BonusType,
                  }))
                }
                className="rounded border border-neutral-200 px-2 py-1.5 text-sm"
              >
                {(Object.entries(BONUS_TYPE_LABELS) as [BonusType, string][]).map(
                  ([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  )
                )}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                className="rounded border border-neutral-200 px-2 py-1.5 text-sm"
                value={form.amount || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, amount: parseFloat(e.target.value) }))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">Mês referência</label>
              <input
                type="month"
                required
                className="rounded border border-neutral-200 px-2 py-1.5 text-sm"
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
              <label className="text-xs text-neutral-500">Descrição</label>
              <input
                type="text"
                required
                className="rounded border border-neutral-200 px-2 py-1.5 text-sm"
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
              className="text-xs text-neutral-500 hover:underline"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {create.isPending ? "Salvando..." : "Registrar bônus"}
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
      ) : bonuses.length === 0 ? (
        <div className="rounded-md bg-white shadow-card p-8 text-center text-sm text-neutral-500">
          Nenhuma bonificação registrada.
        </div>
      ) : (
        <div className="rounded-md bg-white shadow-card divide-y divide-neutral-100">
          {bonuses.map((b) => (
            <div key={b.id} className="flex items-center justify-between px-card-padding py-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {BONUS_TYPE_LABELS[b.bonus_type]} — {b.description}
                </p>
                <p className="text-xs text-neutral-500">
                  Ref:{" "}
                  {new Date(b.reference_month).toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <span className="text-sm font-semibold text-success-700">
                +{" "}
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(parseFloat(b.amount))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
