import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listShops, createShop, updateShopStatus, extendShopSubscription, listPackages, deleteShop } from "@/lib/admin.functions";
import { createImpersonationToken } from "@/lib/impersonation.functions";
import { getActiveImpersonation, setActiveImpersonation, clearActiveImpersonation } from "@/lib/impersonation-window";
import { AdminShell } from "@/components/admin-shell";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Lock, Unlock, CalendarPlus, Eye, Trash2, Loader2, LogIn, MoreHorizontal } from "lucide-react";

export const Route = createFileRoute("/admin/shops/")({ component: ShopsPage });

function ShopsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listShops);
  const pkgsFn = useServerFn(listPackages);
  const createFn = useServerFn(createShop);
  const statusFn = useServerFn(updateShopStatus);
  const extendFn = useServerFn(extendShopSubscription);
  const delFn = useServerFn(deleteShop);
  const impersonateFn = useServerFn(createImpersonationToken);
  const [delId, setDelId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const loginAsShop = async (shopId: string) => {
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
    // Pre-open a tab synchronously to avoid popup blockers
    const w = window.open("about:blank", "_blank");
    if (!w) {
      toast.error("পপআপ ব্লক হয়েছে — ব্রাউজারে পপআপ অনুমতি দিন।");
      return;
    }
    setActiveImpersonation(w, shopId);
    setImpersonatingId(shopId);
    try {
      const { token } = await impersonateFn({ data: { shop_id: shopId } });
      w.location.href = `/impersonate?token=${encodeURIComponent(token)}`;
    } catch (e) {
      w.close();
      clearActiveImpersonation();
      toast.error(e instanceof Error ? e.message : "ব্যর্থ");
    } finally {
      setImpersonatingId(null);
    }
  };

  const shops = useQuery({ queryKey: ["shops"], queryFn: () => listFn() });
  const pkgs = useQuery({ queryKey: ["packages"], queryFn: () => pkgsFn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", owner_name: "", phone: "", email: "", address: "",
    package_id: "", billing_cycle: "monthly" as "monthly" | "yearly",
    password: Math.random().toString(36).slice(-8),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["shops"] });

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await createFn({ data: form });
      toast.success(`দোকান তৈরি হয়েছে। পাসওয়ার্ড: ${res.credentials.password}`, { duration: 10000 });
      setOpen(false);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ব্যর্থ");
    }
  };

  const toggleLock = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "locked" ? "active" : "locked";
    await statusFn({ data: { shop_id: id, status: newStatus as any } });
    invalidate();
    toast.success("আপডেট হয়েছে");
  };

  const extend = async (id: string) => {
    await extendFn({ data: { shop_id: id, months: 1 } });
    invalidate();
    toast.success("১ মাস বাড়ানো হয়েছে");
  };

  return (
    <AdminShell>
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">দোকান সমূহ</h1>
            <p className="text-sm text-muted-foreground">সব রেজিস্ট্রেড দোকান</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0"><Plus className="mr-2 h-4 w-4" /> নতুন দোকান</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
              <DialogHeader><DialogTitle>নতুন দোকান তৈরি</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>দোকানের নাম</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>মালিকের নাম</Label><Input required value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></div>
                  <div><Label>ফোন</Label><Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>ইমেইল (লগিন)</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                </div>
                <div><Label>ঠিকানা</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>প্যাকেজ</Label>
                    <Select value={form.package_id} onValueChange={(v) => setForm({ ...form, package_id: v })}>
                      <SelectTrigger><SelectValue placeholder="বাছাই করুন" /></SelectTrigger>
                      <SelectContent>
                        {pkgs.data?.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} — ৳{p.price_monthly}/mo</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>বিলিং</Label>
                    <Select value={form.billing_cycle} onValueChange={(v) => setForm({ ...form, billing_cycle: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">মাসিক</SelectItem>
                        <SelectItem value="yearly">বাৎসরিক</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>পাসওয়ার্ড</Label><Input required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                <DialogFooter><Button type="submit">তৈরি করুন</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-5 overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">দোকান</th>
                <th className="px-4 py-3">মালিক</th>
                <th className="px-4 py-3">প্যাকেজ</th>
                <th className="px-4 py-3">স্ট্যাটাস</th>
                <th className="px-4 py-3">মেয়াদ শেষ</th>
                <th className="px-4 py-3 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody>
              {shops.data?.map((s: any) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">{s.owner_name}<br /><span className="text-xs text-muted-foreground">{s.phone}</span></td>
                  <td className="px-4 py-3">{s.package?.name ?? "-"}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3">{s.subscription_end ? new Date(s.subscription_end).toLocaleDateString("bn-BD") : "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label="অ্যাকশন মেন্যু"
                            disabled={impersonatingId === s.id}
                          >
                            {impersonatingId === s.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <MoreHorizontal className="h-4 w-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>{s.name}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link to="/admin/shops/$shopId" params={{ shopId: s.id }} preload="intent">
                              <Eye className="mr-2 h-4 w-4" /> বিস্তারিত
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => loginAsShop(s.id)}>
                            <LogIn className="mr-2 h-4 w-4 text-primary" /> শপ হিসেবে লগইন
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => extend(s.id)}>
                            <CalendarPlus className="mr-2 h-4 w-4" /> ১ মাস বাড়ান
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => toggleLock(s.id, s.status)}>
                            {s.status === "locked"
                              ? <><Unlock className="mr-2 h-4 w-4" /> আনলক</>
                              : <><Lock className="mr-2 h-4 w-4" /> লক</>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setDelId(s.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> ডিলিট
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
              {shops.data?.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">কোনো দোকান নেই</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>দোকান ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>এই কাজটি বাতিল করা যাবে না। দোকানের সব ডাটা মুছে যাবে।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={async () => {
                if (!delId) return;
                try { await delFn({ data: { shop_id: delId } }); toast.success("ডিলিট হয়েছে"); invalidate(); }
                catch (e: any) { toast.error(e.message); }
                setDelId(null);
              }}
            >ডিলিট</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
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