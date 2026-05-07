"use client";

/**
 * TabAcesso — Gerenciamento de role RBAC e permissões granulares do colaborador.
 * Permite que gestores definam o nível de acesso e permissões extras.
 */

import React from "react";
import type { Employee, UpdateEmployeePayload } from "@paddock/types";
import { ROLE_LABEL, type PaddockRole } from "@paddock/types";
import { useUpdateEmployee } from "@/hooks";

interface TabAcessoProps {
  employee: Employee;
}

const ROLE_OPTIONS: PaddockRole[] = [
  "STOREKEEPER",
  "CONSULTANT",
  "MANAGER",
  "ADMIN",
  "OWNER",
];

export function TabAcesso({ employee }: TabAcessoProps): React.ReactElement {
  const update = useUpdateEmployee(employee.id);
  const [editing, setEditing] = React.useState(false);
  const [role, setRole] = React.useState<string>(employee.role ?? "CONSULTANT");
  const [perms, setPerms] = React.useState<string[]>(
    employee.extra_permissions ?? []
  );

  const availablePerms = employee.available_permissions ?? [];

  const handleTogglePerm = (code: string): void => {
    setPerms((prev) =>
      prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]
    );
  };

  const handleSave = (): void => {
    const payload: UpdateEmployeePayload = {
      role: role as PaddockRole,
      extra_permissions: perms,
    };
    update.mutate(payload, {
      onSuccess: () => setEditing(false),
    });
  };

  const handleCancel = (): void => {
    setRole(employee.role ?? "CONSULTANT");
    setPerms(employee.extra_permissions ?? []);
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Role */}
      <section className="rounded-md bg-muted/50 shadow-card p-card-padding">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">
            Nível de acesso
          </h3>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-primary hover:underline"
            >
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="text-xs text-muted-foreground hover:underline"
                disabled={update.isPending}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={update.isPending}
                className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                {update.isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm w-64"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Gerentes e acima possuem todas as permissões automaticamente.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {ROLE_LABEL[(employee.role as PaddockRole) ?? "CONSULTANT"] ?? employee.role}
            </span>
            <span className="text-xs text-muted-foreground">
              {employee.user?.name ?? "—"}
            </span>
          </div>
        )}
      </section>

      {/* Permissões granulares */}
      <section className="rounded-md bg-muted/50 shadow-card p-card-padding">
        <h3 className="text-base font-semibold text-foreground mb-1">
          Permissões extras
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Marque as permissões adicionais para este colaborador. Gerentes e
          acima possuem todas automaticamente.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {availablePerms.map(({ code, label }) => {
            const checked = perms.includes(code);
            return (
              <label
                key={code}
                className={`flex items-center gap-3 rounded-md border p-3 transition-colors cursor-pointer ${
                  editing
                    ? "hover:bg-muted border-border"
                    : "border-transparent"
                } ${checked ? "bg-primary/5 border-primary/20" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!editing}
                  onChange={() => handleTogglePerm(code)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary disabled:opacity-50"
                />
                <span
                  className={`text-sm ${
                    checked ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}
