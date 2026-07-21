import { Skeleton } from "@/components/ui/skeleton";

export function KpiSkeleton({ count = 6, compact = false }: { count?: number; compact?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`rounded-xl border border-slate-200 bg-white shadow-sm ${compact ? "p-3" : "p-5"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className={`${compact ? "h-5 w-20" : "h-7 w-28"}`} />
              <Skeleton className="h-2 w-16" />
            </div>
            <Skeleton className={`${compact ? "h-7 w-7" : "h-9 w-9"} rounded-lg`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BlockSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <Skeleton className="mb-4 h-3 w-32" />
      <Skeleton className="w-full" style={{ height }} />
    </div>
  );
}