"use client";

/**
 * TabFerias — Saldo de férias, histórico e agendamento.
 */

import React from "react";
import type { Employee, CreateVacationPayload } from "@paddock/types";
import { VACATION_STATUS_CONFIG } from "@paddock/types";
import { useVacations, useVacationBalance, useCreateVacation, useCancelVacation } from "@/hooks";

interface TabFeriasProps {
  employee: Employee;
}

const fmt = (v: string | number | null | undefined): string => {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
};

export function TabFerias({ employee }: TabFeriasProps): React.ReactElement {
  const { data: vacations, isLoading } = useVacations(employee.id);
  const { data: balance } = useVacationBalance(employee.id);
  const createVacation = useCreateVacation();
  const cancelVacation = useCancelVacation();
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState<CreateVacationPayload>({
    employee: employee.id,
    acquisition_start: "",
    acquisition_end: "",
    start_date: "",
    end_date: "",
    days_taken: 30,
    days_sold: 0,
  });

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    createVacation.mutate(form, { onSuccess: () => setShowForm(false) });
  };

  return (
    <div className="space-y-6">
      {/* Saldo de férias */}
      <section className="rounded-md bg-muted/50 shadow-card p-card-padding">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">Saldo de férias</h3>
          {employee.status !== "terminated" && (
            <button
              onClick={() => setShowForm((p) => !p)}
              className="text-xs text-primary hover:underline"
            >
              {showForm ? "Cancelar" : "+ Agendar férias"}
            </button>
          )}
        </div>

        {balance?.periods && balance.periods.length > 0 ? (
          <div className="space-y-2">
            {balance.periods.map((p, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-md border p-3 text-sm ${
                  p.is_overdue
                    ? "border-error-500/30 bg-error-500/5"
                    : "border-border"
                }`}
              >
                <div>
                  <span className="font-medium text-foreground">
                    {new Date(p.acquisition_start + "T12:00").toLocaleDateString("pt-BR")}
                    {" — "}
                    {new Date(p.acquisition_end + "T12:00").toLocaleDateString("pt-BR")}
                  </span>
                  {p.is_overdue && (
                    <span className="ml-2 text-xs text-error-400 font-medium">VENCIDAS</span>
                  )}
                  {!p.is_complete && (
                    <span className="ml-2 text-xs text-muted-foreground">(em aquisição)</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span>Usado: {p.days_used}d</span>
                  <span className={`font-semibold ${p.days_remaining > 0 ? "text-success-400" : "text-muted-foreground"}`}>
                    Restante: {p.days_remaining}d
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum período aquisitivo.</p>
        )}
      </section>

      {/* Form de agendamento */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-md bg-muted/50 shadow-card p-card-padding space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Agendar férias</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Início período aquisitivo</label>
              <input type="date" required className="rounded border border-border px-2 py-1.5 text-sm"
                value={form.acquisition_start}
                onChange={(e) => setForm((p) => ({ ...p, acquisition_start: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Fim período aquisitivo</label>
              <input type="date" required className="rounded border border-border px-2 py-1.5 text-sm"
                value={form.acquisition_end}
                onChange={(e) => setForm((p) => ({ ...p, acquisition_end: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Início das férias</label>
              <input type="date" required className="rounded border border-border px-2 py-1.5 text-sm"
                value={form.start_date}
                onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Fim das férias</label>
              <input type="date" required className="rounded border border-border px-2 py-1.5 text-sm"
                value={form.end_date}
                onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Dias de gozo (20-30)</label>
              <input type="number" min={20} max={30} required className="rounded border border-border px-2 py-1.5 text-sm"
                value={form.days_taken}
                onChange={(e) => setForm((p) => ({ ...p, days_taken: parseInt(e.target.value, 10) || 30 }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Abono pecuniário (0-10)</label>
              <input type="number" min={0} max={10} className="rounded border border-border px-2 py-1.5 text-sm"
                value={form.days_sold ?? 0}
                onChange={(e) => setForm((p) => ({ ...p, days_sold: parseInt(e.target.value, 10) || 0 }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="text-xs text-muted-foreground hover:underline">Cancelar</button>
            <button type="submit" disabled={createVacation.isPending}
              className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50">
              {createVacation.isPending ? "Salvando..." : "Agendar"}
            </button>
          </div>
        </form>
      )}

      {/* Histórico */}
      <section className="rounded-md bg-muted/50 shadow-card p-card-padding">
        <h3 className="text-base font-semibold text-foreground mb-4">Histórico de férias</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !vacations || vacations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro de férias.</p>
        ) : (
          <div className="space-y-3">
            {vacations.map((v) => {
              const cfg = VACATION_STATUS_CONFIG[v.status] ?? { label: v.status, color: "info" };
              return (
                <div key={v.id} className="rounded-md border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-${cfg.color}-500/10 text-${cfg.color}-400`}>
                        {cfg.label}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {new Date(v.start_date + "T12:00").toLocaleDateString("pt-BR")}
                        {" — "}
                        {new Date(v.end_date + "T12:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    {v.status === "scheduled" && (
                      <button
                        onClick={() => cancelVacation.mutate(v.id)}
                        className="text-xs text-error-400 hover:underline"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                    <span>Gozo: {v.days_taken}d</span>
                    {v.days_sold > 0 && <span>Abono: {v.days_sold}d</span>}
                    <span>Férias: {fmt(v.vacation_pay)}</span>
                    <span>1/3: {fmt(v.one_third_pay)}</span>
                    {v.days_sold > 0 && <span>Abono $: {fmt(v.sold_pay)}</span>}
                    <span>Descontos: {fmt(v.deductions)}</span>
                    <span className="font-semibold text-foreground">Líquido: {fmt(v.net_pay)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
