import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { listDemoRequests, approveDemoRequest, rejectDemoRequest } from "@/lib/admin.functions";
import { CheckCircle2, XCircle, Mail, Phone, Store, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/admin/demo-requests")({
  component: DemoRequestsPage,
});

function DemoRequestsPage() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const listFn = useServerFn(listDemoRequests);
  const approveFn = useServerFn(approveDemoRequest);
  const rejectFn = useServerFn(rejectDemoRequest);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["demo-requests", tab],
    queryFn: () => listFn({ data: { status: tab } }),
  });

  const [approveOpen, setApproveOpen] = useState<any | null>(null);
  const [rejectOpen, setRejectOpen] = useState<any | null>(null);
  const [trialDays, setTrialDays] = useState(14);
  const [note, setNote] = useState("");

  const approve = useMutation({
    mutationFn: (v: { id: string; trial_days: number; note?: string }) => approveFn({ data: v }),
    onSuccess: (res: any) => {
      toast.success(`অনুমোদিত! লগইন: ${res.credentials.email} / ${res.credentials.password}`, { duration: 15000 });
      qc.invalidateQueries({ queryKey: ["demo-requests"] });
      setApproveOpen(null); setNote(""); setTrialDays(14);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: (v: { id: string; note?: string }) => rejectFn({ data: v }),
    onSuccess: () => {
      toast.success("রিকোয়েস্ট বাতিল হয়েছে");
      qc.invalidateQueries({ queryKey: ["demo-requests"] });
      setRejectOpen(null); setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="ডেমো রিকোয়েস্ট" subtitle="নতুন ডেমো আবেদন অনুমোদন করুন">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">পেন্ডিং</TabsTrigger>
          <TabsTrigger value="approved">অনুমোদিত</TabsTrigger>
          <TabsTrigger value="rejected">বাতিল</TabsTrigger>
          <TabsTrigger value="all">সব</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 grid gap-3">
        {isLoading && <div className="text-muted-foreground">লোড হচ্ছে...</div>}
        {!isLoading && data.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">কোন রিকোয়েস্ট নেই</Card>
        )}
        {data.map((r: any) => (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{r.name}</h3>
                  <Badge variant={r.status === "pending" ? "secondary" : r.status === "approved" ? "default" : "destructive"}>
                    {r.status === "pending" ? "পেন্ডিং" : r.status === "approved" ? "অনুমোদিত" : "বাতিল"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground grid sm:grid-cols-2 gap-x-6 gap-y-1">
                  <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {r.phone}</span>
                  {r.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {r.email}</span>}
                  {r.shop_name && <span className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5" /> {r.shop_name}</span>}
                  <span className="text-xs">{new Date(r.created_at).toLocaleString("bn-BD")}</span>
                </div>
                {r.message && (
                  <div className="flex items-start gap-1.5 text-sm mt-2 p-2 bg-muted rounded">
                    <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {r.message}
                  </div>
                )}
                {r.review_note && (
                  <div className="text-xs text-muted-foreground mt-1">নোট: {r.review_note}</div>
                )}
              </div>
              {r.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setApproveOpen(r)}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> অনুমোদন
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setRejectOpen(r)}>
                    <XCircle className="h-4 w-4 mr-1" /> বাতিল
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Approve Dialog */}
      <Dialog open={!!approveOpen} onOpenChange={(v) => !v && setApproveOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>ডেমো অনুমোদন — {approveOpen?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm bg-muted rounded p-3 space-y-1">
              <div><b>ইমেইল (ইউজারনেম):</b> {approveOpen?.email || <span className="text-destructive">ইমেইল নেই!</span>}</div>
              <div><b>ডিফল্ট পাসওয়ার্ড:</b> <code>123456789</code></div>
              <div className="text-xs text-muted-foreground">Trial প্যাকেজ দিয়ে দোকান তৈরি হবে। মেয়াদ শেষ হলে অটো লক হবে।</div>
            </div>
            <div>
              <Label>ট্রায়াল দিন</Label>
              <Input type="number" min={1} max={365} value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} />
            </div>
            <div>
              <Label>নোট (ঐচ্ছিক)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(null)}>বাতিল</Button>
            <Button
              disabled={!approveOpen?.email || approve.isPending}
              onClick={() => approve.mutate({ id: approveOpen.id, trial_days: trialDays, note: note || undefined })}
            >
              {approve.isPending ? "প্রসেসিং..." : "অনুমোদন করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectOpen} onOpenChange={(v) => !v && setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>রিকোয়েস্ট বাতিল</DialogTitle></DialogHeader>
          <div>
            <Label>কারণ (ঐচ্ছিক)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(null)}>বন্ধ</Button>
            <Button variant="destructive" disabled={reject.isPending} onClick={() => reject.mutate({ id: rejectOpen.id, note: note || undefined })}>
              বাতিল করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
