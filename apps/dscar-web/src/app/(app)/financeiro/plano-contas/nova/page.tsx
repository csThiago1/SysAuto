"use client";

/**
 * Nova Conta Contabil — Formulario de criacao no plano de contas.
 */

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import type { AccountType, NatureType } from "@paddock/types";
import { ACCOUNT_TYPE_LABELS, NATURE_LABELS } from "@paddock/types";
import { useCreateChartOfAccount } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = Object.entries(ACCOUNT_TYPE_LABELS) as [AccountType, string][];
const NATURE_ENTRIES = Object.entries(NATURE_LABELS) as [NatureType, string][];

const ACCOUNT_TYPE_VALUES = ["A", "L", "E", "R", "C", "X", "O"] as const;
const NATURE_VALUES = ["D", "C"] as const;

// ── Zod schema ────────────────────────────────────────────────────────────────

const formSchema = z.object({
  code: z.string().min(1, "Codigo obrigatorio"),
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  parent_code: z.string().optional(),
  account_type: z.enum(ACCOUNT_TYPE_VALUES, {
    errorMap: () => ({ message: "Tipo de conta obrigatorio" }),
  }),
  nature: z.enum(NATURE_VALUES, {
    errorMap: () => ({ message: "Natureza obrigatoria" }),
  }),
  is_analytical: z.boolean(),
  accepts_cost_center: z.boolean(),
  sped_code: z.string().optional(),
});

type FormDraft = {
  code: string;
  name: string;
  parent_code: string;
  account_type: string;
  nature: string;
  is_analytical: boolean;
  accepts_cost_center: boolean;
  sped_code: string;
};

type FormErrors = Partial<Record<keyof FormDraft, string>>;

