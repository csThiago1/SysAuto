import { Skeleton } from "@/components/ui/skeleton";

interface SummaryCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  isLoading: boolean;
}

export function SummaryCard({ label, value, icon, iconBg, isLoading }: SummaryCardProps) {
  return (
    <div className="rounded-md bg-muted/50 shadow-card p-4 flex items-start gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-md shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        {isLoading ? (
          <Skeleton className="h-6 w-20 mt-0.5" />
        ) : (
          <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
        )}
      </div>
    </div>
  );
}
