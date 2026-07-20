import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getShopDetail, updateShop, deleteShop, listPackages, updateShopStatus,
  extendShopSubscription, upgradeShopPackage, resetShopUserPassword, removeShopUser,
} from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Pencil, Trash2, Lock, Unlock, CalendarPlus, ArrowUpCircle, KeyRound, UserX, Search, Inbox, RefreshCw, ChevronLeft, ChevronRight, LogIn, Loader2, Printer, FileText } from "lucide-react";
import { createImpersonationToken } from "@/lib/impersonation.functions";
import { getActiveImpersonation, setActiveImpersonation, clearActiveImpersonation } from "@/lib/impersonation-window";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const searchSchema = z.object({
  tab: fallback(z.string(), "customers").default("customers"),
  q: fallback(z.string(), "").default(""),
  page: fallback(z.number().int(), 1).default(1),
  stockFilter: fallback(z.string(), "all").default("all"),
  payStatus: fallback(z.string(), "all").default("all"),
  subStatus: fallback(z.string(), "all").default("all"),
});

export const Route = createFileRoute("/admin/shops/$shopId")({
  component: ShopDetail,
  validateSearch: zodValidator(searchSchema),
});

const bdt = (n: number | string) => `৳${Number(n || 0).toLocaleString("bn-BD")}`;
const PAGE_SIZE = 10;

