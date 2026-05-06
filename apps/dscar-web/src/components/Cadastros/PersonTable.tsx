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
          ? "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-success-500/10 text-success-400"
          : "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted/30 text-muted-foreground"
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
    <div className="rounded-md border border-border bg-card shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
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
              <TableRow key={p.id} className="hover:bg-muted/30">
                {/* Avatar + nome */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={p.full_name} size="sm" />
                    <div>
                      <p className="font-medium text-foreground/90 leading-tight">{p.full_name}</p>
                      {p.fantasy_name && (
                        <p className="text-xs text-muted-foreground leading-tight">{p.fantasy_name}</p>
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
                <TableCell className="text-sm text-foreground/60">
                  {p.primary_contact ? (
                    <span>
                      <span className="text-muted-foreground text-xs mr-1">
                        {CONTACT_TYPE_LABEL[p.primary_contact.type]}
                      </span>
                      {p.primary_contact.value}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
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
