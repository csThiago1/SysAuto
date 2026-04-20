"use client";

/**
 * Novo Título a Receber — Formulário de criação.
 * Sprint 14
 */

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, Search, X } from "lucide-react";
import { z } from "zod";
import { useCreateReceivable } from "@/hooks";
import { useCustomers } from "@/hooks/useCustomers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReceivableOrigin } from "@paddock/types";
import { RECEIVABLE_ORIGIN_LABELS } from "@paddock/types";

// ── Zod schema ────────────────────────────────────────────────────────────────

const RECEIVABLE_ORIGINS = ["MAN", "OS", "NFE", "NFCE", "NFSE"] as const;

const receivableSchema = z.object({
  description: z.string().min(1, "Descrição obrigatória"),
  customer_name: z.string().min(1, "Nome do cliente obrigatório"),
  customer_id: z.string().min(1, "Selecione um cliente"),
  amount: z
    .string()
    .min(1, "Valor obrigatório")
    .refine((v) => parseFloat(v) > 0, {
      message: "Valor deve ser maior que zero",
    }),
  due_date: z.string().min(1, "Data de vencimento obrigatória"),
  competence_date: z.string().min(1, "Data de competência obrigatória"),
  document_number: z.string().optional(),
  origin: z.enum(RECEIVABLE_ORIGINS).optional(),
  notes: z.string().optional(),
});

type FormDraft = {
  description: string;
  customer_name: string;
  customer_id: string;
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
      <Label className="text-xs font-medium text-neutral-700">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ORIGIN_OPTIONS = Object.entries(RECEIVABLE_ORIGIN_LABELS) as [
  ReceivableOrigin,
  string,
][];

export default function NovoContaReceberPage(): React.ReactElement {
  const router = useRouter();
  const createReceivable = useCreateReceivable();

  const todayStr = new Date().toISOString().split("T")[0] ?? "";

  const [form, setForm] = React.useState<FormDraft>({
    description: "",
    customer_name: "",
    customer_id: "",
    amount: "",
    due_date: "",
    competence_date: todayStr,
    document_number: "",
    origin: "MAN",
    notes: "",
  });

  // Customer search
  const [clienteSearch, setClienteSearch] = React.useState("");
  const [clienteSelecionado, setClienteSelecionado] = React.useState<{ id: string; name: string; document_masked: string } | null>(null);
  const { data: clientesData } = useCustomers(clienteSearch);
  const clientes = clientesData?.results ?? [];

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
      description: form.description,
      customer_name: form.customer_name,
      customer_id: form.customer_id,
      amount: form.amount,
      due_date: form.due_date,
      competence_date: form.competence_date,
      document_number: form.document_number || undefined,
      origin: (form.origin as ReceivableOrigin) || undefined,
      notes: form.notes || undefined,
    };

    const result = receivableSchema.safeParse(parseInput);
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

    createReceivable.mutate(
      {
        description: result.data.description,
        customer_name: result.data.customer_name,
        customer_id: result.data.customer_id,
        amount: parseFloat(result.data.amount).toFixed(2),
        due_date: result.data.due_date,
        competence_date: result.data.competence_date,
        document_number: result.data.document_number,
        origin: result.data.origin,
        notes: result.data.notes,
      },
      {
        onSuccess: () => {
          void router.push("/financeiro/contas-receber" as Route);
        },
      }
    );
  };

  return (
    <ErrorBoundary>
      <div className="space-y-5 max-w-2xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Link
            href={"/financeiro" as Route}
            className="hover:text-primary-600 transition-colors"
          >
            Financeiro
          </Link>
          <span>/</span>
          <Link
            href={"/financeiro/contas-receber" as Route}
            className="flex items-center gap-1 hover:text-primary-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Contas a Receber
          </Link>
          <span>/</span>
          <span className="text-neutral-900">Novo Título</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Novo Título a Receber
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Cadastre um novo título de contas a receber.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cliente */}
          <section className="rounded-md bg-white shadow-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-2">
              Cliente
            </h2>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-neutral-700">Cliente *</Label>
              {errors.customer_id && <p className="text-xs text-red-600">{errors.customer_id}</p>}
              {clienteSelecionado ? (
                <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{clienteSelecionado.name}</p>
                    <p className="text-xs text-neutral-500">{clienteSelecionado.document_masked}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setClienteSelecionado(null);
                      setClienteSearch("");
                      setField("customer_id", "");
                      setField("customer_name", "");
                    }}
                    className="text-neutral-400 hover:text-neutral-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                    <Input
                      className="pl-8"
                      placeholder="Buscar por nome ou CPF..."
                      value={clienteSearch}
                      onChange={(e) => setClienteSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {clientes.length > 0 && (
                    <div className="rounded-md border border-neutral-200 overflow-hidden">
                      {clientes.slice(0, 5).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setClienteSelecionado(c);
                            setClienteSearch("");
                            setField("customer_id", c.id);
                            setField("customer_name", c.name);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-neutral-50 border-b border-neutral-100 last:border-0 transition-colors"
                        >
                          <span className="text-sm text-neutral-900">{c.name}</span>
                          <span className="text-xs text-neutral-500">{c.document_masked}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {clienteSearch.length >= 2 && clientes.length === 0 && (
                    <p className="text-xs text-neutral-500 text-center py-2">Nenhum cliente encontrado.</p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Documento */}
          <section className="rounded-md bg-white shadow-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-2">
              Documento
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <FormField label="Descrição *" error={errors.description}>
                  <Input
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    placeholder="Ex: Recebimento OS #1234 — revisão geral"
                  />
                </FormField>
              </div>
              <FormField label="Número do documento" error={errors.document_number}>
                <Input
                  value={form.document_number}
                  onChange={(e) => setField("document_number", e.target.value)}
                  placeholder="Ex: NFS-e 98765"
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
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          <section className="rounded-md bg-white shadow-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-2">
              Observações
            </h2>
            <FormField label="Observações" error={errors.notes}>
              <textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={3}
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Informações adicionais sobre este título..."
              />
            </FormField>
          </section>

          {/* API error */}
          {createReceivable.isError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-4 py-3">
              {createReceivable.error?.message ||
                "Erro ao criar título. Tente novamente."}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 justify-end">
            <Link
              href={"/financeiro/contas-receber" as Route}
              className="text-sm text-neutral-500 hover:underline"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={createReceivable.isPending}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {createReceivable.isPending ? "Salvando..." : "Salvar Título"}
            </button>
          </div>
        </form>
      </div>
    </ErrorBoundary>
  );
}
