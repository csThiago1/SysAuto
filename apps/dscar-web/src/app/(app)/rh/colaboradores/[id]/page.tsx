"use client";

/**
 * Ficha do Colaborador — tabs: Dados Pessoais, Documentos, Salário,
 * Bonificações, Vales, Descontos (Sprint 7).
 * Ponto, Escala, Contracheque → Sprint 8.
 */

import React from "react";
import { useParams, useRouter } from "next/navigation";
import type { Route } from "next";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useEmployee, useTerminateEmployee } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui";
import { EmployeeHeader } from "./_components/EmployeeHeader";
import { TabDadosPessoais } from "./_components/TabDadosPessoais";
import { TabDocumentos } from "./_components/TabDocumentos";
import { TabSalario } from "./_components/TabSalario";
import { TabBonificacoes } from "./_components/TabBonificacoes";
import { TabVales } from "./_components/TabVales";
import { TabDescontos } from "./_components/TabDescontos";

const TABS = [
  { id: "dados", label: "Dados pessoais" },
  { id: "documentos", label: "Documentos" },
  { id: "salario", label: "Salário" },
  { id: "bonus", label: "Bonificações" },
  { id: "vales", label: "Vales" },
  { id: "descontos", label: "Descontos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function EmployeeDetailPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<TabId>("dados");
  const [confirmTerminate, setConfirmTerminate] = React.useState(false);

  const { data: employee, isLoading, error } = useEmployee(params.id);
  const terminate = useTerminateEmployee(params.id);

  const handleTerminate = (): void => {
    if (!confirmTerminate) {
      setConfirmTerminate(true);
      return;
    }
    terminate.mutate(undefined, {
      onSuccess: () => {
        setConfirmTerminate(false);
        void router.push("/rh/colaboradores" as Route);
      },
    });
  };

  if (error) {
    return (
      <div className="rounded-md bg-error-500/10 border border-error-500/20 p-4 text-sm text-error-400">
        Erro ao carregar dados do colaborador.
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-5">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "RH" },
            { label: "Colaboradores", href: "/rh/colaboradores" },
            {
              label: isLoading
                ? "..."
                : (employee?.user.name ?? "Colaborador"),
            },
          ]}
        />

        {/* Header card */}
        {isLoading ? (
          <div className="rounded-md bg-muted/50 shadow-card p-card-padding">
            <div className="flex items-start gap-4">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-64" />
                <Skeleton className="h-3 w-80" />
              </div>
            </div>
          </div>
        ) : employee ? (
          <EmployeeHeader
            employee={employee}
            onTerminate={
              employee.status !== "terminated" ? handleTerminate : undefined
            }
          />
        ) : null}

        {/* Confirm terminate banner */}
        {confirmTerminate && (
          <div className="rounded-md border border-error-500/20 bg-error-500/10 p-3 flex items-center justify-between">
            <p className="text-sm text-error-400">
              Confirmar desligamento? Esta ação registra a data de hoje como
              desligamento.
            </p>
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => setConfirmTerminate(false)}
                className="text-xs text-error-400 hover:underline"
              >
                Cancelar
              </button>
              <button
                onClick={handleTerminate}
                disabled={terminate.isPending}
                className="rounded bg-error-600 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-red-700 disabled:opacity-50"
              >
                {terminate.isPending ? "..." : "Confirmar"}
              </button>
            </div>
          </div>
        )}

        {/* Tabs nav */}
        <div className="border-b border-border">
          <nav className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        {!employee ? null : (
          <div>
            {activeTab === "dados" && (
              <TabDadosPessoais employee={employee} />
            )}
            {activeTab === "documentos" && (
              <TabDocumentos employee={employee} />
            )}
            {activeTab === "salario" && <TabSalario employee={employee} />}
            {activeTab === "bonus" && (
              <TabBonificacoes employee={employee} />
            )}
            {activeTab === "vales" && (
              <TabVales employee={employee} />
            )}
            {activeTab === "descontos" && (
              <TabDescontos employee={employee} />
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
