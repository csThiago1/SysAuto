/** Helpers de tempo da tela de apontamento. */

/** Segundos decorridos entre um ISO do servidor e agora (nunca negativo). */
export function elapsedSeconds(startIso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(startIso).getTime()) / 1000));
}

/** Formata segundos como HH:MM:SS. */
export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Formata horas decimais ("1.50") como "1h30". */
export function formatHoras(horas: string | number): string {
  const total = typeof horas === "string" ? parseFloat(horas) : horas;
  if (Number.isNaN(total)) return "—";
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/**
 * Date → valor de <input type="datetime-local"> no fuso LOCAL.
 * (Nunca usar toISOString().slice() aqui — deslocaria pro UTC.)
 */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Valor de datetime-local (interpretado como local) → ISO UTC pro backend. */
export function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString();
}
