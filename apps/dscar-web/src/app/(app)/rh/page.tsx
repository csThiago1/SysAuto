"use client";

/**
 * RH Dashboard — Visão geral do módulo de Recursos Humanos.
 * Headcount por status, alertas de documentos vencidos, links rápidos.
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  Users,
  UserCheck,
  UserMinus,
  Palmtree,
  FileWarning,
  ArrowRight,
} from "lucide-react";
import { useEmployees } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StatCard } from "@/app/(app)/dashboard/_components/StatCard";

export default function RHDashboardPage(): React.ReactElement {
  const { data: activeData, isLoading: loadingActive } = useEmployees({
    status: "active",
  });
  const { data: leaveData, isLoading: loadingLeave } = useEmployees({
    status: "on_leave",
  });
  const { data: vacationData, isLoading: loadingVacation } = useEmployees({
    status: "vacation",
  });
  const { data: allData, isLoading: loadingAll } = useEmployees();

  const isLoading =
    loadingActive || loadingLeave || loadingVacation || loadingAll;

  const totalActive = activeData?.count ?? 0;
  const totalLeave = leaveData?.count ?? 0;
  const totalVacation = vacationData?.count ?? 0;
  const totalHeadcount = allData?.count ?? 0;

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Recursos Humanos
            </h1>
            <p className="mt-0.5 text-sm text-white/50">
              Gestão de colaboradores, ponto, metas e folha
            </p>
          </div>
          <Link
            href={"/rh/colaboradores/novo" as Route}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            + Admitir colaborador
          </Link>
        </div>

        {/* Headcount stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <StatCard.Skeleton key={i} />
            ))
          ) : (
            <>
              <StatCard
                label="Headcount total"
                value={totalHeadcount}
                icon={<Users className="h-5 w-5 text-primary-600" />}
              />
              <StatCard
                label="Ativos"
                value={totalActive}
                icon={<UserCheck className="h-5 w-5 text-success-400" />}
              />
              <StatCard
                label="Afastados"
                value={totalLeave}
                icon={<UserMinus className="h-5 w-5 text-warning-400" />}
              />
              <StatCard
                label="Férias"
                value={totalVacation}
                icon={<Palmtree className="h-5 w-5 text-white/50" />}
              />
            </>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href as Route}
              className="flex items-center justify-between rounded-md bg-white/5 p-4 shadow-card hover:shadow-card-hover transition-shadow duration-normal group"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-md ${link.iconBg}`}
                >
                  <link.Icon className={`h-4 w-4 ${link.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {link.label}
                  </p>
                  <p className="text-xs text-white/50">{link.description}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-white/40 group-hover:text-primary-600 transition-colors" />
            </Link>
          ))}
        </div>

        {/* Docs expiry alert placeholder */}
        <div className="rounded-md border border-warning-500/20 bg-warning-500/10 p-4 flex items-start gap-3">
          <FileWarning className="h-5 w-5 text-warning-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-warning-400">
              Documentos a vencer
            </p>
            <p className="text-xs text-warning-400 mt-0.5">
              Confira os documentos dos colaboradores com validade próxima nas
              páginas individuais.
            </p>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

const QUICK_LINKS = [
  {
    href: "/rh/colaboradores",
    label: "Colaboradores",
    description: "Lista e fichas dos colaboradores",
    Icon: Users,
    iconBg: "bg-white/[0.06]",
    iconColor: "text-primary-400",
  },
  {
    href: "/rh/ponto",
    label: "Ponto",
    description: "Registro e espelho de ponto",
    Icon: UserCheck,
    iconBg: "bg-white/[0.06]",
    iconColor: "text-success-400",
  },
  {
    href: "/rh/metas",
    label: "Metas",
    description: "Metas individuais e por setor",
    Icon: Users,
    iconBg: "bg-white/[0.06]",
    iconColor: "text-info-400",
  },
  {
    href: "/rh/vales",
    label: "Vales e Benefícios",
    description: "Solicitações e aprovações",
    Icon: FileWarning,
    iconBg: "bg-white/5",
    iconColor: "text-white/50",
  },
  {
    href: "/rh/folha",
    label: "Folha de Pagamento",
    description: "Contracheques e fechamentos",
    Icon: UserMinus,
    iconBg: "bg-white/[0.06]",
    iconColor: "text-warning-400",
  },
];
