"use client";

import Link from "next/link";
import { useServiceOrders } from "@/hooks/useServiceOrders";
import { useOverdueOrders } from "@/hooks/useOverdueOrders";
import { cn } from "@/lib/utils";

/** Pátio, atrasadas e entregas de hoje — o placar da oficina no topo do menu. */
export function usePlacar(enabled: boolean = true): { patio?: number; atrasadas?: number; hoje?: number } {
  const { data: abertas } = useServiceOrders({ is_active: "true", exclude_closed: "true" }, 1, 1, enabled);
  const { data: prazos } = useOverdueOrders();
  return {
    patio: abertas?.count,
    atrasadas: prazos?.filter((o) => o.urgency === "overdue").length,
    hoje: prazos?.filter((o) => o.urgency === "due_today").length,
  };
}

function Numero({
  valor,
  rotulo,
  alerta,
  torre,
}: {
  valor?: number;
  rotulo: string;
  alerta?: boolean;
  torre?: boolean;
}) {
  return (
    <div className={cn("min-w-0", torre && "flex items-baseline gap-2")}>
      <p
        className={cn(
          "font-plate font-bold leading-none tabular-nums",
          torre ? "w-7 shrink-0 text-right text-[20px]" : "text-[26px]",
          alerta ? "text-primary" : "text-foreground"
        )}
      >
        {valor ?? "–"}
      </p>
      <p className={cn("truncate text-[11px] text-muted-foreground", !torre && "mt-1")}>{rotulo}</p>
    </div>
  );
}

/** `torre`: os três números empilhados, como a torre de tempos da F1 (ao lado do logo). */
export function Placar({ className, torre }: { className?: string; torre?: boolean }): React.ReactElement {
  const { patio, atrasadas, hoje } = usePlacar();
  return (
    <Link
      href="/os"
      aria-label={`${patio ?? 0} no pátio, ${atrasadas ?? 0} atrasadas, ${hoje ?? 0} para entregar hoje`}
      className={cn(
        "rounded-md transition-colors hover:bg-muted/40",
        torre ? "flex flex-col justify-between py-0.5" : "grid grid-cols-3 gap-2",
        className
      )}
    >
      <Numero torre={torre} valor={patio} rotulo="no pátio" />
      <Numero torre={torre} valor={atrasadas} rotulo="atrasadas" alerta={(atrasadas ?? 0) > 0} />
      <Numero torre={torre} valor={hoje} rotulo="para hoje" />
    </Link>
  );
}
