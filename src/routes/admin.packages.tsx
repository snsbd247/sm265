import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPackages, savePackage, deletePackage } from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MODULES, ALL_MODULE_KEYS, ALWAYS_ON } from "@/lib/modules";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/packages")({ component: PackagesPage });

const empty = {
  id: undefined as string | undefined,
  name: "",
  description: "",
  price_monthly: 0,
  price_yearly: 0,
  max_products: 100,
  max_users: 1,
  max_sms_per_month: 100,
  is_active: true,
  sort_order: 0,
  allowed_modules: [...ALL_MODULE_KEYS] as string[],
};

function PackagesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPackages);
  const saveFn = useServerFn(savePackage);
  const delFn = useServerFn(deletePackage);
  const { data } = useQuery({ queryKey: ["packages"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof empty>(empty);
  const [delId, setDelId] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["packages"] });

  const openEdit = (p: any) => {
    setForm({
      ...p,
      allowed_modules: Array.isArray(p.allowed_modules) ? p.allowed_modules : [...ALL_MODULE_KEYS],
    });
    setOpen(true);
  };
  const openNew = () => { setForm({ ...empty, allowed_modules: [...ALL_MODULE_KEYS] }); setOpen(true); };

  const toggleModule = (key: string, checked: boolean) => {
    setForm((f) => {
      const cur = new Set(f.allowed_modules ?? []);
      if (checked) cur.add(key); else cur.delete(key);
      // Always keep ALWAYS_ON modules on
      ALWAYS_ON.forEach((k) => cur.add(k));
      return { ...f, allowed_modules: Array.from(cur) };
    });
  };

  // Group modules by their group label for a compact grid
  const moduleGroups = MODULES.reduce<Record<string, typeof MODULES>>((acc, m) => {
    (acc[m.group] ||= []).push(m);
    return acc;
  }, {});

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveFn({ data: form });
      toast.success("সেভ হয়েছে"); setOpen(false); invalidate();
    } catch (err) { toast.error(err instanceof Error ? err.message : "ব্যর্থ"); }
  };

  const confirmDelete = async () => {
    if (!delId) return;
    try { await delFn({ data: { id: delId } }); invalidate(); toast.success("ডিলিট হয়েছে"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "ব্যর্থ"); }
    setDelId(null);
  };

  return (
    <AdminShell>
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">প্যাকেজ ম্যানেজমেন্ট</h1>
            <p className="text-sm text-muted-foreground">সাবস্ক্রিপশন প্যাকেজ তৈরি ও ব্যবস্থাপনা</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="shrink-0" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> নতুন প্যাকেজ</Button></DialogTrigger>
            <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
              <DialogHeader><DialogTitle>{form.id ? "প্যাকেজ এডিট" : "নতুন প্যাকেজ"}</DialogTitle></DialogHeader>
              <form onSubmit={onSave} className="space-y-3">
                <div><Label>নাম</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>বিবরণ</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>মাসিক মূল্য (৳)</Label><Input type="number" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: +e.target.value })} /></div>
                  <div><Label>বাৎসরিক মূল্য (৳)</Label><Input type="number" value={form.price_yearly} onChange={(e) => setForm({ ...form, price_yearly: +e.target.value })} /></div>
                  <div><Label>ম্যাক্স প্রোডাক্ট</Label><Input type="number" value={form.max_products} onChange={(e) => setForm({ ...form, max_products: +e.target.value })} /></div>
                  <div><Label>ম্যাক্স ইউজার</Label><Input type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: +e.target.value })} /></div>
                  <div><Label>SMS/মাস</Label><Input type="number" value={form.max_sms_per_month} onChange={(e) => setForm({ ...form, max_sms_per_month: +e.target.value })} /></div>
                  <div><Label>সর্ট অর্ডার</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: +e.target.value })} /></div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>একটিভ</Label></div>
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">মডিউল পার্মিশন</Label>
                    <div className="flex gap-2 text-xs">
                      <button type="button" className="text-primary hover:underline"
                        onClick={() => setForm({ ...form, allowed_modules: [...ALL_MODULE_KEYS] })}>
                        সব সিলেক্ট
                      </button>
                      <span className="text-muted-foreground">•</span>
                      <button type="button" className="text-primary hover:underline"
                        onClick={() => setForm({ ...form, allowed_modules: [...ALWAYS_ON] })}>
                        সব বাদ
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    এই প্যাকেজে যে মডিউলগুলো অ্যাক্সেসযোগ্য হবে সেগুলো চেক করুন। ড্যাশবোর্ড, সাবস্ক্রিপশন ও পাসওয়ার্ড পরিবর্তন সবসময় চালু থাকে।
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(moduleGroups).map(([grp, mods]) => (
                      <div key={grp} className="space-y-1.5">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{grp}</div>
                        {mods.map((m) => {
                          const checked = (form.allowed_modules ?? []).includes(m.key);
                          const locked = ALWAYS_ON.includes(m.key);
                          return (
                            <label key={m.key} className={`flex items-center gap-2 text-sm ${locked ? "opacity-70" : "cursor-pointer"}`}>
                              <Checkbox
                                checked={checked}
                                disabled={locked}
                                onCheckedChange={(v) => toggleModule(m.key, !!v)}
                              />
                              <span>{m.label}{locked && <span className="ml-1 text-[10px] text-muted-foreground">(সবসময়)</span>}</span>
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <DialogFooter><Button type="submit">সেভ</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-5 overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">প্যাকেজ</th>
                <th className="px-4 py-3">মাসিক</th>
                <th className="px-4 py-3">বাৎসরিক</th>
                <th className="px-4 py-3">লিমিট</th>
                <th className="px-4 py-3">স্ট্যাটাস</th>
                <th className="px-4 py-3 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((p: any) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    {p.description && <div className="text-xs text-muted-foreground line-clamp-1">{p.description}</div>}
                  </td>
                  <td className="px-4 py-3 font-semibold">৳{p.price_monthly}</td>
                  <td className="px-4 py-3">৳{p.price_yearly}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    প্রোডাক্ট: {p.max_products} • ইউজার: {p.max_users} • SMS: {p.max_sms_per_month}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "একটিভ" : "বন্ধ"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" title="এডিট" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" title="ডিলিট" onClick={() => setDelId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">কোন প্যাকেজ নেই</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>প্যাকেজ ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>এই কাজটি বাতিল করা যাবে না।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={confirmDelete}>ডিলিট</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
