"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABEL, type PaddockRole } from "@paddock/types";
import { apiFetch } from "@/lib/api";
import { useHasPermission } from "@/hooks/usePermission";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────────────────────────────────

interface PermissionCodes {
  [code: string]: string; // code -> label
}

interface PermissionMatrix {
  [role: string]: {
    [code: string]: boolean;
  };
}

interface MatrixResponse {
  permissions: PermissionCodes;
  matrix: PermissionMatrix;
}

interface OverrideItem {
  role: string;
  permission_code: string;
  allowed: boolean;
}

// ── Permission modules for grouped display ───────────────────────────────────

const PERMISSION_MODULES: Record<string, string> = {
  os: "Ordens de Servico",
  cadastros: "Cadastros",
  compras: "Compras",
  estoque: "Estoque",
  financeiro: "Financeiro",
  fiscal: "Fiscal",
  admin: "Administracao",
};

const EDITABLE_ROLES: PaddockRole[] = [
  "ADMIN",
  "MANAGER",
  "CONSULTANT",
  "STOREKEEPER",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupByModule(
  codes: PermissionCodes
): Record<string, { code: string; label: string }[]> {
  const groups: Record<string, { code: string; label: string }[]> = {};
  for (const [code, label] of Object.entries(codes)) {
    const module = code.split(".")[0];
    if (!groups[module]) groups[module] = [];
    groups[module].push({ code, label });
  }
  return groups;
}

// ── Page Component ───────────────────────────────────────────────────────────

export default function PermissoesPage() {
  const canManage = useHasPermission("admin.permissions");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<PermissionCodes>({});
  const [matrix, setMatrix] = useState<PermissionMatrix>({});
  const [originalMatrix, setOriginalMatrix] = useState<PermissionMatrix>({});

  // ── Fetch matrix ───────────────────────────────────────────────────────────

  const fetchMatrix = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<MatrixResponse>(
        "/api/proxy/authz/matrix/"
      );
      setPermissions(data.permissions);
      setMatrix(data.matrix);
      setOriginalMatrix(structuredClone(data.matrix));
    } catch {
      toast.error("Erro ao carregar matriz de permissoes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) {
      fetchMatrix();
    } else {
      setLoading(false);
    }
  }, [canManage, fetchMatrix]);

  // ── Toggle handler ─────────────────────────────────────────────────────────

  const handleToggle = (role: string, code: string) => {
    if (role === "OWNER") return; // OWNER is immutable
    setMatrix((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [code]: !prev[role]?.[code],
      },
    }));
  };

  // ── Detect changes ─────────────────────────────────────────────────────────

  const hasChanges = JSON.stringify(matrix) !== JSON.stringify(originalMatrix);

  // ── Save handler ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    // Build overrides: only send entries that differ from defaults
    const overrides: OverrideItem[] = [];
    for (const role of Object.keys(matrix)) {
      if (role === "OWNER") continue;
      for (const code of Object.keys(matrix[role])) {
        // We send ALL current states as overrides. The backend replaces
        // the entire override table atomically.
        overrides.push({
          role,
          permission_code: code,
          allowed: matrix[role][code],
        });
      }
    }

    try {
      setSaving(true);
      await apiFetch("/api/proxy/authz/matrix/update/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides }),
      });
      setOriginalMatrix(structuredClone(matrix));
      toast.success("Permissoes atualizadas com sucesso.");
    } catch {
      toast.error("Erro ao salvar permissoes.");
    } finally {
      setSaving(false);
    }
  };

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <Shield className="h-12 w-12" />
        <h1 className="text-lg font-medium text-foreground/60">
          Sem permissao
        </h1>
        <p className="text-sm">
          Voce nao tem acesso a configuracao de permissoes.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const grouped = groupByModule(permissions);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permissoes"
        description="Configure quais permissoes cada papel (role) tem no sistema."
        backHref="/configuracoes"
        actions={
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        }
      />

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium min-w-[250px] sticky left-0 bg-muted/50">
                Permissao
              </th>
              {/* OWNER column (disabled) */}
              <th className="text-center p-3 font-medium min-w-[100px]">
                <div className="flex flex-col items-center gap-0.5">
                  <span>{ROLE_LABEL.OWNER}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    (fixo)
                  </span>
                </div>
              </th>
              {EDITABLE_ROLES.map((role) => (
                <th key={role} className="text-center p-3 font-medium min-w-[100px]">
                  {ROLE_LABEL[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([module, perms]) => (
              <>
                {/* Module header row */}
                <tr key={`header-${module}`} className="bg-muted/30">
                  <td
                    colSpan={2 + EDITABLE_ROLES.length}
                    className="p-2 px-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    {PERMISSION_MODULES[module] ?? module}
                  </td>
                </tr>
                {perms.map(({ code, label }) => (
                  <tr
                    key={code}
                    className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="p-3 sticky left-0 bg-card">
                      <div>
                        <span className="font-medium">{label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {code}
                        </span>
                      </div>
                    </td>
                    {/* OWNER - always checked, disabled */}
                    <td className="text-center p-3">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled
                        className="accent-primary h-4 w-4 cursor-not-allowed opacity-50"
                      />
                    </td>
                    {EDITABLE_ROLES.map((role) => (
                      <td key={`${code}-${role}`} className="text-center p-3">
                        <input
                          type="checkbox"
                          checked={matrix[role]?.[code] ?? false}
                          onChange={() => handleToggle(role, code)}
                          className="accent-primary h-4 w-4 cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
