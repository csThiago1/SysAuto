"use client";

/**
 * Painel de Metas — Individuais e por setor.
 * Filtros: status, setor. Ação: "Marcar como Atingida".
 */

import React from "react";
import type { GoalStatus, HRDepartment, CreateGoalPayload } from "@paddock/types";
import {
  GOAL_STATUS_CONFIG,
  DEPARTMENT_LABELS,
} from "@paddock/types";
import { useGoals, useAchieveGoal, useCreateGoal, useEmployees } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

const STATUS_CLASSES: Record<string, string> = {
  success: "bg-success-500/10 text-success-400",
  warning: "bg-warning-500/10 text-warning-400",
  destructive: "bg-error-500/10 text-error-400",
  default: "bg-muted/50 text-foreground/60",
};

export default function MetasPage(): React.ReactElement {
  const [statusFilter, setStatusFilter] = React.useState<GoalStatus | "">("");
  const [deptFilter, setDeptFilter] = React.useState<HRDepartment | "">("");
  const [showCreate, setShowCreate] = React.useState(false);

  const filters: Record<string, string> = {};
  if (statusFilter) filters.status = statusFilter;
  if (deptFilter) filters.department = deptFilter;

  const { data, isLoading } = useGoals(filters);
  const achieve = useAchieveGoal();
  const goals = data?.results ?? [];

  return (
    <ErrorBoundary>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Metas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {data?.count ?? "—"} meta{(data?.count ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/90"
          >
            + Nova meta
          </button>
        </div>

        {showCreate && (
          <CreateGoalForm
            onClose={() => setShowCreate(false)}
          />
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as GoalStatus | "")}
            className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm"
          >
            <option value="">Todos os status</option>
            {(Object.entries(GOAL_STATUS_CONFIG) as [GoalStatus, { label: string }][]).map(
              ([v, cfg]) => (
                <option key={v} value={v}>
                  {cfg.label}
                </option>
              )
            )}
          </select>
          <select
            value={deptFilter}
            onChange={(e) =>
              setDeptFilter(e.target.value as HRDepartment | "")
            }
            className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm"
          >
            <option value="">Todos os setores</option>
            {(Object.entries(DEPARTMENT_LABELS) as [HRDepartment, string][]).map(
              ([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              )
            )}
          </select>
        </div>

        {/* Goals */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-md" />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="rounded-md bg-muted/50 shadow-card p-10 text-center text-sm text-muted-foreground">
            Nenhuma meta encontrada.
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => {
              const statusCfg = GOAL_STATUS_CONFIG[goal.status];
              return (
                <div
                  key={goal.id}
                  className="rounded-md bg-muted/50 shadow-card p-card-padding"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground">
                          {goal.title}
                        </h3>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            STATUS_CLASSES[statusCfg.variant]
                          )}
                        >
                          {statusCfg.label}
                        </span>
                        {goal.is_recurring && (
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-info-500/10 text-info-400">
                            Recorrente
                          </span>
                        )}
                        {goal.department && (
                          <span className="text-xs text-muted-foreground">
                            Setor: {DEPARTMENT_LABELS[goal.department]}
                          </span>
                        )}
                      </div>
                      {goal.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {goal.description}
                        </p>
                      )}

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>
                            {goal.current_value} / {goal.target_value} {goal.unit}
                          </span>
                          <span className="font-medium">
                            {goal.progress_pct}%
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{
                              width: `${Math.min(goal.progress_pct, 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                        <span>
                          Prazo:{" "}
                          {new Date(goal.end_date).toLocaleDateString("pt-BR")}
                        </span>
                        {parseFloat(goal.bonus_amount) > 0 && (
                          <span>
                            Bônus:{" "}
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(parseFloat(goal.bonus_amount))}
                          </span>
                        )}
                      </div>
                    </div>

                    {goal.status === "active" && goal.employee && (
                      <button
                        onClick={() => achieve.mutate(goal.id)}
                        disabled={achieve.isPending}
                        className="shrink-0 rounded-md border border-success-500/20 bg-success-500/10 px-3 py-1.5 text-xs font-medium text-success-400 hover:bg-success-500/20 transition-colors disabled:opacity-50"
                      >
                        Marcar atingida
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

// ─── Create Goal Form ─────────────────────────────────────────────────────────

interface CreateGoalFormProps {
  onClose: () => void;
}

function CreateGoalForm({ onClose }: CreateGoalFormProps): React.ReactElement {
  const create = useCreateGoal();
  const { data: employeesData } = useEmployees({ status: "active" });
  const employees = employeesData?.results ?? [];

  const [scopeType, setScopeType] = React.useState<"employee" | "department">("employee");
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [form, setForm] = React.useState<CreateGoalPayload>({
    title: "",
    description: "",
    target_value: 0,
    unit: "unit",
    bonus_amount: 0,
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    is_recurring: false,
    recurrence_day: 1,
  });

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    create.mutate(form, { onSuccess: onClose });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md bg-muted/50 shadow-card p-card-padding space-y-4"
    >
      <h3 className="text-sm font-semibold text-foreground">Nova meta</h3>

      {/* Scope */}
      <div className="flex gap-3">
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="radio"
            checked={scopeType === "employee"}
            onChange={() => {
              setScopeType("employee");
              setForm((p) => ({ ...p, department: undefined }));
            }}
          />
          Colaborador
        </label>
        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="radio"
            checked={scopeType === "department"}
            onChange={() => {
              setScopeType("department");
              setForm((p) => ({ ...p, employee: undefined }));
            }}
          />
          Setor
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {scopeType === "employee" ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Colaborador *</label>
            <select
              required
              className="rounded border border-border px-2 py-1.5 text-sm"
              value={form.employee ?? ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, employee: e.target.value }))
              }
            >
              <option value="">Selecione...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.user.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Setor *</label>
            <select
              required
              className="rounded border border-border px-2 py-1.5 text-sm"
              value={form.department ?? ""}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  department: e.target.value as HRDepartment,
                }))
              }
            >
              <option value="">Selecione...</option>
              {(
                Object.entries(DEPARTMENT_LABELS) as [HRDepartment, string][]
              ).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Título *</label>
          <input
            required
            type="text"
            className="rounded border border-border px-2 py-1.5 text-sm"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Valor alvo *</label>
          <input
            required
            type="number"
            step="0.01"
            className="rounded border border-border px-2 py-1.5 text-sm"
            value={form.target_value || ""}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                target_value: parseFloat(e.target.value),
              }))
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Unidade</label>
          <select
            className="rounded border border-border px-2 py-1.5 text-sm"
            value={form.unit ?? "unit"}
            onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
          >
            <option value="unit">Unidade</option>
            <option value="currency">R$ (moeda)</option>
            <option value="percentage">Percentual (%)</option>
            <option value="hours">Horas</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Bônus ao atingir (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="rounded border border-border px-2 py-1.5 text-sm"
            value={form.bonus_amount ?? 0}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                bonus_amount: parseFloat(e.target.value) || 0,
              }))
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Início *</label>
          <input
            required
            type="date"
            className="rounded border border-border px-2 py-1.5 text-sm"
            value={form.start_date}
            onChange={(e) =>
              setForm((p) => ({ ...p, start_date: e.target.value }))
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Prazo *</label>
          <input
            required
            type="date"
            className="rounded border border-border px-2 py-1.5 text-sm"
            value={form.end_date}
            onChange={(e) =>
              setForm((p) => ({ ...p, end_date: e.target.value }))
            }
          />
        </div>
      </div>

      {/* Recorrência */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => {
              setIsRecurring(e.target.checked);
              setForm((p) => ({ ...p, is_recurring: e.target.checked }));
            }}
          />
          Meta mensal recorrente
        </label>
        {isRecurring && (
          <div className="flex flex-col gap-1 max-w-xs">
            <label className="text-xs text-muted-foreground">Dia de reinício (1-28)</label>
            <input
              type="number"
              min={1}
              max={28}
              required
              className="rounded border border-border px-2 py-1.5 text-sm"
              value={form.recurrence_day ?? 1}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  recurrence_day: parseInt(e.target.value, 10),
                }))
              }
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:underline"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {create.isPending ? "Criando..." : "Criar meta"}
        </button>
      </div>
    </form>
  );
}
