import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ReactNode } from "react";

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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  subtitle?: ReactNode;
  columns: DrillColumn<T>[];
  rows: T[];
  empty?: string;
  footer?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle className="text-base">{title}</DialogTitle>
          {subtitle ? <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div> : null}
        </DialogHeader>
        <div className="max-h-[65dvh] overflow-auto">
          {rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-400">{empty}</p>
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