import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSales } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, ChevronLeft, ChevronRight, X, Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { downloadCSV } from "@/lib/export-utils";

export const Route = createFileRoute("/app/sales/")({ component: Page });

function Page() {
  const nav = useNavigate();
  const fn = useServerFn(listSales);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const q = useQuery({
    queryKey: ["sales", dateFrom, dateTo, typeFilter],
    queryFn: () => fn({ data: {
      from: dateFrom || undefined,
      to: dateTo || undefined,
      sale_type: typeFilter !== "all" ? (typeFilter as any) : undefined,
    } }),
  });

  const typeLabel: Record<string, string> = { cash: "নগদ", due: "বাকি", installment: "কিস্তি" };
  const typeVariant: Record<string, any> = { cash: "default", due: "secondary", installment: "outline" };

  const filtered = useMemo(() => {
    const list = q.data ?? [];
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter((r: any) =>
      (r.invoice_no ?? "").toLowerCase().includes(s) ||
      (r.customer?.name ?? "").toLowerCase().includes(s) ||
      (r.customer?.phone ?? "").toLowerCase().includes(s) ||
      (r.id ?? "").toLowerCase().includes(s),
    );
  }, [q.data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);
  const anyFilter = dateFrom || dateTo || typeFilter !== "all" || search;

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">বিক্রয়</h1>
          <p className="text-sm text-muted-foreground">মোট {filtered.length} টি ইনভয়েস</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={filtered.length === 0}
            onClick={() => downloadCSV(
              `sales-${new Date().toISOString().slice(0, 10)}`,
              ["তারিখ", "ইনভয়েস", "কাস্টমার", "ফোন", "ধরন", "মোট", "পরিশোধ", "বাকি"],
              filtered.map((s: any) => [
                (s.sale_date ?? "").slice(0, 10),
                s.invoice_no ?? s.id.slice(0, 8),
                s.customer?.name ?? "Walk-in",
                s.customer?.phone ?? "",
                typeLabel[s.sale_type] ?? s.sale_type,
                Number(s.total ?? 0),
                Number(s.paid ?? 0),
                Number(s.due ?? 0),
              ]),
            )}
          >
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button onClick={() => nav({ to: "/app/sales/new" })}><Plus className="mr-2 h-4 w-4" /> নতুন বিক্রয়</Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ইনভয়েস / ট্রানজেকশন আইডি / কাস্টমার / ফোন..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Input type="date" className="sm:w-40" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} title="From" />
        <Input type="date" className="sm:w-40" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} title="To" />
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">সব ধরন</SelectItem>
            <SelectItem value="cash">নগদ</SelectItem>
            <SelectItem value="due">বাকি</SelectItem>
            <SelectItem value="installment">কিস্তি</SelectItem>
          </SelectContent>
        </Select>
        {anyFilter && (
          <Button variant="outline" size="sm" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setTypeFilter("all"); setPage(1); }}>
            <X className="mr-1 h-3.5 w-3.5" /> ক্লিয়ার
          </Button>
        )}
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">তারিখ</th>
              <th className="px-4 py-3">ইনভয়েস</th>
              <th className="px-4 py-3">কাস্টমার</th>
              <th className="px-4 py-3">ধরন</th>
              <th className="px-4 py-3 text-right">মোট</th>
              <th className="px-4 py-3 text-right">পরিশোধ</th>
              <th className="px-4 py-3 text-right">বাকি</th>
              <th className="px-4 py-3 text-right">অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-t"><td colSpan={8} className="p-3"><Skeleton className="h-6 w-full" /></td></tr>
            ))}
            {!q.isLoading && paged.map((s: any) => (
              <tr key={s.id} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => nav({ to: "/app/sales/$saleId", params: { saleId: s.id } })}>
                <td className="px-4 py-3">{new Date(s.sale_date).toLocaleDateString("bn-BD")}</td>
                <td className="px-4 py-3 font-medium text-primary underline-offset-2 hover:underline">{s.invoice_no ?? s.id.slice(0, 8)}</td>
                <td className="px-4 py-3">{s.customer?.name ?? <span className="text-muted-foreground">Walk-in</span>}</td>
                <td className="px-4 py-3"><Badge variant={typeVariant[s.sale_type]}>{typeLabel[s.sale_type]}</Badge></td>
                <td className="px-4 py-3 text-right">৳{Number(s.total).toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-green-600">৳{Number(s.paid).toFixed(2)}</td>
                <td className={`px-4 py-3 text-right ${Number(s.due) > 0 ? "text-orange-600 font-semibold" : ""}`}>৳{Number(s.due).toFixed(2)}</td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => nav({ to: "/app/sales/$saleId", params: { saleId: s.id } })}
                  >
                    <Printer className="mr-1 h-3.5 w-3.5" /> রিসিট
                  </Button>
                </td>
              </tr>
            ))}
            {!q.isLoading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">এখনো কোনো বিক্রয় নেই। <Link to="/app/sales/new" className="text-primary underline">নতুন বিক্রয় শুরু করুন</Link></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-col items-center justify-between gap-2 sm:flex-row">
        <div className="text-xs text-muted-foreground">
          {filtered.length === 0 ? "0" : `${(pageSafe - 1) * pageSize + 1}–${Math.min(pageSafe * pageSize, filtered.length)}`} / {filtered.length}
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={pageSafe <= 1} onClick={() => setPage(pageSafe - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-xs font-semibold">{pageSafe} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={pageSafe >= totalPages} onClick={() => setPage(pageSafe + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
