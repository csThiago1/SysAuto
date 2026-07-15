"use client";

import { useEffect, useState } from "react";
import { elapsedSeconds, formatElapsed } from "../_lib/time";

interface TimerRingProps {
  startIso: string;
}

/**
 * Anel de timer. O decorrido é sempre derivado do timestamp do servidor —
 * o intervalo só força re-render; fechar/reabrir o PWA não perde nada.
 */
export function TimerRing({ startIso }: TimerRingProps): React.ReactElement {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const seconds = elapsedSeconds(startIso);
  // volta completa por hora — só indicação visual de progresso
  const fraction = (seconds % 3600) / 3600;
  const R = 84;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="relative h-48 w-48">
      <svg viewBox="0 0 192 192" className="h-full w-full -rotate-90">
        <circle
          cx="96" cy="96" r={R} fill="none" strokeWidth="10"
          className="stroke-muted"
        />
        <circle
          cx="96" cy="96" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset]"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - fraction)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-3xl font-bold tabular-nums">
          {formatElapsed(seconds)}
        </span>
      </div>
    </div>
  );
}
