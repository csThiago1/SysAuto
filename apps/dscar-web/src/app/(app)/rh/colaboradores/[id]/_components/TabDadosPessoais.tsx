"use client";

/**
 * TabDadosPessoais — Dados pessoais, endereço e contato de emergência.
 * CPF sempre mascarado (LGPD). Permite edição inline via PATCH.
 */

import React from "react";
import type { Employee, UpdateEmployeePayload } from "@paddock/types";
import { useUpdateEmployee } from "@/hooks";

const PAY_FREQUENCY_LABELS: Record<"monthly" | "biweekly" | "weekly", string> = {
  monthly: "Mensal",
  biweekly: "Quinzenal",
  weekly: "Semanal",
};

interface TabDadosPessoaisProps {
  employee: Employee;
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-white/50 uppercase tracking-wide">
        {label}
      </dt>
      <dd className="text-sm text-white">{value || "—"}</dd>
    </div>
  );
}

export function TabDadosPessoais({
  employee,
}: TabDadosPessoaisProps): React.ReactElement {
  const update = useUpdateEmployee(employee.id);
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState<UpdateEmployeePayload>({
    marital_status: employee.marital_status,
    education_level: employee.education_level,
    nationality: employee.nationality,
    emergency_contact_name: employee.emergency_contact_name,
    address_street: employee.address_street,
    address_number: employee.address_number,
    address_complement: employee.address_complement,
    address_neighborhood: employee.address_neighborhood,
    address_city: employee.address_city,
    address_state: employee.address_state,
    address_zip: employee.address_zip,
    pay_frequency: employee.pay_frequency,
  });

  const handleSave = (): void => {
    update.mutate(form, { onSuccess: () => setEditing(false) });
  };

  return (
    <div className="space-y-6">
      {/* Dados pessoais */}
      <section className="rounded-md bg-white/5 shadow-card p-card-padding">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">
            Dados pessoais
          </h3>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-primary-600 hover:underline"
            >
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="text-xs text-white/50 hover:underline"
                disabled={update.isPending}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={update.isPending}
                className="text-xs font-medium text-primary-600 hover:underline disabled:opacity-50"
              >
                {update.isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          )}
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InfoRow label="CPF (mascarado)" value={employee.cpf_masked} />
          <InfoRow label="RG — Órgão emissor" value={employee.rg_issuer} />
          <InfoRow
            label="Data de nascimento"
            value={
              employee.birth_date
                ? new Date(employee.birth_date).toLocaleDateString("pt-BR")
                : null
            }
          />
          {editing ? (
            <>
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wide">
                  Estado civil
                </label>
                <input
                  className="rounded border border-white/10 px-2 py-1 text-sm"
                  value={form.marital_status ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, marital_status: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wide">
                  Escolaridade
                </label>
                <input
                  className="rounded border border-white/10 px-2 py-1 text-sm"
                  value={form.education_level ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, education_level: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wide">
                  Nacionalidade
                </label>
                <input
                  className="rounded border border-white/10 px-2 py-1 text-sm"
                  value={form.nationality ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, nationality: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wide">
                  Periodicidade de pagamento
                </label>
                <select
                  className="rounded border border-white/10 px-2 py-1 text-sm"
                  value={form.pay_frequency ?? "monthly"}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      pay_frequency: e.target.value as "monthly" | "biweekly" | "weekly",
                    }))
                  }
                >
                  <option value="monthly">Mensal</option>
                  <option value="biweekly">Quinzenal</option>
                  <option value="weekly">Semanal</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <InfoRow label="Estado civil" value={employee.marital_status} />
              <InfoRow label="Escolaridade" value={employee.education_level} />
              <InfoRow label="Nacionalidade" value={employee.nationality} />
              <InfoRow
                label="Periodicidade de pagamento"
                value={PAY_FREQUENCY_LABELS[employee.pay_frequency] ?? employee.pay_frequency}
              />
            </>
          )}
        </dl>
      </section>

      {/* Endereço */}
      <section className="rounded-md bg-white/5 shadow-card p-card-padding">
        <h3 className="text-base font-semibold text-white mb-4">
          Endereço
        </h3>
        {editing ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {(
              [
                ["address_zip", "CEP"],
                ["address_street", "Logradouro"],
                ["address_number", "Número"],
                ["address_complement", "Complemento"],
                ["address_neighborhood", "Bairro"],
                ["address_city", "Cidade"],
                ["address_state", "Estado"],
              ] as [keyof UpdateEmployeePayload, string][]
            ).map(([field, label]) => (
              <div key={field} className="flex flex-col gap-0.5">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wide">
                  {label}
                </label>
                <input
                  className="rounded border border-white/10 px-2 py-1 text-sm"
                  value={(form[field] as string) ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [field]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <InfoRow label="CEP" value={employee.address_zip} />
            <InfoRow label="Logradouro" value={employee.address_street} />
            <InfoRow label="Número" value={employee.address_number} />
            <InfoRow label="Complemento" value={employee.address_complement} />
            <InfoRow label="Bairro" value={employee.address_neighborhood} />
            <InfoRow label="Cidade" value={employee.address_city} />
            <InfoRow label="Estado" value={employee.address_state} />
          </dl>
        )}
      </section>

      {/* Contato emergência */}
      <section className="rounded-md bg-white/5 shadow-card p-card-padding">
        <h3 className="text-base font-semibold text-white mb-4">
          Contato de emergência
        </h3>
        {editing ? (
          <div className="flex flex-col gap-0.5">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wide">
              Nome
            </label>
            <input
              className="rounded border border-white/10 px-2 py-1 text-sm w-64"
              value={form.emergency_contact_name ?? ""}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  emergency_contact_name: e.target.value,
                }))
              }
            />
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-4">
            <InfoRow
              label="Nome"
              value={employee.emergency_contact_name}
            />
          </dl>
        )}
      </section>
    </div>
  );
}
