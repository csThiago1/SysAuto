"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { ExtraPermission, PaddockRole } from "@paddock/types";
import { areaHome, areaOfPath, defaultAreaForRole, isAreaId, visibleAreas, type AreaId } from "./areas";

const KEY = "dscar-area";

function readStored(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function writeStored(area: AreaId): void {
  try {
    sessionStorage.setItem(KEY, area);
  } catch {
    // sem storage: segue só com a rota e o padrão do papel
  }
}

export function useActiveArea(): { area: AreaId; areas: AreaId[]; setArea: (a: AreaId) => void } {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.role ?? "STOREKEEPER") as PaddockRole;
  const perms = (session?.extraPermissions ?? []) as ExtraPermission[];
  const areas = useMemo(() => visibleAreas(role, perms), [role, perms]);

  // lido depois de montar para não quebrar a hidratação
  const [stored, setStored] = useState<string | null>(null);
  useEffect(() => setStored(readStored()), [pathname]);

  const fromPath = areaOfPath(pathname ?? "");
  const pathArea = fromPath && areas.includes(fromPath) ? fromPath : null;

  useEffect(() => {
    if (pathArea) {
      writeStored(pathArea);
      setStored(pathArea); // a próxima rota compartilhada já renderiza esta área
    }
  }, [pathArea]);

  const fallback = defaultAreaForRole(session?.role);
  const area: AreaId =
    pathArea ??
    (isAreaId(stored) && areas.includes(stored) ? stored : null) ??
    (areas.includes(fallback) ? fallback : null) ??
    areas[0] ??
    "oficina";

  const setArea = useCallback(
    (a: AreaId) => {
      writeStored(a);
      setStored(a);
      router.push(areaHome(a));
    },
    [router],
  );

  return { area, areas, setArea };
}
