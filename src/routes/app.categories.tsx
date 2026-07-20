import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCategories, saveCategory, deleteCategory } from "@/lib/inventory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/categories")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCategories);
  const saveFn = useServerFn(saveCategory);
  const delFn = useServerFn(deleteCategory);
  const q = useQuery({ queryKey: ["categories"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const save = useMutation({
    mutationFn: (d: any) => saveFn({ data: d }),
    onSuccess: () => { toast.success("সংরক্ষিত"); qc.invalidateQueries({ queryKey: ["categories"] }); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("মুছে ফেলা হয়েছে"); qc.invalidateQueries({ queryKey: ["categories"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <h1 className="truncate text-xl font-bold sm:text-2xl">ক্যাটাগরি</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="shrink-0"><Plus className="mr-2 h-4 w-4" /> নতুন ক্যাটাগরি</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92dvh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "এডিট" : "নতুন"} ক্যাটাগরি</DialogTitle></DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              save.mutate({
                id: editing?.id,
                name: String(fd.get("name") ?? ""),
                description: String(fd.get("description") ?? "") || null,
              });
            }} className="space-y-3">
              <div><Label>নাম</Label><Input name="name" required defaultValue={editing?.name ?? ""} /></div>
              <div><Label>বিবরণ</Label><Textarea name="description" defaultValue={editing?.description ?? ""} /></div>
              <DialogFooter><Button type="submit" disabled={save.isPending}>সংরক্ষণ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[540px] text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr><th className="p-3">নাম</th><th className="p-3">বিবরণ</th><th className="p-3 text-right">অ্যাকশন</th></tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((c: any) => (
              <tr key={c.id} className="border-b">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 text-muted-foreground">{c.description ?? "-"}</td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm("মুছবেন?")) del.mutate(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {(q.data ?? []).length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">কোনো ক্যাটাগরি নেই</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