function ShopDetail() {
  const { shopId } = Route.useParams();
  const isValidShopId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(shopId);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/shops/$shopId" });
  const qc = useQueryClient();
  const getFn = useServerFn(getShopDetail);
  const updateFn = useServerFn(updateShop);
  const deleteFn = useServerFn(deleteShop);
  const impersonateFn = useServerFn(createImpersonationToken);
  const [impersonating, setImpersonating] = useState(false);
  const loginAsShop = async () => {
    const existing = getActiveImpersonation();
    if (existing) {
      toast.warning("ইতিমধ্যে একটি ইম্পার্সোনেশন সেশন সক্রিয়। প্রথমে সেটি বন্ধ করুন।", {
        action: {
          label: "সেই ট্যাবে যান",
          onClick: () => { try { existing.win.focus(); } catch { /* noop */ } },
        },
      });
      return;
    }
    const w = window.open("about:blank", "_blank");
    if (!w) { toast.error("পপআপ ব্লক হয়েছে — ব্রাউজারে পপআপ অনুমতি দিন।"); return; }
    setActiveImpersonation(w, shopId);
    setImpersonating(true);
    try {
      const { token } = await impersonateFn({ data: { shop_id: shopId } });
      w.location.href = `/impersonate?token=${encodeURIComponent(token)}`;
    } catch (e) {
      w.close();
      clearActiveImpersonation();
      toast.error(e instanceof Error ? e.message : "ব্যর্থ");
    } finally { setImpersonating(false); }
  };
  const pkgsFn = useServerFn(listPackages);
  const statusFn = useServerFn(updateShopStatus);
  const extendFn = useServerFn(extendShopSubscription);
  const upgradeFn = useServerFn(upgradeShopPackage);
  const resetPwFn = useServerFn(resetShopUserPassword);
  const removeUserFn = useServerFn(removeShopUser);

  const q = useQuery({
    queryKey: ["shop-detail", shopId],
    queryFn: () => getFn({ data: { shop_id: shopId } }),
    enabled: isValidShopId,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
  const pkgs = useQuery({ queryKey: ["packages"], queryFn: () => pkgsFn() });

  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState<{ user_id: string; email?: string } | null>(null);
  const [form, setForm] = useState<any>(null);
  const [upgradeForm, setUpgradeForm] = useState({ package_id: "", billing_cycle: "monthly" as "monthly" | "yearly", months: 1 });
  const [newPw, setNewPw] = useState("");

  const shop = q.data?.shop;
  const t = q.data?.totals;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["shop-detail", shopId] });
  const setSearch = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (prev: any) => ({ ...prev, ...patch }), params: { shopId }, replace: true });

  const openEdit = () => {
    if (!shop) return;
    setForm({
      shop_id: shop.id, name: shop.name, owner_name: shop.owner_name, phone: shop.phone,
      email: shop.email, address: shop.address ?? "",
      package_id: shop.package_id, billing_cycle: shop.billing_cycle ?? "monthly",
    });
    setEditOpen(true);
  };
  const openUpgrade = () => {
    if (!shop) return;
    setUpgradeForm({ package_id: shop.package_id ?? "", billing_cycle: (shop.billing_cycle ?? "monthly") as any, months: 1 });
    setUpgradeOpen(true);
  };

  const saveMut = useMutation({ mutationFn: () => updateFn({ data: form }),
    onSuccess: () => { toast.success("আপডেট হয়েছে"); invalidate(); setEditOpen(false); },
    onError: (e: any) => toast.error(e.message) });

  const upgradeMut = useMutation({ mutationFn: () => upgradeFn({ data: { shop_id: shopId, ...upgradeForm } }),
    onSuccess: () => { toast.success("প্যাকেজ আপডেট হয়েছে"); invalidate(); setUpgradeOpen(false); },
    onError: (e: any) => toast.error(e.message) });

  const delMut = useMutation({ mutationFn: () => deleteFn({ data: { shop_id: shopId } }),
    onSuccess: () => { toast.success("দোকান ডিলিট হয়েছে"); navigate({ to: "/admin/shops" }); },
    onError: (e: any) => toast.error(e.message) });

  const resetPwMut = useMutation({
    mutationFn: () => resetPwFn({ data: { user_id: pwOpen!.user_id, password: newPw } }),
    onSuccess: () => { toast.success("পাসওয়ার্ড আপডেট হয়েছে"); setPwOpen(null); setNewPw(""); },
    onError: (e: any) => toast.error(e.message),
  });

  // Filtered/paginated collections (declared before early-returns to keep hook order stable)
  const qLower = search.q.trim().toLowerCase();
  const match = (s: any) => !qLower || String(s ?? "").toLowerCase().includes(qLower);

  const filteredCustomers = useMemo(() => (q.data?.customers ?? []).filter((c: any) => match(c.name) || match(c.phone)), [q.data, qLower]);
  const filteredSuppliers = useMemo(() => (q.data?.suppliers ?? []).filter((s: any) => match(s.name) || match(s.phone)), [q.data, qLower]);
  const filteredProducts = useMemo(() => (q.data?.products ?? []).filter((p: any) => {
    const okQ = match(p.name) || match(p.sku);
    const low = Number(p.stock_quantity) <= Number(p.low_stock_alert || 0);
    const okS = search.stockFilter === "all" || (search.stockFilter === "low" ? low : !low);
    return okQ && okS;
  }), [q.data, qLower, search.stockFilter]);
  const filteredSubs = useMemo(() => (q.data?.subscriptions ?? []).filter((s: any) => {
    const okQ = match(s.package?.name) || match(s.status);
    const okS = search.subStatus === "all" || s.status === search.subStatus;
    return okQ && okS;
  }), [q.data, qLower, search.subStatus]);
  const filteredPayments = useMemo(() => (q.data?.payments ?? []).filter((p: any) => {
    const okQ = match(p.transaction_id) || match(p.payment_method);
    const okS = search.payStatus === "all" || p.status === search.payStatus;
    return okQ && okS;
  }), [q.data, qLower, search.payStatus]);
  const filteredUsers = useMemo(() => (q.data?.users ?? []).filter((u: any) => match(u.email) || match(u.role)), [q.data, qLower]);

  if (q.isLoading) {
    return (
      <AdminShell>
        <div className="p-6 space-y-4">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </AdminShell>
    );
  }
  const errMsg = q.error ? (q.error as Error).message : "";
  const notFound = !isValidShopId || !shop || /PGRST116|No rows|not found|invalid uuid/i.test(errMsg);
  if (notFound) {
    return (
      <AdminShell>
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <Card className="max-w-md p-8 text-center">
            <div className="text-6xl font-bold text-muted-foreground">404</div>
            <h2 className="mt-3 text-xl font-semibold">দোকান পাওয়া যায়নি</h2>
            <p className="mt-2 text-sm text-muted-foreground">শপ আইডি ভুল অথবা দোকানটি মুছে ফেলা হয়েছে।</p>
            <Button asChild className="mt-5"><Link to="/admin/shops"><ArrowLeft className="mr-2 h-4 w-4" />দোকান তালিকায় ফিরুন</Link></Button>
          </Card>
        </div>
      </AdminShell>
    );
  }
  if (q.error) {
    return (
      <AdminShell>
        <div className="p-6">
          <Card className="p-6">
            <div className="text-destructive font-semibold">লোড করতে সমস্যা হয়েছে</div>
            <p className="mt-1 text-sm text-muted-foreground">{errMsg}</p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={() => q.refetch()}><RefreshCw className="mr-1 h-4 w-4" />আবার চেষ্টা</Button>
              <Button asChild size="sm" variant="outline"><Link to="/admin/shops">ফিরে যান</Link></Button>
            </div>
          </Card>
        </div>
      </AdminShell>
    );
  }

  const activeSub = q.data?.subscriptions?.find((s: any) => s.status === "active");
  const page = Math.max(1, search.page);

  return (
    <AdminShell>
      <div className="p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button asChild variant="ghost" size="icon"><Link to="/admin/shops"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold sm:text-2xl">{shop.name}</h1>
              <p className="text-sm text-muted-foreground">{shop.owner_name} • {shop.phone} • <StatusBadge status={shop.status} /></p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="bg-gradient-to-r from-rose-500 to-orange-500 text-white hover:from-rose-600 hover:to-orange-600" onClick={loginAsShop} disabled={impersonating}>
              {impersonating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <LogIn className="mr-1 h-4 w-4" />}
              শপ হিসেবে লগইন
            </Button>
            <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
              <RefreshCw className={`mr-1 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />রিফ্রেশ
            </Button>
            <Button size="sm" variant="outline" onClick={() => extendFn({ data: { shop_id: shopId, months: 1 } }).then(() => { toast.success("১ মাস বাড়ানো হলো"); invalidate(); })}>
              <CalendarPlus className="mr-1 h-4 w-4" /> ১ মাস
            </Button>
            <Button size="sm" variant="outline" onClick={openUpgrade}><ArrowUpCircle className="mr-1 h-4 w-4" />আপগ্রেড</Button>
            <Button size="sm" variant="outline" onClick={() => statusFn({ data: { shop_id: shopId, status: shop.status === "locked" ? "active" : "locked" } }).then(() => { toast.success("আপডেট"); invalidate(); })}>
              {shop.status === "locked" ? <><Unlock className="mr-1 h-4 w-4" />আনলক</> : <><Lock className="mr-1 h-4 w-4" />লক</>}
            </Button>
            <Button size="sm" onClick={openEdit}><Pencil className="mr-1 h-4 w-4" />ইডিট</Button>
            <Button size="sm" variant="destructive" onClick={() => setDelOpen(true)}><Trash2 className="mr-1 h-4 w-4" />ডিলিট</Button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="মোট বিক্রয়" value={bdt(t?.totalSales ?? 0)} tone="bg-emerald-500/10 text-emerald-700" />
          <StatCard label="মোট ক্রয়" value={bdt(t?.totalPurchases ?? 0)} tone="bg-sky-500/10 text-sky-700" />
          <StatCard label="মোট বাকি (কাস্টমার)" value={bdt(t?.totalDue ?? 0)} tone="bg-amber-500/10 text-amber-700" />
          <StatCard label="সাপ্লায়ারকে পরিশোধ" value={bdt(t?.totalPaidToSuppliers ?? 0)} tone="bg-fuchsia-500/10 text-fuchsia-700" />
          <StatCard label="মোট নগদ গ্রহণ" value={bdt(t?.cashIn ?? 0)} tone="bg-green-500/10 text-green-700" />
          <StatCard label="মোট বিকাশ গ্রহণ" value={bdt(t?.bkashIn ?? 0)} tone="bg-pink-500/10 text-pink-700" />
          <StatCard label="নগদ পরিশোধ" value={bdt(t?.cashOut ?? 0)} tone="bg-slate-500/10 text-slate-700" />
          <StatCard label="বিকাশ পরিশোধ" value={bdt(t?.bkashOut ?? 0)} tone="bg-rose-500/10 text-rose-700" />
        </div>

        {/* Active package summary */}
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase text-muted-foreground">সক্রিয় প্যাকেজ</div>
              <div className="text-lg font-semibold">{shop.package?.name ?? "—"} <span className="text-sm text-muted-foreground">({shop.billing_cycle === "yearly" ? "বাৎসরিক" : "মাসিক"})</span></div>
              <div className="text-sm text-muted-foreground">
                মেয়াদ শেষ: {shop.subscription_end ? new Date(shop.subscription_end).toLocaleDateString("bn-BD") : "—"}
                {activeSub && <> • সাবস্ক্রিপশন: {bdt(activeSub.amount)}</>}
              </div>
            </div>
            <Button size="sm" onClick={openUpgrade}><ArrowUpCircle className="mr-1 h-4 w-4" />প্যাকেজ পরিবর্তন</Button>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs value={search.tab} onValueChange={(v) => setSearch({ tab: v, page: 1 })} className="w-full">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="customers">কাস্টমার ({t?.customersCount ?? 0})</TabsTrigger>
            <TabsTrigger value="suppliers">সাপ্লায়ার ({t?.suppliersCount ?? 0})</TabsTrigger>
            <TabsTrigger value="products">প্রোডাক্ট স্টক ({t?.productsCount ?? 0})</TabsTrigger>
            <TabsTrigger value="subs">সাবস্ক্রিপশন হিস্ট্রি</TabsTrigger>
            <TabsTrigger value="payments">পেমেন্ট</TabsTrigger>
            <TabsTrigger value="users">ইউজার ({q.data?.users?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="customers">
            <TabToolbar q={search.q} onQ={(v) => setSearch({ q: v, page: 1 })} placeholder="নাম বা ফোন সার্চ..." total={filteredCustomers.length} />
            <PaginatedTable
              headers={["নাম", "ফোন", "বর্তমান বাকি"]}
              rows={filteredCustomers.map((c: any) => [c.name, c.phone ?? "-", bdt(c.current_balance)])}
              empty="কোন কাস্টমার নেই" page={page} onPage={(p) => setSearch({ page: p })}
            />
          </TabsContent>

          <TabsContent value="suppliers">
            <TabToolbar q={search.q} onQ={(v) => setSearch({ q: v, page: 1 })} placeholder="নাম বা ফোন সার্চ..." total={filteredSuppliers.length} />
            <PaginatedTable
              headers={["নাম", "ফোন", "বর্তমান বাকি"]}
              rows={filteredSuppliers.map((s: any) => [s.name, s.phone ?? "-", bdt(s.current_balance)])}
              empty="কোন সাপ্লায়ার নেই" page={page} onPage={(p) => setSearch({ page: p })}
            />
          </TabsContent>

          <TabsContent value="products">
            <TabToolbar q={search.q} onQ={(v) => setSearch({ q: v, page: 1 })} placeholder="নাম বা SKU সার্চ..." total={filteredProducts.length}
              extra={
                <Select value={search.stockFilter} onValueChange={(v) => setSearch({ stockFilter: v, page: 1 })}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">সব স্টক</SelectItem>
                    <SelectItem value="low">লো স্টক</SelectItem>
                    <SelectItem value="ok">পর্যাপ্ত</SelectItem>
                  </SelectContent>
                </Select>
              }
            />
            <PaginatedTable
              headers={["নাম", "SKU", "স্টক", "ক্রয়মূল্য", "বিক্রয়মূল্য"]}
              rows={filteredProducts.map((p: any) => [
                p.name, p.sku ?? "-",
                <span className={Number(p.stock_quantity) <= Number(p.low_stock_alert || 0) ? "text-destructive font-semibold" : ""}>{Number(p.stock_quantity)} {p.unit?.name ?? ""}</span>,
                bdt(p.purchase_price), bdt(p.sale_price),
              ])}
              empty="কোন প্রোডাক্ট নেই" page={page} onPage={(p) => setSearch({ page: p })}
            />
          </TabsContent>

          <TabsContent value="subs">
            <TabToolbar q={search.q} onQ={(v) => setSearch({ q: v, page: 1 })} placeholder="প্যাকেজ বা স্ট্যাটাস..." total={filteredSubs.length}
              extra={
                <Select value={search.subStatus} onValueChange={(v) => setSearch({ subStatus: v, page: 1 })}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">সব</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              }
            />
            {filteredSubs.length === 0 ? (
              <EmptyCard label="কোন সাবস্ক্রিপশন নেই" />
            ) : (
              <Card className="p-4">
                <div className="space-y-2 text-sm">
                  {paginate(filteredSubs, page).map((s: any) => (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                      <div>
                        <div className="font-medium">{s.package?.name} <span className="text-xs text-muted-foreground">({s.billing_cycle === "yearly" ? "বাৎসরিক" : "মাসিক"})</span></div>
                        <div className="text-xs text-muted-foreground">{new Date(s.starts_at).toLocaleDateString("bn-BD")} → {new Date(s.ends_at).toLocaleDateString("bn-BD")}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{bdt(s.amount)}</span>
                        <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          title="Invoice (English POS)"
                          onClick={() => window.open(`/admin/invoices/en/${s.id}`, "_blank", "noopener")}
                        >
                          <FileText className="mr-1 h-3 w-3" />Invoice
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Pager page={page} total={filteredSubs.length} onPage={(p) => setSearch({ page: p })} />
              </Card>
            )}
          </TabsContent>

          <TabsContent value="payments">
            <TabToolbar q={search.q} onQ={(v) => setSearch({ q: v, page: 1 })} placeholder="TrxID বা মেথড..." total={filteredPayments.length}
              extra={
                <Select value={search.payStatus} onValueChange={(v) => setSearch({ payStatus: v, page: 1 })}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">সব</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              }
            />
            <PaginatedTable
              headers={["তারিখ", "TrxID", "মেথড", "এমাউন্ট", "স্ট্যাটাস", "রিসিপ্ট"]}
              rows={filteredPayments.map((p: any) => [
                new Date(p.created_at).toLocaleDateString("bn-BD"),
                <span className="font-mono text-xs">{p.transaction_id ?? "-"}</span>,
                p.payment_method ?? "-",
                bdt(p.amount),
                <Badge variant={p.status === "success" ? "default" : p.status === "pending" ? "secondary" : "destructive"}>{p.status}</Badge>,
                p.status === "success" ? (
                  <Button size="sm" variant="outline" onClick={() => window.open(`/admin/receipts/en/${p.id}`, "_blank", "noopener")}>
                    <Printer className="mr-1 h-3 w-3" />Receipt
                  </Button>
                ) : <span className="text-xs text-muted-foreground">—</span>,
              ])}
              empty="কোন পেমেন্ট নেই" page={page} onPage={(p) => setSearch({ page: p })}
            />
          </TabsContent>

          <TabsContent value="users">
            <TabToolbar q={search.q} onQ={(v) => setSearch({ q: v, page: 1 })} placeholder="ইমেইল বা রোল..." total={filteredUsers.length} />
            {filteredUsers.length === 0 ? (
              <EmptyCard label="কোন ইউজার নেই" />
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="bg-muted/50 text-left"><tr>
                    <th className="p-3">ইমেইল</th><th className="p-3">রোল</th><th className="p-3">তৈরি</th><th className="p-3 text-right">অ্যাকশন</th>
                  </tr></thead>
                  <tbody>
                    {paginate(filteredUsers, page).map((u: any) => (
                      <tr key={u.id} className="border-t">
                        <td className="p-3">{u.email ?? "-"}</td>
                        <td className="p-3"><Badge variant="outline">{u.role}</Badge></td>
                        <td className="p-3 text-xs text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleDateString("bn-BD") : "-"}</td>
                        <td className="p-3">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => { setPwOpen({ user_id: u.user_id, email: u.email }); setNewPw(Math.random().toString(36).slice(-8)); }}>
                              <KeyRound className="mr-1 h-3 w-3" />পাসওয়ার্ড
                            </Button>
                            {u.role !== "shop_owner" && (
                              <Button size="sm" variant="ghost" onClick={async () => { await removeUserFn({ data: { user_id: u.user_id, shop_id: shopId } }); toast.success("রিমুভ"); invalidate(); }}>
                                <UserX className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pager page={page} total={filteredUsers.length} onPage={(p) => setSearch({ page: p })} />
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>দোকান ইডিট</DialogTitle></DialogHeader>
          {form && (
            <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>দোকানের নাম</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>মালিকের নাম</Label><Input required value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></div>
                <div><Label>ফোন</Label><Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>ইমেইল</Label><Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div><Label>ঠিকানা</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>প্যাকেজ</Label>
                  <Select value={form.package_id ?? ""} onValueChange={(v) => setForm({ ...form, package_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{pkgs.data?.map((p: any) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div><Label>বিলিং</Label>
                  <Select value={form.billing_cycle} onValueChange={(v) => setForm({ ...form, billing_cycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="monthly">মাসিক</SelectItem><SelectItem value="yearly">বাৎসরিক</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button type="submit" disabled={saveMut.isPending}>সেভ করুন</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Upgrade dialog */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>প্যাকেজ আপগ্রেড / পরিবর্তন</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upgradeMut.mutate(); }} className="space-y-3">
            <div><Label>প্যাকেজ</Label>
              <Select value={upgradeForm.package_id} onValueChange={(v) => setUpgradeForm({ ...upgradeForm, package_id: v })}>
                <SelectTrigger><SelectValue placeholder="বাছাই করুন" /></SelectTrigger>
                <SelectContent>
                  {pkgs.data?.map((p: any) => (<SelectItem key={p.id} value={p.id}>{p.name} — ৳{p.price_monthly}/mo</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>বিলিং</Label>
                <Select value={upgradeForm.billing_cycle} onValueChange={(v) => setUpgradeForm({ ...upgradeForm, billing_cycle: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="monthly">মাসিক</SelectItem><SelectItem value="yearly">বাৎসরিক</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>মেয়াদ (মাস)</Label>
                <Input type="number" min={1} value={upgradeForm.months} onChange={(e) => setUpgradeForm({ ...upgradeForm, months: parseInt(e.target.value || "1") })} />
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={upgradeMut.isPending || !upgradeForm.package_id}>কনফার্ম</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password reset dialog */}
      <Dialog open={!!pwOpen} onOpenChange={(o) => !o && setPwOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>পাসওয়ার্ড পরিবর্তন</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); resetPwMut.mutate(); }} className="space-y-3">
            <div className="text-sm text-muted-foreground">{pwOpen?.email}</div>
            <div><Label>নতুন পাসওয়ার্ড</Label><Input required minLength={6} value={newPw} onChange={(e) => setNewPw(e.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={resetPwMut.isPending}>সেভ করুন</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={delOpen} onOpenChange={setDelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>দোকান ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>এই কাজটি বাতিল করা যাবে না। দোকানের সব ডাটা (পণ্য, বিক্রি, ক্রয়) এবং মালিকের একাউন্ট মুছে যাবে।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={() => delMut.mutate()} className="bg-destructive text-destructive-foreground">ডিলিট</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

function paginate<T>(arr: T[], page: number): T[] {
  const start = (page - 1) * PAGE_SIZE;
  return arr.slice(start, start + PAGE_SIZE);
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Card className="p-4">
      <div className={`mb-2 inline-block rounded px-2 py-0.5 text-xs ${tone}`}>{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </Card>
  );
}

function TabToolbar({ q, onQ, placeholder, total, extra }: { q: string; onQ: (v: string) => void; placeholder: string; total: number; extra?: ReactNode }) {
  return (
    <div className="my-3 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => onQ(e.target.value)} placeholder={placeholder} className="pl-8" />
      </div>
      {extra}
      <div className="text-xs text-muted-foreground">মোট: <span className="font-semibold">{total.toLocaleString("bn-BD")}</span></div>
    </div>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
      <div className="rounded-full bg-muted p-3"><Inbox className="h-6 w-6 text-muted-foreground" /></div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </Card>
  );
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="flex items-center justify-between gap-2 border-t p-3 text-xs text-muted-foreground">
      <span>{from}-{to} / {total}</span>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="outline" className="h-7 w-7" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="px-2">পেজ {page} / {pages}</span>
        <Button size="icon" variant="outline" className="h-7 w-7" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function PaginatedTable({ headers, rows, empty, page, onPage }: { headers: string[]; rows: any[][]; empty: string; page: number; onPage: (p: number) => void }) {
  if (rows.length === 0) return <EmptyCard label={empty} />;
  const slice = paginate(rows, page);
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-sm">
          <thead className="bg-muted/50 text-left"><tr>{headers.map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="p-3">{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={rows.length} onPage={onPage} />
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: any }> = {
    active: { label: "একটিভ", variant: "default" },
    expired: { label: "মেয়াদ শেষ", variant: "secondary" },
    locked: { label: "লকড", variant: "destructive" },
    suspended: { label: "স্থগিত", variant: "outline" },
  };
  const m = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
