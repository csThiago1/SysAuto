"use client";

/**
 * Novo Lançamento Contábil — Formulário com partidas dobradas.
 * Validação: débitos totais = créditos totais (balanceamento).
 */

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import type {
  JournalEntryOrigin,
  CreateJournalEntryPayload,
  CreateJournalEntryLinePayload,
} from "@paddock/types";
import { ORIGIN_LABELS } from "@paddock/types";
import { useCreateJournalEntry, useAnalyticalAccounts } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const ORIGINS = Object.entries(ORIGIN_LABELS) as [JournalEntryOrigin, string][];

const JOURNAL_ORIGINS = [
  "MAN", "OS", "NFE", "NFCE", "NFSE", "NFE_E", "PAG", "REC",
  "ASAAS", "OFX", "FOLHA", "DEP", "ENC", "EST",
] as const;

// ── Zod schema ────────────────────────────────────────────────────────────────

const lineSchema = z.object({
  account_id: z.string().min(1, "Conta obrigatória"),
  side: z.enum(["D", "C"]),
  amount: z
    .string()
    .min(1, "Valor obrigatório")
    .refine((v) => parseFloat(v) > 0, { message: "Valor deve ser maior que zero" }),
  description: z.string().optional(),
});

const entrySchema = z.object({
  description: z.string().min(1, "Descrição obrigatória"),
  competence_date: z.string().min(1, "Data de competência obrigatória"),
  origin: z.enum(JOURNAL_ORIGINS, { errorMap: () => ({ message: "Origem obrigatória" }) }),
  lines: z
    .array(lineSchema)
    .min(2, "Necessário ao menos 2 linhas")
    .superRefine((lines, ctx) => {
      lines.forEach((line, i) => {
        if (!line.account_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Conta obrigatória",
            path: [i, "account_id"],
          });
        }
      });
    }),
});

type LineDraft = {
  account_id: string;
  side: "D" | "C";
  amount: string;
  description: string;
};

type FormDraft = {
  description: string;
  competence_date: string;
  origin: string;
  lines: LineDraft[];
};

type LineErrors = Partial<Record<keyof LineDraft, string>>;
type FormErrors = {
  description?: string;
  competence_date?: string;
  origin?: string;
  lines?: string;
  lineErrors?: LineErrors[];
};

// ── Currency formatter ────────────────────────────────────────────────────────

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function sumLines(lines: LineDraft[], side: "D" | "C"): number {
  return lines
    .filter((l) => l.side === side)
    .reduce((acc, l) => acc + (parseFloat(l.amount) || 0), 0);
}

// ── FormField helper ──────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

