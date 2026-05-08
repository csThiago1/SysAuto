"use client";

/**
 * DRE — Demonstração do Resultado do Exercício.
 * Exibe receitas, custos, despesas e resultado líquido por período.
 */

import React, { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { useDRE } from "@/hooks/useAccounting";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import type { DREGroup } from "@paddock/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: string): string {
  const n = parseFloat(value);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMonthRange(monthsBack: number): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // último dia do mês atual
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);
  return {
    start: start.toISOString().split("T")[0]!,
    end: end.toISOString().split("T")[0]!,
  };
}

const PERIOD_OPTIONS = [
  { label: "Mês atual", value: 0 },
  { label: "Trimestre", value: 2 },
  { label: "Semestre", value: 5 },
  { label: "Ano", value: 11 },
] as const;

// ── DRE Group Row ────────────────────────────────────────────────────────────

function DREGroupRow({
  label,
  group,
  type,
}: {
  label: string;
  group: DREGroup;
  type: "revenue" | "cost" | "neutral";
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const total = parseFloat(group.total);
  const hasDetail = group.detail.length > 0;

  const colorClass =
    type === "revenue"
      ? "text-success-600"
      : type === "cost"
      ? "text-error-600"
      : "text-foreground";

  return (
    <div>
      <button
        type="button"
        onClick={() => hasDetail && setOpen(!open)}
        className="flex items-center justify-between w-full py-2.5 px-4 hover:bg-muted/50 transition-colors rounded-md"
      >
        <div className="flex items-center gap-2">
          {hasDetail ? (
            open ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />
          ) : (
            <span className="w-3.5" />
          )}
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <span className={`text-sm font-semibold tabular-nums ${colorClass}`}>
          R$ {fmt(group.total)}
        </span>
      </button>

      {open && hasDetail && (
        <div className="ml-10 mb-1 space-y-0.5">
          {group.detail.map((item) => (
            <div
              key={item.code}
              className="flex items-center justify-between py-1 px-3 text-xs text-muted-foreground"
            >
              <span>
                <span className="font-mono text-muted-foreground/70 mr-2">{item.code}</span>
                {item.name}
              </span>
              <span className="tabular-nums">R$ {fmt(item.balance)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Subtotal Row ─────────────────────────────────────────────────────────────

function SubtotalRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}): React.ReactElement {
  const n = parseFloat(value);
  const colorClass = n > 0 ? "text-success-600" : n < 0 ? "text-error-600" : "text-foreground";

  return (
    <div
      className={`flex items-center justify-between py-2.5 px-4 ${
        highlight
          ? "bg-primary/5 border border-primary/20 rounded-lg"
          : "border-t border-border"
      }`}
    >
      <span className={`text-sm ${highlight ? "font-bold" : "font-semibold"} text-foreground`}>
        {label}
      </span>
      <span className={`text-sm font-bold tabular-nums ${colorClass}`}>
        R$ {fmt(value)}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DREPage(): React.ReactElement {
  const [selectedPeriod, setSelectedPeriod] = useState(0);
  const { start, end } = getMonthRange(PERIOD_OPTIONS[selectedPeriod]?.value ?? 0);

  const { data: dre, isLoading, isError } = useDRE(start, end);

  const resultado = parseFloat(dre?.resultado_liquido ?? "0");
  const ResultIcon = resultado > 0 ? TrendingUp : resultado < 0 ? TrendingDown : Minus;
  const resultColor = resultado > 0 ? "text-success-600" : resultado < 0 ? "text-error-600" : "text-muted-foreground";

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">DRE</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Demonstração do Resultado do Exercício
            </p>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-1">
            {PERIOD_OPTIONS.map((opt, idx) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setSelectedPeriod(idx)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedPeriod === idx
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Period info + resultado destaque */}
        {dre && (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-xs text-muted-foreground">
              Período: {new Date(start + "T12:00:00").toLocaleDateString("pt-BR")} a{" "}
              {new Date(end + "T12:00:00").toLocaleDateString("pt-BR")}
            </div>
            <div className={`flex items-center gap-1.5 ${resultColor}`}>
              <ResultIcon size={16} />
              <span className="text-sm font-bold tabular-nums">
                R$ {fmt(dre.resultado_liquido)}
              </span>
              <span className="text-xs text-muted-foreground ml-1">resultado líquido</span>
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="rounded-lg border border-error-200 bg-error-50 p-4 text-sm text-error-700">
            Erro ao carregar DRE. Verifique se o plano de contas está configurado.
          </div>
        )}

        {/* DRE Table */}
        {dre && !isLoading && (
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <BarChart3 size={18} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                Demonstração do Resultado
              </h2>
            </div>

            <div className="p-3 space-y-1">
              {/* Receita Bruta */}
              <DREGroupRow label="Receita Bruta" group={dre.receita_bruta} type="revenue" />

              {/* Deduções */}
              {parseFloat(dre.deducoes_receita.total) > 0 && (
                <DREGroupRow label="(–) Deduções da Receita" group={dre.deducoes_receita} type="cost" />
              )}

              {/* Receita Líquida */}
              <SubtotalRow label="= Receita Líquida" value={dre.receita_liquida} />

              {/* Custos (CMV/CSP) */}
              <DREGroupRow label="(–) Custos (CMV/CSP)" group={dre.custos} type="cost" />

              {/* Lucro Bruto */}
              <SubtotalRow label="= Lucro Bruto" value={dre.lucro_bruto} />

              {/* Despesas Operacionais */}
              <DREGroupRow label="(–) Despesas Operacionais" group={dre.despesas_operacionais} type="cost" />

              {/* Resultado Operacional */}
              <SubtotalRow label="= Resultado Operacional" value={dre.resultado_operacional} />

              {/* Resultado Financeiro */}
              {parseFloat(dre.resultado_financeiro.total) !== 0 && (
                <DREGroupRow label="(+/–) Resultado Financeiro" group={dre.resultado_financeiro} type="neutral" />
              )}

              {/* Resultado antes IR */}
              {parseFloat(dre.impostos_resultado.total) > 0 && (
                <>
                  <SubtotalRow label="= Resultado antes do IR" value={dre.resultado_antes_ir} />
                  <DREGroupRow label="(–) IR/CSLL" group={dre.impostos_resultado} type="cost" />
                </>
              )}

              {/* Resultado Líquido */}
              <SubtotalRow label="= RESULTADO LÍQUIDO" value={dre.resultado_liquido} highlight />
            </div>
          </div>
        )}

        {/* Empty state */}
        {dre && !isLoading && parseFloat(dre.receita_bruta.total) === 0 && parseFloat(dre.despesas_operacionais.total) === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum lançamento contábil encontrado para este período.
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
