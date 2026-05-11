/**
 * Retorna tempo relativo compacto: "2h", "3d", "1m", "agora".
 * Usado nos cards de OS para mostrar há quanto tempo foi criada/atualizada.
 */
export function timeAgo(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  if (diffMs < 0) return 'agora';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}m`;

  const years = Math.floor(months / 12);
  return `${years}a`;
}