function FormField({ label, error, children }: FormFieldProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-foreground/70">{label}</Label>
      {children}
      {error && <p className="text-xs text-error-400">{error}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NovoLancamentoPage(): React.ReactElement {
  const router = useRouter();
  const create = useCreateJournalEntry();
  const { data: accountsData, isLoading: loadingAccounts } = useAnalyticalAccounts();

  const todayStr = new Date().toISOString().split("T")[0] ?? "";

  const [form, setForm] = React.useState<FormDraft>({
    description: "",
    competence_date: todayStr,
    origin: "MAN",
    lines: [
      { account_id: "", side: "D", amount: "", description: "" },
      { account_id: "", side: "C", amount: "", description: "" },
    ],
  });

  const [errors, setErrors] = React.useState<FormErrors>({});

  const setField = <K extends keyof Omit<FormDraft, "lines">>(
    key: K,
    value: FormDraft[K]
  ): void => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const setLineField = (
    index: number,
    key: keyof LineDraft,
    value: string
  ): void => {
    setForm((p) => {
      const newLines = p.lines.map((l, i) =>
        i === index ? { ...l, [key]: value } : l
      );
      return { ...p, lines: newLines };
    });
    setErrors((p) => {
      const lineErrors = [...(p.lineErrors ?? [])];
      if (lineErrors[index]) {
        lineErrors[index] = { ...lineErrors[index], [key]: undefined };
      }
      return { ...p, lineErrors };
    });
  };

  const toggleSide = (index: number): void => {
    setForm((p) => {
      const newLines = p.lines.map((l, i) =>
        i === index ? { ...l, side: l.side === "D" ? ("C" as const) : ("D" as const) } : l
      );
      return { ...p, lines: newLines };
    });
  };

  const addLine = (): void => {
    setForm((p) => ({
      ...p,
      lines: [...p.lines, { account_id: "", side: "D", amount: "", description: "" }],
    }));
  };

  const removeLine = (index: number): void => {
    if (form.lines.length <= 2) return;
    setForm((p) => ({
      ...p,
      lines: p.lines.filter((_, i) => i !== index),
    }));
  };

  const totalDebit = sumLines(form.lines, "D");
  const totalCredit = sumLines(form.lines, "C");
  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.001;

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();

    const result = entrySchema.safeParse(form);
    if (!result.success) {
      const newErrors: FormErrors = {};
      const lineErrors: LineErrors[] = form.lines.map(() => ({}));

      for (const issue of result.error.issues) {
        const path0 = issue.path[0];
        if (path0 === "lines") {
          const lineIndex = issue.path[1];
          const lineField = issue.path[2];
          if (typeof lineIndex === "number" && typeof lineField === "string") {
            lineErrors[lineIndex] = {
              ...(lineErrors[lineIndex] ?? {}),
              [lineField]: issue.message,
            };
          } else {
            newErrors.lines = issue.message;
          }
        } else if (typeof path0 === "string") {
          newErrors[path0 as keyof Omit<FormErrors, "lineErrors">] = issue.message;
        }
      }

      newErrors.lineErrors = lineErrors;
      setErrors(newErrors);
      return;
    }

    if (!isBalanced) {
      setErrors((p) => ({
        ...p,
        lines: "O lançamento nao esta balanceado. Total debito deve ser igual ao total credito.",
      }));
      return;
    }

    const lines: CreateJournalEntryLinePayload[] = result.data.lines.map((line) => ({
      account_id: line.account_id,
      debit_amount: line.side === "D" ? parseFloat(line.amount).toFixed(2) : "0.00",
      credit_amount: line.side === "C" ? parseFloat(line.amount).toFixed(2) : "0.00",
      description: line.description ?? "",
    }));

    const payload: CreateJournalEntryPayload = {
      description: result.data.description,
      competence_date: result.data.competence_date,
      origin: result.data.origin,
      lines,
    };

    create.mutate(payload, {
      onSuccess: (entry) => {
        void router.push(`/financeiro/lancamentos/${entry.id}` as Route);
      },
    });
  };

  const accounts = accountsData?.results ?? [];

  return (
    <ErrorBoundary>
      <div className="space-y-5 max-w-3xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href={"/financeiro" as Route}
            className="hover:text-primary-600 transition-colors"
          >
            Financeiro
          </Link>
          <span>/</span>
          <Link
            href={"/financeiro/lancamentos" as Route}
            className="flex items-center gap-1 hover:text-primary-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Lançamentos
          </Link>
          <span>/</span>
          <span className="text-foreground">Novo Lançamento</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Novo Lançamento</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Lançamento contábil manual com partidas dobradas.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cabecalho */}
          <section className="rounded-md bg-muted/50 shadow-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground border-b border-border pb-2">
              Cabecalho
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <FormField label="Descricao *" error={errors.description}>
                  <Input
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    placeholder="Descricao do lancamento..."
                    autoFocus
                  />
                </FormField>
              </div>
              <FormField label="Data de Competencia *" error={errors.competence_date}>
                <Input
                  type="date"
                  value={form.competence_date}
                  onChange={(e) => setField("competence_date", e.target.value)}
                />
              </FormField>
              <FormField label="Origem *" error={errors.origin}>
                <select
                  value={form.origin}
                  onChange={(e) => setField("origin", e.target.value)}
                  className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {ORIGINS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </section>

          {/* Linhas do lançamento */}
          <section className="rounded-md bg-muted/50 shadow-card overflow-hidden">
            <div className="p-5 pb-3">
              <h2 className="text-sm font-semibold text-foreground">
                Linhas do Lancamento
              </h2>
              {errors.lines && (
                <p className="text-xs text-error-400 mt-1">{errors.lines}</p>
              )}
            </div>

            {loadingAccounts ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="px-5 py-2 bg-muted/30 border-y border-border grid grid-cols-[1fr_80px_140px_1fr_40px] gap-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <span>Conta *</span>
                  <span className="text-center">D / C</span>
                  <span>Valor *</span>
                  <span>Descricao</span>
                  <span />
                </div>

                {/* Lines */}
                <div className="divide-y divide-white/5">
                  {form.lines.map((line, i) => {
                    const lineErr = errors.lineErrors?.[i];
                    return (
                      <div
                        key={i}
                        className="px-5 py-3 grid grid-cols-[1fr_80px_140px_1fr_40px] gap-3 items-start"
                      >
                        {/* Conta */}
                        <div>
                          <select
                            value={line.account_id}
                            onChange={(e) => setLineField(i, "account_id", e.target.value)}
                            className={cn(
                              "w-full rounded-md border bg-muted/50 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500",
                              lineErr?.account_id
                                ? "border-error-500/20"
                                : "border-border"
                            )}
                          >
                            <option value="">Selecione a conta...</option>
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.code} — {acc.name}
                              </option>
                            ))}
                          </select>
                          {lineErr?.account_id && (
                            <p className="text-xs text-error-400 mt-0.5">
                              {lineErr.account_id}
                            </p>
                          )}
                        </div>

                        {/* Toggle D/C */}
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => toggleSide(i)}
                            className={cn(
                              "rounded px-2.5 py-1.5 text-xs font-bold transition-colors w-14",
                              line.side === "D"
                                ? "bg-muted/50 text-foreground/70 hover:bg-muted"
                                : "bg-muted/50 text-foreground/70 hover:bg-muted"
                            )}
                          >
                            {line.side === "D" ? "Debito" : "Credito"}
                          </button>
                        </div>

                        {/* Valor */}
                        <div>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={line.amount}
                            onChange={(e) => setLineField(i, "amount", e.target.value)}
                            placeholder="0,00"
                            className={cn(
                              lineErr?.amount && "border-error-500/20"
                            )}
                          />
                          {lineErr?.amount && (
                            <p className="text-xs text-error-400 mt-0.5">{lineErr.amount}</p>
                          )}
                        </div>

                        {/* Descricao */}
                        <Input
                          value={line.description}
                          onChange={(e) => setLineField(i, "description", e.target.value)}
                          placeholder="Opcional..."
                        />

                        {/* Remove */}
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => removeLine(i)}
                            disabled={form.lines.length <= 2}
                            className="p-1.5 rounded text-muted-foreground hover:text-error-400 hover:bg-error-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Remover linha"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
                  <button
                    type="button"
                    onClick={addLine}
                    className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 font-medium transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar linha
                  </button>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-foreground/60">
                      Total Debito:{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {brl.format(totalDebit)}
                      </span>
                    </span>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-foreground/60">
                      Total Credito:{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {brl.format(totalCredit)}
                      </span>
                    </span>
                    <span className="text-muted-foreground">|</span>
                    {isBalanced ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-success-500/10 text-success-400 border border-success-500/20">
                        <span>&#10003;</span> Balanceado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-error-500/10 text-error-400 border border-error-500/20">
                        <span>&#10007;</span> Desbalanceado
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>

          {/* API error */}
          {create.isError && (
            <p className="text-sm text-error-400 bg-error-500/10 rounded-md px-4 py-3">
              {create.error?.message || "Erro ao criar lançamento. Tente novamente."}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 justify-end">
            <Link
              href={"/financeiro/lancamentos" as Route}
              className="text-sm text-muted-foreground hover:underline"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-foreground hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {create.isPending ? "Salvando..." : "Salvar Lançamento"}
            </button>
          </div>
        </form>
      </div>
    </ErrorBoundary>
  );
}
