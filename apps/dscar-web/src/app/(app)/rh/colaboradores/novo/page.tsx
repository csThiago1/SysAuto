"use client";

/**
 * Admissão de colaborador.
 * O backend cria/localiza o GlobalUser automaticamente por nome + e-mail —
 * não é mais necessário informar o UUID do usuário.
 */

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";
import type { CreateEmployeePayload, HRDepartment, HRPosition, ContractType } from "@paddock/types";
import { DEPARTMENT_LABELS, POSITION_LABELS, CONTRACT_TYPE_LABELS } from "@paddock/types";
import { useCreateEmployee } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Validation schema ────────────────────────────────────────────────────────

const HR_DEPARTMENTS = [
  "reception", "bodywork", "painting", "mechanical", "aesthetics",
  "polishing", "washing", "inventory", "financial", "administrative",
  "management", "direction",
] as const;

const HR_POSITIONS = [
  "receptionist", "consultant", "bodyworker", "painter", "mechanic",
  "polisher", "washer", "storekeeper", "manager", "financial",
  "administrative", "director",
] as const;

const CONTRACT_TYPES = ["clt", "pj", "intern", "temp", "apprentice"] as const;

const PAY_FREQUENCIES = ["monthly", "biweekly", "weekly"] as const;

const admissionSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  registration_number: z.string().min(1, "Matrícula obrigatória"),
  department: z.enum(HR_DEPARTMENTS, { errorMap: () => ({ message: "Setor obrigatório" }) }),
  position: z.enum(HR_POSITIONS, { errorMap: () => ({ message: "Cargo obrigatório" }) }),
  contract_type: z.enum(CONTRACT_TYPES, { errorMap: () => ({ message: "Tipo de contrato obrigatório" }) }),
  hire_date: z.string().min(1, "Data de admissão obrigatória"),
  base_salary: z.number({ invalid_type_error: "Salário inválido" }).min(0),
  pay_frequency: z.enum(PAY_FREQUENCIES).default("monthly"),
  cpf: z.string().optional(),
  birth_date: z.string().optional(),
  weekly_hours: z.number().optional(),
  work_schedule: z.string().optional(),
  address_zip: z.string().optional(),
  address_street: z.string().optional(),
  address_number: z.string().optional(),
  address_neighborhood: z.string().optional(),
  address_city: z.string().optional(),
  address_state: z.string().optional(),
  emergency_contact_name: z.string().optional(),
});

/** Saída validada — enums tipados (HRDepartment, HRPosition, ContractType) */
type FormData = z.infer<typeof admissionSchema>;

/**
 * Estado do formulário antes da validação Zod.
 * Selects precisam de "" como valor inicial (placeholder "Selecione...").
 * admissionSchema.safeParse(draft) converte para FormData com tipos corretos.
 */
