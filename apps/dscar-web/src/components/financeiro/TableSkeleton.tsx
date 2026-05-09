import { Skeleton } from "@/components/ui/skeleton";

export function FinanceiroTableSkeleton() {
  return (
    <div className="divide-y divide-white/5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-5 py-3.5 flex items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