// ── FormField helper ──────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function FormField({ label, hint, error, children }: FormFieldProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-white/70">{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-white/40">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NovaContaPage(): React.ReactElement {
  const router = useRouter();
  const create = useCreateChartOfAccount();

  const [form, setForm] = React.useState<FormDraft>({
    code: "",
    name: "",
    parent_code: "",
    account_type: "",
    nature: "",
    is_analytical: true,
    accepts_cost_center: false,
    sped_code: "",
  });

  const [errors, setErrors] = React.useState<FormErrors>({});

  const setField = <K extends keyof FormDraft>(key: K, value: FormDraft[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();

    const result = formSchema.safeParse({
      ...form,
      parent_code: form.parent_code || undefined,
      sped_code: form.sped_code || undefined,
    });

    if (!result.success) {
      const newErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") {
          newErrors[key as keyof FormDraft] = issue.message;
        }
      }
      setErrors(newErrors);
      return;
    }

    create.mutate(result.data, {
      onSuccess: () => {
        void router.push("/financeiro/plano-contas" as Route);
      },
    });
  };

  return (
    <ErrorBoundary>
      <div className="space-y-5 max-w-2xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Link
            href={"/financeiro" as Route}
            className="hover:text-primary-600 transition-colors"
          >
            Financeiro
          </Link>
          <span>/</span>
          <Link
            href={"/financeiro/plano-contas" as Route}
            className="flex items-center gap-1 hover:text-primary-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Plano de Contas
          </Link>
          <span>/</span>
          <span className="text-white">Nova Conta</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">Nova Conta Contabil</h1>
          <p className="mt-0.5 text-sm text-white/50">
            Adicionar uma nova conta ao plano de contas DS Car.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-md bg-white/5 shadow-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white border-b border-neutral-100 pb-2">
              Dados da Conta
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Codigo */}
              <FormField
                label="Codigo *"
                hint="Segmentos separados por ponto"
                error={errors.code}
              >
                <Input
                  value={form.code}
                  onChange={(e) => setField("code", e.target.value)}
                  placeholder="ex: 1.1.05.001"
                  autoFocus
                  className={cn(errors.code && "border-red-300")}
                />
              </FormField>

              {/* Nome */}
              <FormField label="Nome *" error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Nome da conta"
                  className={cn(errors.name && "border-red-300")}
                />
              </FormField>

              {/* Codigo Pai */}
              <FormField
                label="Codigo Pai"
                hint="Deixe vazio para conta raiz"
                error={errors.parent_code}
              >
                <Input
                  value={form.parent_code}
                  onChange={(e) => setField("parent_code", e.target.value)}
                  placeholder="ex: 1.1.05"
                />
              </FormField>

              {/* Codigo SPED */}
              <FormField label="Codigo SPED" error={errors.sped_code}>
                <Input
                  value={form.sped_code}
                  onChange={(e) => setField("sped_code", e.target.value)}
                  placeholder="Opcional"
                />
              </FormField>

              {/* Tipo de Conta */}
              <FormField label="Tipo de Conta *" error={errors.account_type}>
                <select
                  value={form.account_type}
                  onChange={(e) => setField("account_type", e.target.value)}
                  className={cn(
                    "w-full rounded-md border bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500",
                    errors.account_type ? "border-red-300" : "border-white/10"
                  )}
                >
                  <option value="">Selecione o tipo...</option>
                  {ACCOUNT_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>

              {/* Natureza */}
              <FormField label="Natureza *" error={errors.nature}>
                <select
                  value={form.nature}
                  onChange={(e) => setField("nature", e.target.value)}
                  className={cn(
                    "w-full rounded-md border bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500",
                    errors.nature ? "border-red-300" : "border-white/10"
                  )}
                >
                  <option value="">Selecione a natureza...</option>
                  {NATURE_ENTRIES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {/* Tipo Analitica / Sintetica */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-white/70">Tipo *</Label>
              <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] p-1 w-fit">
                <button
                  type="button"
                  onClick={() => {
                    setField("is_analytical", true);
                  }}
                  className={cn(
                    "rounded px-4 py-1.5 text-sm font-medium transition-colors",
                    form.is_analytical
                      ? "bg-white/5 text-white shadow-sm"
                      : "text-white/50 hover:text-white/70"
                  )}
                >
                  Analitica
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setField("is_analytical", false);
                    setField("accepts_cost_center", false);
                  }}
                  className={cn(
                    "rounded px-4 py-1.5 text-sm font-medium transition-colors",
                    !form.is_analytical
                      ? "bg-white/5 text-white shadow-sm"
                      : "text-white/50 hover:text-white/70"
                  )}
                >
                  Sintetica
                </button>
              </div>
              <p className="text-xs text-white/40">
                {form.is_analytical
                  ? "Conta analitica — recebe lancamentos diretamente."
                  : "Conta sintetica — agrupa outras contas, nao recebe lancamentos."}
              </p>
            </div>

            {/* Aceita Centro de Custo */}
            <div className="flex items-center gap-3">
              <input
                id="accepts_cost_center"
                type="checkbox"
                checked={form.accepts_cost_center}
                disabled={!form.is_analytical}
                onChange={(e) => setField("accepts_cost_center", e.target.checked)}
                className="h-4 w-4 rounded border-white/15 text-primary-600 focus:ring-primary-500 disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <label
                htmlFor="accepts_cost_center"
                className={cn(
                  "text-sm text-white/70 select-none",
                  !form.is_analytical && "opacity-40 cursor-not-allowed"
                )}
              >
                Aceita Centro de Custo
              </label>
            </div>
          </section>

          {/* API error */}
          {create.isError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-4 py-3">
              {create.error?.message || "Erro ao criar conta. Tente novamente."}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 justify-end">
            <Link
              href={"/financeiro/plano-contas" as Route}
              className="text-sm text-white/50 hover:underline"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {create.isPending ? "Criando..." : "Criar Conta"}
            </button>
          </div>
        </form>
      </div>
    </ErrorBoundary>
  );
}
