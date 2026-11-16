"use client";

import Link from "next/link";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { useOverdueOrders } from "@/hooks/useOverdueOrders";
import { cn } from "@/lib/utils";

/** Pátio, atrasadas e entregas de hoje — o placar da oficina no topo do menu. */
export function usePlacar(): { patio?: number; atrasadas?: number; hoje?: number } {
  const { data: abertas } = useServiceOrders({ is_active: "true", exclude_closed: "true" }, 1, 1);
  const { data: prazos } = useOverdueOrders();
  return {
    patio: abertas?.count,
    atrasadas: prazos?.filter((o) => o.urgency === "overdue").length,
    hoje: prazos?.filter((o) => o.urgency === "due_today").length,
  };
}

function Numero({ valor, rotulo, alerta }: { valor?: number; rotulo: string; alerta?: boolean }) {
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "font-plate text-[26px] font-bold leading-none tabular-nums",
          alerta ? "text-primary" : "text-foreground"
        )}
      >
        {valor ?? "–"}
      </p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{rotulo}</p>
    </div>
  );
}

export function Placar({ className }: { className?: string }): React.ReactElement {
  const { patio, atrasadas, hoje } = usePlacar();
  return (
    <Link
      href="/os"
      aria-label={`${patio ?? 0} no pátio, ${atrasadas ?? 0} atrasadas, ${hoje ?? 0} para entregar hoje`}
      className={cn("grid grid-cols-3 gap-2 rounded-md transition-colors hover:bg-muted/40", className)}
    >
      <Numero valor={patio} rotulo="no pátio" />
      <Numero valor={atrasadas} rotulo="atrasadas" alerta={(atrasadas ?? 0) > 0} />
      <Numero valor={hoje} rotulo="para hoje" />
    </Link>
  );
}