type FormDraft = Omit<FormData, "department" | "position" | "contract_type" | "pay_frequency"> & {
  department: string;   // "" antes de selecionar; validado por z.enum() no submit
  position: string;    // "" antes de selecionar; validado por z.enum() no submit
  contract_type: string; // e.target.value é string; default "clt" já é válido
  pay_frequency: string; // default "monthly"
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function NovoColaboradorPage(): React.ReactElement {
  const router = useRouter();
  const create = useCreateEmployee();
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormDraft, string>>>({});
  const [form, setForm] = React.useState<FormDraft>({
    name: "",
    email: "",
    registration_number: "",
    department: "",
    position: "",
    contract_type: "clt",
    hire_date: new Date().toISOString().split("T")[0],
    base_salary: 0,
    pay_frequency: "monthly",
    cpf: "",
    birth_date: "",
    weekly_hours: 44,
    work_schedule: "6x1",
    address_zip: "",
    address_street: "",
    address_number: "",
    address_neighborhood: "",
    address_city: "Manaus",
    address_state: "AM",
    emergency_contact_name: "",
  });

  const set = <K extends keyof FormDraft>(key: K, value: FormDraft[K]): void => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const result = admissionSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof FormDraft, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FormDraft;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    // z.enum() garante narrowing correto — result.data.department é HRDepartment
    // Remover campos opcionais com string vazia — DateField do DRF rejeita ""
    const raw = result.data;
    const payload: CreateEmployeePayload = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== "" && v !== undefined)
    ) as unknown as CreateEmployeePayload;

    create.mutate(payload, {
      onSuccess: (employee) => {
        void router.push(`/rh/colaboradores/${employee.id}` as Route);
      },
    });
  };

  return (
    <ErrorBoundary>
      <div className="space-y-5 max-w-2xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Link
            href={"/rh/colaboradores" as Route}
            className="flex items-center gap-1 hover:text-primary-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Colaboradores
          </Link>
          <span>/</span>
          <span className="text-neutral-900">Nova admissão</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Admitir colaborador
          </h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            O acesso ao sistema será criado automaticamente com o e-mail informado.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <section className="rounded-md bg-white shadow-card p-card-padding space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-2">
              Identificação
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Nome completo *" error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="João da Silva"
                  autoFocus
                />
              </FormField>
              <FormField
                label="E-mail corporativo *"
                error={errors.email}
                hint="Usado para login no sistema"
              >
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="joao@dscar.com.br"
                />
              </FormField>
            </div>
          </section>

          {/* Dados trabalhistas */}
          <section className="rounded-md bg-white shadow-card p-card-padding space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-2">
              Dados trabalhistas
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Matrícula *" error={errors.registration_number}>
                <Input
                  value={form.registration_number}
                  onChange={(e) => set("registration_number", e.target.value)}
                  placeholder="DS001"
                />
              </FormField>
              <FormField label="Setor *" error={errors.department}>
                <select
                  value={form.department}
                  onChange={(e) => set("department", e.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Selecione...</option>
                  {(Object.entries(DEPARTMENT_LABELS) as [HRDepartment, string][]).map(
                    ([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    )
                  )}
                </select>
              </FormField>
              <FormField label="Cargo *" error={errors.position}>
                <select
                  value={form.position}
                  onChange={(e) => set("position", e.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Selecione...</option>
                  {(Object.entries(POSITION_LABELS) as [HRPosition, string][]).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Tipo de contrato *" error={errors.contract_type}>
                <select
                  value={form.contract_type}
                  onChange={(e) => set("contract_type", e.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {(Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][]).map(
                    ([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    )
                  )}
                </select>
              </FormField>
              <FormField label="Data de admissão *" error={errors.hire_date}>
                <Input
                  type="date"
                  value={form.hire_date}
                  onChange={(e) => set("hire_date", e.target.value)}
                />
              </FormField>
              <FormField label="Salário base (R$) *" error={errors.base_salary}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.base_salary || ""}
                  onChange={(e) => set("base_salary", parseFloat(e.target.value) || 0)}
                />
              </FormField>
              <FormField label="Carga horária semanal">
                <Input
                  type="number"
                  step="0.5"
                  value={form.weekly_hours ?? 44}
                  onChange={(e) => set("weekly_hours", parseFloat(e.target.value))}
                />
              </FormField>
              <FormField label="Escala">
                <Input
                  value={form.work_schedule ?? ""}
                  onChange={(e) => set("work_schedule", e.target.value)}
                  placeholder="6x1, 5x2, 12x36..."
                />
              </FormField>
              <FormField label="Periodicidade de pagamento" error={errors.pay_frequency}>
                <select
                  value={form.pay_frequency}
                  onChange={(e) => set("pay_frequency", e.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="monthly">Mensal</option>
                  <option value="biweekly">Quinzenal</option>
                  <option value="weekly">Semanal</option>
                </select>
              </FormField>
            </div>
          </section>

          {/* Dados pessoais básicos */}
          <section className="rounded-md bg-white shadow-card p-card-padding space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-2">
              Dados pessoais (opcional)
            </h2>
            <p className="text-xs text-neutral-500">
              CPF armazenado criptografado (LGPD). Pode ser preenchido depois na ficha do
              colaborador.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="CPF (apenas dígitos)">
                <Input
                  value={form.cpf ?? ""}
                  onChange={(e) => set("cpf", e.target.value)}
                  placeholder="00000000000"
                  maxLength={11}
                />
              </FormField>
              <FormField label="Data de nascimento">
                <Input
                  type="date"
                  value={form.birth_date ?? ""}
                  onChange={(e) => set("birth_date", e.target.value)}
                />
              </FormField>
              <FormField label="Contato de emergência — nome">
                <Input
                  value={form.emergency_contact_name ?? ""}
                  onChange={(e) => set("emergency_contact_name", e.target.value)}
                />
              </FormField>
            </div>
          </section>

          {/* Endereço */}
          <section className="rounded-md bg-white shadow-card p-card-padding space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-2">
              Endereço (opcional)
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="CEP">
                <Input
                  value={form.address_zip ?? ""}
                  onChange={(e) => set("address_zip", e.target.value)}
                  placeholder="69000-000"
                />
              </FormField>
              <FormField label="Logradouro">
                <Input
                  value={form.address_street ?? ""}
                  onChange={(e) => set("address_street", e.target.value)}
                />
              </FormField>
              <FormField label="Número">
                <Input
                  value={form.address_number ?? ""}
                  onChange={(e) => set("address_number", e.target.value)}
                />
              </FormField>
              <FormField label="Bairro">
                <Input
                  value={form.address_neighborhood ?? ""}
                  onChange={(e) => set("address_neighborhood", e.target.value)}
                />
              </FormField>
              <FormField label="Cidade">
                <Input
                  value={form.address_city ?? "Manaus"}
                  onChange={(e) => set("address_city", e.target.value)}
                />
              </FormField>
              <FormField label="Estado">
                <Input
                  value={form.address_state ?? "AM"}
                  onChange={(e) => set("address_state", e.target.value)}
                  maxLength={2}
                />
              </FormField>
            </div>
          </section>

          {/* Erro geral da API */}
          {create.isError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-4 py-3">
              {create.error?.message || "Erro ao admitir colaborador. Tente novamente."}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 justify-end">
            <Link
              href={"/rh/colaboradores" as Route}
              className="text-sm text-neutral-500 hover:underline"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {create.isPending ? "Admitindo..." : "Admitir colaborador"}
            </button>
          </div>
        </form>
      </div>
    </ErrorBoundary>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

function FormField({ label, error, hint, children }: FormFieldProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-neutral-700">{label}</Label>
      {children}
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
