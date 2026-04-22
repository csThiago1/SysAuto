"use client";

/**
 * Novo Título a Pagar — Formulário de criação.
 * Sprint 14
 */

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import { useCreatePayable, useSuppliers } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { PayableOrigin } from "@paddock/types";
import { PAYABLE_ORIGIN_LABELS } from "@paddock/types";

// ── Zod schema ────────────────────────────────────────────────────────────────

const PAYABLE_ORIGINS = ["MAN", "FOLHA", "NFE_E", "AUTO"] as const;

const payableSchema = z.object({
  supplier_id: z.string().min(1, "Fornecedor obrigatório"),
  description: z.string().min(1, "Descrição obrigatória"),
  amount: z
    .string()
    .min(1, "Valor obrigatório")
    .refine((v) => parseFloat(v) > 0, { message: "Valor deve ser maior que zero" }),
  due_date: z.string().min(1, "Data de vencimento obrigatória"),
  competence_date: z.string().min(1, "Data de competência obrigatória"),
  document_number: z.string().optional(),
  origin: z.enum(PAYABLE_ORIGINS).optional(),
  notes: z.string().optional(),
});

type FormDraft = {
  supplier_id: string;
  description: string;
  amount: string;
  due_date: string;
  competence_date: string;
  document_number: string;
  origin: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof FormDraft, string>>;

// ── FormField helper ──────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

function FormField({ label, error, children }: FormFieldProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-white/70">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ORIGIN_OPTIONS = Object.entries(PAYABLE_ORIGIN_LABELS) as [
  PayableOrigin,
  string,
][];

export default function NovoContaPagarPage(): React.ReactElement {
  const router = useRouter();
  const createPayable = useCreatePayable();
  const { data: suppliersData, isLoading: loadingSuppliers } = useSuppliers();

  const todayStr = new Date().toISOString().split("T")[0] ?? "";

  const [form, setForm] = React.useState<FormDraft>({
    supplier_id: "",
    description: "",
    amount: "",
    due_date: "",
    competence_date: todayStr,
    document_number: "",
    origin: "MAN",
    notes: "",
  });

  const [errors, setErrors] = React.useState<FormErrors>({});

  const setField = <K extends keyof FormDraft>(key: K, value: string): void => {
    setForm((p) => {
      const updated = { ...p, [key]: value };
      // sync competence_date to due_date if user hasn't changed it manually
      if (key === "due_date" && p.competence_date === p.due_date) {
        updated.competence_date = value;
      }
      return updated;
    });
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();

    const parseInput = {
      supplier_id: form.supplier_id,
      description: form.description,
      amount: form.amount,
      due_date: form.due_date,
      competence_date: form.competence_date,
      document_number: form.document_number || undefined,
      origin: (form.origin as PayableOrigin) || undefined,
      notes: form.notes || undefined,
    };

    const result = payableSchema.safeParse(parseInput);
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

    createPayable.mutate(
      {
        supplier_id: result.data.supplier_id,
        description: result.data.description,
        amount: parseFloat(result.data.amount).toFixed(2),
        due_date: result.data.due_date,
        competence_date: result.data.competence_date,
        document_number: result.data.document_number,
        origin: result.data.origin,
        notes: result.data.notes,
      },
      {
        onSuccess: () => {
          void router.push("/financeiro/contas-pagar" as Route);
        },
      }
    );
  };

  const suppliers = suppliersData?.results ?? [];

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
            href={"/financeiro/contas-pagar" as Route}
            className="flex items-center gap-1 hover:text-primary-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Contas a Pagar
          </Link>
          <span>/</span>
          <span className="text-white">Novo Título</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">Novo Título a Pagar</h1>
          <p className="mt-0.5 text-sm text-white/50">
            Cadastre um novo título de contas a pagar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Fornecedor */}
          <section className="rounded-md bg-white/5 shadow-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white border-b border-neutral-100 pb-2">
              Fornecedor
            </h2>
            <FormField label="Fornecedor *" error={errors.supplier_id}>
              {loadingSuppliers ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <select
                  value={form.supplier_id}
                  onChange={(e) => setField("supplier_id", e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Selecione o fornecedor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <p className="text-xs text-white/40">
              Fornecedor não cadastrado?{" "}
              <span className="text-primary-600 cursor-not-allowed opacity-60">
                Cadastrar fornecedor (em breve)
              </span>
            </p>
          </section>

          {/* Documento */}
          <section className="rounded-md bg-white/5 shadow-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white border-b border-neutral-100 pb-2">
              Documento
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <FormField label="Descrição *" error={errors.description}>
                  <Input
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    placeholder="Ex: Pagamento fatura energia maio/2026"
                    autoFocus
                  />
                </FormField>
              </div>
              <FormField label="Número do documento" error={errors.document_number}>
                <Input
                  value={form.document_number}
                  onChange={(e) => setField("document_number", e.target.value)}
                  placeholder="Ex: NF-123456"
                />
              </FormField>
              <FormField label="Valor *" error={errors.amount}>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(e) => setField("amount", e.target.value)}
                  placeholder="0,00"
                />
              </FormField>
              <FormField label="Data de vencimento *" error={errors.due_date}>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setField("due_date", e.target.value)}
                />
              </FormField>
              <FormField
                label="Data de competência *"
                error={errors.competence_date}
              >
                <Input
                  type="date"
                  value={form.competence_date}
                  onChange={(e) => setField("competence_date", e.target.value)}
                />
              </FormField>
              <FormField label="Origem" error={errors.origin}>
                <select
                  value={form.origin}
                  onChange={(e) => setField("origin", e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {ORIGIN_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </section>

          {/* Observações */}
          <section className="rounded-md bg-white/5 shadow-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white border-b border-neutral-100 pb-2">
              Observações
            </h2>
            <FormField label="Observações" error={errors.notes}>
              <textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={3}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Informações adicionais sobre este título..."
              />
            </FormField>
          </section>

          {/* API error */}
          {createPayable.isError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-4 py-3">
              {createPayable.error?.message ||
                "Erro ao criar título. Tente novamente."}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 justify-end">
            <Link
              href={"/financeiro/contas-pagar" as Route}
              className="text-sm text-white/50 hover:underline"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={createPayable.isPending}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {createPayable.isPending ? "Salvando..." : "Salvar Título"}
            </button>
          </div>
        </form>
      </div>
    </ErrorBoundary>
  );
}
