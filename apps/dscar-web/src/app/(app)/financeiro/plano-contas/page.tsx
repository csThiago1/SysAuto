"use client";

/**
 * Plano de Contas — Arvore hierarquica interativa com colapso por nivel.
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import { BookOpen, ChevronRight, ChevronDown, Dot, PlusCircle } from "lucide-react";
import { useChartOfAccountsTree } from "@/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { ChartOfAccountNode, AccountType, NatureType } from "@paddock/types";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_COLOR,
  NATURE_LABELS,
} from "@paddock/types";
import { cn } from "@/lib/utils";

// ── Tree node ─────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: ChartOfAccountNode;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  searchTerm: string;
}

function matchesSearch(node: ChartOfAccountNode, term: string): boolean {
  if (!term) return true;
  const lower = term.toLowerCase();
  if (
    node.code.toLowerCase().includes(lower) ||
    node.name.toLowerCase().includes(lower)
  ) {
    return true;
  }
  return node.children.some((child) => matchesSearch(child, term));
}

function TreeNode({
  node,
  depth,
  expandedIds,
  onToggle,
  searchTerm,
}: TreeNodeProps): React.ReactElement | null {
  if (searchTerm && !matchesSearch(node, searchTerm)) return null;

  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const indent = depth * 20;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 hover:bg-neutral-50 transition-colors",
          depth === 0 && "bg-neutral-50/60 font-medium",
          node.is_analytical && "italic"
        )}
        style={{ paddingLeft: `${16 + indent}px` }}
      >
        {/* Expand/collapse or bullet */}
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(
            "flex h-5 w-5 items-center justify-center rounded shrink-0",
            hasChildren
              ? "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200"
              : "text-neutral-300 cursor-default"
          )}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <Dot className="h-4 w-4" />
          )}
        </button>

        {/* Code */}
        <span className="font-mono text-xs text-neutral-500 shrink-0 w-24 truncate">
          {node.code}
        </span>

        {/* Name */}
        <span
          className={cn(
            "flex-1 text-sm min-w-0 truncate",
            depth === 0 ? "font-semibold text-neutral-900" : "text-neutral-700"
          )}
          title={node.name}
        >
          {node.name}
        </span>

        {/* Badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold",
              ACCOUNT_TYPE_COLOR[node.account_type as AccountType]
            )}
          >
            {ACCOUNT_TYPE_LABELS[node.account_type as AccountType]}
          </span>

          {node.is_analytical ? (
            <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold bg-neutral-100 text-neutral-600 border-neutral-200">
              Analitica
            </span>
          ) : (
            <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold bg-white text-neutral-400 border-neutral-200">
              Sintetica
            </span>
          )}

          <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold bg-neutral-50 text-neutral-600 border-neutral-200">
            {NATURE_LABELS[node.nature as NatureType]}
          </span>

          {!node.is_active && (
            <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold bg-red-50 text-red-600 border-red-200">
              Inativa
            </span>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              searchTerm={searchTerm}
            />
          ))}
        </>
      )}
    </>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PlanoContasSkeleton(): React.ReactElement {
  return (
    <div className="space-y-1 p-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1 max-w-xs" />
          <Skeleton className="h-5 w-16 rounded" />
          <Skeleton className="h-5 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function countNodes(nodes: ChartOfAccountNode[]): number {
  return nodes.reduce(
    (acc, node) => acc + 1 + countNodes(node.children),
    0
  );
}

function collectTopLevelIds(nodes: ChartOfAccountNode[]): string[] {
  return nodes.map((n) => n.id);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlanoContasPage(): React.ReactElement {
  const { data: tree, isLoading } = useChartOfAccountsTree();
  const [search, setSearch] = React.useState("");
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  // Initialize: expand level-1 nodes when tree loads
  React.useEffect(() => {
    if (tree && tree.length > 0) {
      const topIds = collectTopLevelIds(tree);
      setExpandedIds(new Set(topIds));
    }
  }, [tree]);

  const handleToggle = (id: string): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const totalCount = tree ? countNodes(tree) : 0;

  const expandAll = (): void => {
    if (!tree) return;
    const ids = new Set<string>();
    function collect(nodes: ChartOfAccountNode[]): void {
      for (const node of nodes) {
        ids.add(node.id);
        collect(node.children);
      }
    }
    collect(tree);
    setExpandedIds(ids);
  };

  const collapseAll = (): void => {
    setExpandedIds(new Set());
  };

  return (
    <ErrorBoundary>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-neutral-900">Plano de Contas</h1>
                {!isLoading && (
                  <Badge variant="secondary">{totalCount} contas</Badge>
                )}
              </div>
              <p className="mt-0.5 text-sm text-neutral-500">
                Estrutura hierarquica do plano contabil DS Car
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="text-xs text-neutral-500 hover:text-primary-600 transition-colors px-2 py-1 rounded hover:bg-neutral-100"
            >
              Expandir tudo
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="text-xs text-neutral-500 hover:text-primary-600 transition-colors px-2 py-1 rounded hover:bg-neutral-100"
            >
              Recolher tudo
            </button>
            <Link
              href={"/financeiro/plano-contas/nova" as Route}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Nova Conta
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Filtrar por codigo ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Tree */}
        <div className="rounded-md bg-white shadow-card overflow-hidden">
          {isLoading ? (
            <PlanoContasSkeleton />
          ) : !tree || tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-400">
              <BookOpen className="h-10 w-10" />
              <p className="text-sm font-medium">Plano de contas nao encontrado</p>
              <p className="text-xs">
                Execute o comando de setup para importar o plano de contas.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-50">
              {tree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  expandedIds={expandedIds}
                  onToggle={handleToggle}
                  searchTerm={search}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
