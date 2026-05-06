"use client";

/**
 * Cadastros — Página principal do módulo de pessoas
 * Segue arquitetura limpa:
 *  - Tipos: @paddock/types
 *  - Utils: @paddock/utils
 *  - Hooks: @/hooks (barrel)
 *  - UI: @/components/ui (barrel)
 */

import React, { useState } from "react";
import { UserPlus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { Person, PersonRole, ModalProps } from "@paddock/types";
import { usePersons, useDebounce } from "@/hooks";
import { Button, Input, Skeleton, PageHeader, TableSkeleton, EmptyState } from "@/components/ui";
import { PermissionGate } from "@/components/PermissionGate";
import { PersonTable } from "./PersonTable";
import { PersonFormModal } from "./PersonFormModal";

// ─── Config de abas ───────────────────────────────────────────────────────────

type TabId = "ALL" | PersonRole;

const TABS: { id: TabId; label: string }[] = [
  { id: "ALL",      label: "Todos" },
  { id: "CLIENT",   label: "Clientes" },
  { id: "INSURER",  label: "Seguradoras" },
  { id: "BROKER",   label: "Corretores" },
  { id: "EMPLOYEE", label: "Funcionários" },
  { id: "SUPPLIER", label: "Fornecedores" },
];

// ─── Componente principal ─────────────────────────────────────────────────────

export function Cadastros(): React.ReactElement {
  const [activeTab, setActiveTab]       = useState<TabId>("ALL");
  const [searchInput, setSearchInput]   = useState("");
  const [modalOpen, setModalOpen]       = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [page, setPage]                 = useState(1);

  const debouncedSearch = useDebounce(searchInput, 300);

  const { data, isLoading, isError } = usePersons({
    role:   activeTab === "ALL" ? undefined : activeTab,
    search: debouncedSearch || undefined,
    page,
  });

  // Reset page when filters change
  function handleTabChange(tab: TabId): void {
    setActiveTab(tab);
    setPage(1);
  }

  function handleSearchChange(value: string): void {
    setSearchInput(value);
    setPage(1);
  }

  function handleEdit(person: Person): void {
    setEditingPerson(person);
    setModalOpen(true);
  }

  function handleNew(): void {
    setEditingPerson(null);
    setModalOpen(true);
  }

  const modalProps: ModalProps = {
    open: modalOpen,
    onOpenChange: setModalOpen,
  };

  const totalPages = data ? Math.ceil(data.count / data.results.length || 1) : 1;
  const hasNext = data?.next != null;
  const hasPrev = page > 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cadastros"
        description="Gerencie clientes, seguradoras, corretores, funcionários e fornecedores"
        actions={
          <PermissionGate role="CONSULTANT">
            <Button onClick={handleNew}>
              <UserPlus className="h-4 w-4" />
              Nova Pessoa
            </Button>
          </PermissionGate>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground/70 hover:border-border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nome, documento ou contato..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {isLoading && <TableSkeleton columns={5} />}

      {isError && (
        <EmptyState 
          title="Erro de Servidor" 
          description="Ocorreu um erro ao buscar os clientes. Tente novamente mais tarde." 
          className="bg-card border border-border rounded-md"
        />
      )}

      {!isLoading && !isError && data && (
        <>
          {data.results.length === 0 ? (
            <EmptyState
              title="Nenhuma Pessoa Encontrada"
              description={searchInput ? `Nenhuma pessoa corresponde à busca "${searchInput}"` : "Comece cadastrando uma nova pessoa."}
              className="bg-card border border-border rounded-md"
            />
          ) : (
            <>
              <PersonTable persons={data.results} onEdit={handleEdit} />

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  {data.count} registro{data.count !== 1 ? "s" : ""} encontrado{data.count !== 1 ? "s" : ""}
                  {data.count > data.results.length && ` · página ${page}`}
                </p>
                {(hasNext || hasPrev) && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasPrev}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="text-xs font-medium text-foreground/60 px-2">
                      {page}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasNext}
                      onClick={() => setPage((p) => p + 1)}
                      className="gap-1"
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Modal — recebe ModalProps tipado + person opcional */}
      <PersonFormModal {...modalProps} person={editingPerson} />
    </div>
  );
}

