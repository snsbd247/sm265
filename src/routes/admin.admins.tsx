import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listAdmins, createAdmin, deleteAdmin, resetAdminPassword } from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, ShieldCheck, MoreVertical, KeyRound, Trash2, Users } from "lucide-react";

export const Route = createFileRoute("/admin/admins")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdmins);
  const createFn = useServerFn(createAdmin);
  const delFn = useServerFn(deleteAdmin);
  const resetFn = useServerFn(resetAdminPassword);

  const q = useQuery({ queryKey: ["admins"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [resetFor, setResetFor] = useState<any>(null);

  const create = useMutation({
    mutationFn: (d: any) => createFn({ data: d }),
    onSuccess: () => { toast.success("এডমিন তৈরি হয়েছে"); qc.invalidateQueries({ queryKey: ["admins"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (user_id: string) => delFn({ data: { user_id } }),
    onSuccess: () => { toast.success("মুছে ফেলা হয়েছে"); qc.invalidateQueries({ queryKey: ["admins"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const reset = useMutation({
    mutationFn: (d: { user_id: string; password: string }) => resetFn({ data: d }),
    onSuccess: () => { toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে"); setResetFor(null); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AdminShell>
      <div className="p-4 sm:p-6">
        <div className="grad-violet relative overflow-hidden rounded-2xl p-5 shadow-lg">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur">
                <ShieldCheck className="h-3 w-3" /> সুপার এডমিন ব্যবস্থাপনা
              </div>
              <h1 className="mt-2 truncate text-2xl font-bold">এডমিন ইউজার সমূহ</h1>
              <p className="mt-1 text-sm opacity-90">মোট {q.data?.length ?? 0} জন</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="shrink-0 gap-2"><Plus className="h-4 w-4" /> নতুন এডমিন</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>নতুন সুপার এডমিন</DialogTitle></DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  create.mutate({
                    email: String(fd.get("email") ?? ""),
                    password: String(fd.get("password") ?? ""),
                    full_name: String(fd.get("full_name") ?? ""),
                  });
                }} className="grid gap-3">
                  <div><Label>পূর্ণ নাম *</Label><Input name="full_name" required /></div>
                  <div><Label>ইমেইল *</Label><Input name="email" type="email" required /></div>
                  <div><Label>পাসওয়ার্ড *</Label><Input name="password" type="password" required minLength={6} /></div>
                  <DialogFooter><Button type="submit" disabled={create.isPending}>তৈরি করুন</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">নাম / ইমেইল</th>
                  <th className="px-4 py-2 text-left font-medium">তৈরি</th>
                  <th className="px-4 py-2 text-left font-medium">শেষ লগিন</th>
                  <th className="px-4 py-2 text-right font-medium">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(q.data ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-6 w-6 opacity-40" /> কোনো এডমিন নেই</td></tr>
                ) : (q.data ?? []).map((a: any) => (
                  <tr key={a.user_id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{a.full_name || a.email}</div>
                      <div className="text-xs text-muted-foreground">{a.email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{a.created_at ? new Date(a.created_at).toLocaleDateString("bn-BD") : "-"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{a.last_sign_in_at ? new Date(a.last_sign_in_at).toLocaleString("bn-BD") : "কখনও না"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setResetFor(a)}><KeyRound className="mr-2 h-4 w-4" /> পাসওয়ার্ড রিসেট</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("এই এডমিন মুছবেন?")) del.mutate(a.user_id); }}>
                            <Trash2 className="mr-2 h-4 w-4" /> মুছে ফেলুন
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Dialog open={!!resetFor} onOpenChange={(v) => !v && setResetFor(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>পাসওয়ার্ড রিসেট — {resetFor?.email}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              reset.mutate({ user_id: resetFor.user_id, password: String(fd.get("password") ?? "") });
            }} className="grid gap-3">
              <div><Label>নতুন পাসওয়ার্ড</Label><Input name="password" type="password" required minLength={6} /></div>
              <DialogFooter><Button type="submit" disabled={reset.isPending}>সংরক্ষণ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminShell>
  );
}
