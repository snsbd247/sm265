import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ReactNode } from "react";
import { AlertCircle, Inbox, Loader2 } from "lucide-react";

export type DrillColumn<T = any> = {
  key: string;
  label: string;
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
};

export function KpiDialog<T = any>({
  open,
  onOpenChange,
  title,
  subtitle,
  columns,
  rows,
  empty = "কোনো ডেটা নেই",
  footer,
  loading = false,
  error = null,
  onRetry,
  source,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  subtitle?: ReactNode;
  columns: DrillColumn<T>[];
  rows: T[];
  empty?: string;
  footer?: ReactNode;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  source?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle className="text-base">{title}</DialogTitle>
          {subtitle ? <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div> : null}
          {source ? <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">উৎস: {source}</div> : null}
        </DialogHeader>
        <div className="max-h-[65dvh] overflow-auto">
          {loading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 w-full animate-pulse rounded bg-slate-100" />
              ))}
              <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> লোড হচ্ছে…
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <AlertCircle className="h-8 w-8 text-rose-500" />
              <p className="text-sm font-semibold text-slate-700">ডেটা লোড করা যায়নি</p>
              <p className="text-xs text-slate-500">{error.message}</p>
              {onRetry ? (
                <button
                  onClick={onRetry}
                  className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >আবার চেষ্টা করুন</button>
              ) : null}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-slate-400">
              <Inbox className="h-8 w-8" />
              <p className="text-sm">{empty}</p>
              <p className="text-[11px]">এই ফিল্টারে ডেটাবেজে কোনো রেকর্ড পাওয়া যায়নি।</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={`px-4 py-2.5 ${c.align === "right" ? "text-right" : "text-left"}`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r: any, i) => (
                  <tr key={r?.id ?? i} className="hover:bg-slate-50">
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-4 py-2.5 align-top ${c.align === "right" ? "text-right" : ""}`}
                      >
                        {c.render ? c.render(r) : (r?.[c.key] ?? "-")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {footer ? <div className="border-t px-5 py-3 text-xs text-slate-500">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
}