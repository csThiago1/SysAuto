import { visibleSections, type NavSection } from "./nav-config";
import type { PaddockRole, ExtraPermission } from "@paddock/types";
import type { Route } from "next";

export type AreaId = "oficina" | "comercial" | "financeiro" | "gestao";

export const AREAS: readonly { id: AreaId; label: string; home: Route }[] = [
  { id: "oficina", label: "Oficina", home: "/os/kanban" },
  { id: "comercial", label: "Comercial", home: "/crm/retornos" },
  { id: "financeiro", label: "Financeiro", home: "/financeiro" },
  { id: "gestao", label: "Gestão", home: "/dashboard" },
];

export function isAreaId(value: unknown): value is AreaId {
  return AREAS.some((a) => a.id === value);
}

export function areaHome(area: AreaId): Route {
  return AREAS.find((a) => a.id === area)!.home;
}

const ROUTE_AREAS: readonly [string, AreaId][] = [
  ...["/os", "/os/kanban", "/os/nova", "/agenda", "/recepcao", "/apontamento", "/capacidade",
    "/orcamentos", "/estoque", "/compras", "/oficina"].map((p): [string, AreaId] => [p, "oficina"]),
  ...["/crm", "/orcamentos-particulares", "/comercial"].map((p): [string, AreaId] => [p, "comercial"]),
  ...["/financeiro", "/fiscal", "/rh"].map((p): [string, AreaId] => [p, "financeiro"]),
  ...["/dashboard", "/configuracoes", "/configuracao-motor", "/benchmark", "/auditoria", "/gestao"]
    .map((p): [string, AreaId] => [p, "gestao"]),
];

const SHARED_OS_DETAIL = /^\/os\/\d+(\/|$)/;
const SHARED_PREFIXES = ["/cadastros", "/veiculos"];

const matches = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(prefix + "/");

/** Área dona da rota; null para rota compartilhada ou desconhecida. Passe o pathname sem query. */
export function areaOfPath(pathname: string): AreaId | null {
  if (SHARED_OS_DETAIL.test(pathname) || SHARED_PREFIXES.some((p) => matches(pathname, p))) return null;
  let best: [string, AreaId] | null = null;
  for (const entry of ROUTE_AREAS) {
    if (matches(pathname, entry[0]) && (!best || entry[0].length > best[0].length)) best = entry;
  }
  return best ? best[1] : null;
}

export function defaultAreaForRole(role: string | undefined): AreaId {
  return role === "OWNER" || role === "ADMIN" ? "gestao" : "oficina";
}

export function sectionsForArea(
  role: PaddockRole,
  perms: ExtraPermission[],
  area: AreaId
): NavSection[] {
  return visibleSections(role, perms)
    .map((s) => ({ ...s, items: s.items.filter((i) => i.area === area) }))
    .filter((s) => s.items.length > 0);
}

export function visibleAreas(role: PaddockRole, perms: ExtraPermission[]): AreaId[] {
  const visible = visibleSections(role, perms);
  return AREAS.filter((a) => visible.some((s) => s.items.some((i) => i.area === a.id))).map((a) => a.id);
}
