interface FinanceiroStatusBadgeProps {
  status: string;
  labels: Record<string, string>;
  colors: Record<string, string>;
}

export function FinanceiroStatusBadge({ status, labels, colors }: FinanceiroStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors[status] ?? ""}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
