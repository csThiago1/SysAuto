"use client";

/**
 * EmployeeTable — Tabela de colaboradores com link para detalhe.
 */

import React from "react";
import Link from "next/link";
import type { Route } from "next";
import type { EmployeeListItem } from "@paddock/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui";
import { EmployeeStatusBadge } from "./EmployeeStatusBadge";

interface EmployeeTableProps {
  employees: EmployeeListItem[];
}

export function EmployeeTable({
  employees,
}: EmployeeTableProps): React.ReactElement {
  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-white/50">
        <p className="text-sm">Nenhum colaborador encontrado.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Colaborador</TableHead>
          <TableHead>Matrícula</TableHead>
          <TableHead>Setor</TableHead>
          <TableHead>Cargo</TableHead>
          <TableHead>Contrato</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Admissão</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((emp) => (
          <TableRow key={emp.id} className="cursor-pointer hover:bg-white/[0.03]">
            <TableCell>
              <Link
                href={`/rh/colaboradores/${emp.id}` as Route}
                className="flex flex-col hover:text-primary-600 transition-colors"
              >
                <span className="font-medium text-white">
                  {emp.user.name}
                </span>
              </Link>
            </TableCell>
            <TableCell className="font-mono text-sm text-white/60">
              {emp.registration_number}
            </TableCell>
            <TableCell className="text-sm text-white/60">
              {emp.department_display}
            </TableCell>
            <TableCell className="text-sm text-white/60">
              {emp.position_display}
            </TableCell>
            <TableCell className="text-sm text-white/60">
              {emp.contract_type_display}
            </TableCell>
            <TableCell>
              <EmployeeStatusBadge status={emp.status} />
            </TableCell>
            <TableCell className="text-sm text-white/50">
              {new Date(emp.hire_date).toLocaleDateString("pt-BR")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function EmployeeTableSkeleton(): React.ReactElement {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Colaborador</TableHead>
          <TableHead>Matrícula</TableHead>
          <TableHead>Setor</TableHead>
          <TableHead>Cargo</TableHead>
          <TableHead>Contrato</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Admissão</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 8 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: 7 }).map((_, j) => (
              <TableCell key={j}>
                <Skeleton className="h-4 w-full" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
