import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSales } from "@/lib/sales.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, ChevronLeft, ChevronRight, X, Download, Printer, Receipt, Ban, Filter } from "lucide-react";
import { useMemo } from "react";
import { downloadCSV } from "@/lib/export-utils";

const searchSchema = z.object({
  tab: fallback(z.string(), "all").default("all"),
  q: fallback(z.string(), "").default(""),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
  page: fallback(z.number().int(), 1).default(1),
  size: fallback(z.number().int(), 25).default(25),
});

const VALID_TABS = ["all", "cash", "due", "installment", "cancelled"] as const;

export const Route = createFileRoute("/app/sales/")({
  validateSearch: zodValidator(searchSchema),
  component: Page,
});

function Page() {
  const nav = useNavigate();
  const fn = useServerFn(listSales);
  const sp = Route.useSearch();
  const tab = (VALID_TABS as readonly string[]).includes(sp.tab) ? sp.tab : "all";
  const dateFrom = sp.from;
  const dateTo = sp.to;
  const search = sp.q;
  const pageSize = [10, 25, 50, 100].includes(sp.size) ? sp.size : 25;
  const page = Math.max(1, sp.page);

  const update = (patch: Record<string, unknown>) => {
    nav({ to: "/app/sales", search: (prev: any) => ({ ...prev, ...patch }) });
  };

  const q = useQuery({
    queryKey: ["sales", dateFrom, dateTo],
    queryFn: () => fn({ data: {
      from: dateFrom || undefined,
      to: dateTo || undefined,
    } }),
  });

  const typeLabel: Record<string, string> = { cash: "নগদ", due: "বাকি", installment: "কিস্তি" };
  const typeVariant: Record<string, any> = { cash: "default", due: "secondary", installment: "outline" };

  const all = (q.data ?? []) as any[];
  // Tab predicate — single source of truth so counts and filtered list can never disagree.
  const tabPredicate = (t: string) => (r: any) => {
    if (t === "cancelled") return r.status === "cancelled";
    if (r.status === "cancelled") return false;
    if (t === "all") return true;
    return r.sale_type === t;
  };

  const counts = useMemo(() => ({
    all: all.filter(tabPredicate("all")).length,
    cash: all.filter(tabPredicate("cash")).length,
    due: all.filter(tabPredicate("due")).length,
    installment: all.filter(tabPredicate("installment")).length,
    cancelled: all.filter(tabPredicate("cancelled")).length,
  }), [all]);

  const tabList = useMemo(() => all.filter(tabPredicate(tab)), [all, tab]);

  const filtered = useMemo(() => {
    if (!search) return tabList;
    const s = search.toLowerCase();
    return tabList.filter((r: any) =>
      (r.invoice_no ?? "").toLowerCase().includes(s) ||
      (r.customer?.name ?? "").toLowerCase().includes(s) ||
      (r.customer?.phone ?? "").toLowerCase().includes(s) ||
      (r.id ?? "").toLowerCase().includes(s),
    );
  }, [tabList, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);
  const anyFilter = dateFrom || dateTo || tab !== "all" || search;

  const tabLabels: Record<string, string> = { all: "সব", cash: "নগদ", due: "বাকি", installment: "কিস্তি", cancelled: "ক্যান্সেল" };
  const emptyIcons: Record<string, any> = { cancelled: Ban, all: Receipt, cash: Receipt, due: Receipt, installment: Receipt };
  const EmptyIcon = emptyIcons[tab] ?? Receipt;

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
          <Input placeholder="ইনভয়েস / ট্রানজেকশন আইডি / কাস্টমার / ফোন..." className="pl-9" value={search} onChange={(e) => update({ q: e.target.value, page: 1 })} />
        </div>
        <Input type="date" className="sm:w-40" value={dateFrom} onChange={(e) => update({ from: e.target.value, page: 1 })} title="From" />
        <Input type="date" className="sm:w-40" value={dateTo} onChange={(e) => update({ to: e.target.value, page: 1 })} title="To" />
        {anyFilter && (
          <Button variant="outline" size="sm" onClick={() => update({ q: "", from: "", to: "", tab: "all", page: 1 })}>
            <X className="mr-1 h-3.5 w-3.5" /> ক্লিয়ার
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => update({ tab: v, page: 1 })} className="mt-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="all">সব ({counts.all})</TabsTrigger>
          <TabsTrigger value="cash">নগদ ({counts.cash})</TabsTrigger>
          <TabsTrigger value="due">বাকি ({counts.due})</TabsTrigger>
          <TabsTrigger value="installment">কিস্তি ({counts.installment})</TabsTrigger>
          <TabsTrigger value="cancelled">ক্যান্সেল ({counts.cancelled})</TabsTrigger>
        </TabsList>
      </Tabs>

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
                <td className="px-4 py-3">
                  {s.status === "cancelled"
                    ? <Badge variant="destructive">ক্যান্সেল</Badge>
                    : <Badge variant={typeVariant[s.sale_type]}>{typeLabel[s.sale_type]}</Badge>}
                </td>
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
              <tr>
                <td colSpan={8} className="px-4 py-12">
                  <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-muted p-3"><EmptyIcon className="h-6 w-6 text-muted-foreground" /></div>
                    <div className="text-base font-semibold">
                      {tab === "cancelled"
                        ? "কোনো ক্যান্সেল করা ইনভয়েস নেই"
                        : `"${tabLabels[tab]}" ট্যাবে কোনো ইনভয়েস নেই`}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {anyFilter ? "ফিল্টার/সার্চ পরিবর্তন করে দেখুন অথবা ক্লিয়ার করুন।" : "নতুন ইনভয়েস তৈরি করে শুরু করুন।"}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      {tab !== "cancelled" && (
                        <Button size="sm" onClick={() => nav({ to: "/app/sales/new" })}>
                          <Plus className="mr-1 h-4 w-4" /> নতুন বিক্রয়
                        </Button>
                      )}
                      {tab !== "all" && (
                        <Button size="sm" variant="outline" onClick={() => update({ tab: "all", page: 1 })}>
                          <Filter className="mr-1 h-4 w-4" /> সব ইনভয়েস দেখুন
                        </Button>
                      )}
                      {anyFilter && (
                        <Button size="sm" variant="ghost" onClick={() => update({ q: "", from: "", to: "", tab: "all", page: 1 })}>
                          <X className="mr-1 h-4 w-4" /> ফিল্টার ক্লিয়ার
                        </Button>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-col items-center justify-between gap-2 sm:flex-row">
        <div className="text-xs text-muted-foreground">
          {filtered.length === 0 ? "0" : `${(pageSafe - 1) * pageSize + 1}–${Math.min(pageSafe * pageSize, filtered.length)}`} / {filtered.length}
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => update({ size: Number(v), page: 1 })}>
            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={pageSafe <= 1} onClick={() => update({ page: pageSafe - 1 })}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-xs font-semibold">{pageSafe} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={pageSafe >= totalPages} onClick={() => update({ page: pageSafe + 1 })}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
