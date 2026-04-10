"use client";

/**
 * PersonTable
 * Tabela de listagem de pessoas. Segue o padrão de arquitetura limpa:
 *  - Tipos: @paddock/types
 *  - Labels/utils: @paddock/utils
 *  - Componentes: @/components/ui (barrel)
 *  - Sem hooks internos — dados chegam via props
 */

import type { Person } from "@paddock/types";
import { CONTACT_TYPE_LABEL } from "@paddock/utils";
import { Pencil } from "lucide-react";
import {
  Button,
  Avatar,
  RoleBadge,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Skeleton,
  EmptyState,
} from "@/components/ui";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PersonTableProps {
  persons: Person[];
  onEdit: (person: Person) => void;
  isLoading?: boolean;
}

// ─── Skeleton de carregamento ─────────────────────────────────────────────────

function PersonTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

// ─── Célula de status ativo/inativo ──────────────────────────────────────────

function ActivePill({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700"
          : "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-500"
      }
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function PersonTable({ persons, onEdit, isLoading = false }: PersonTableProps) {
  if (isLoading) return <PersonTableSkeleton />;

  return (
    <div className="rounded-md border border-neutral-200 bg-white shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-neutral-50">
            <TableHead>Nome</TableHead>
            <TableHead>Categorias</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {persons.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5}>
                <EmptyState title="Nenhuma pessoa encontrada." />
              </TableCell>
            </TableRow>
          ) : (
            persons.map((p) => (
              <TableRow key={p.id} className="hover:bg-neutral-50">
                {/* Avatar + nome */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={p.full_name} logoUrl={p.logo_url} size="sm" />
                    <div>
                      <p className="font-medium text-neutral-900 leading-tight">{p.full_name}</p>
                      {p.fantasy_name && (
                        <p className="text-xs text-neutral-500 leading-tight">{p.fantasy_name}</p>
                      )}
                    </div>
                  </div>
                </TableCell>

                {/* Roles */}
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {p.roles.map((r) => (
                      <RoleBadge key={r.id} role={r.role} size="sm" />
                    ))}
                  </div>
                </TableCell>

                {/* Contato principal */}
                <TableCell className="text-sm text-neutral-600">
                  {p.primary_contact ? (
                    <span>
                      <span className="text-neutral-400 text-xs mr-1">
                        {CONTACT_TYPE_LABEL[p.primary_contact.type]}
                      </span>
                      {p.primary_contact.value}
                    </span>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </TableCell>

                {/* Situação */}
                <TableCell>
                  <ActivePill active={p.is_active} />
                </TableCell>

                {/* Ações */}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => onEdit(p)}
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
