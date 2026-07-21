import { Database } from "lucide-react";

// Small caption shown on each KPI card describing where the number came
// from. Users kept asking "which table / date range does this reflect?" —
// exposing it inline stops them from guessing.
export function CardMeta({ source, filter }: { source: string; filter?: string }) {
  return (
    <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[10px] leading-tight text-slate-400">
      <Database className="h-3 w-3 shrink-0" />
      <span className="truncate">
        <span className="font-semibold text-slate-500">{source}</span>
        {filter ? <span className="text-slate-400"> · {filter}</span> : null}
      </span>
    </div>
  );
}