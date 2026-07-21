import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getInvoiceTemplate, saveInvoiceTemplate, DEFAULT_TEMPLATE } from "@/lib/invoice-template.functions";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Save, RotateCcw, ImageIcon } from "lucide-react";

export const Route = createFileRoute("/app/settings/invoice-template")({ component: Page });

function Page() {
  const qc = useQueryClient();
  const getFn = useServerFn(getInvoiceTemplate);
  const saveFn = useServerFn(saveInvoiceTemplate);
  const q = useQuery({ queryKey: ["invoice-template"], queryFn: () => getFn() });

  const [tpl, setTpl] = useState<any>(null);
  useEffect(() => { if (q.data) setTpl({ ...DEFAULT_TEMPLATE, ...q.data }); }, [q.data]);

  const m = useMutation({
    mutationFn: (payload: any) => saveFn({ data: payload }),
    onSuccess: () => {
      toast.success("টেমপ্লেট সংরক্ষিত");
      qc.invalidateQueries({ queryKey: ["invoice-template"] });
      qc.invalidateQueries({ queryKey: ["public-invoice"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "সেভ করা যায়নি"),
  });

  if (!tpl) return <div className="p-6 text-muted-foreground">লোড হচ্ছে...</div>;

  const set = (patch: any) => setTpl({ ...tpl, ...patch });

  const onLogoFile = async (f: File | null) => {
    if (!f) return;
    if (f.size > 400_000) { toast.error("লোগো 400KB এর কম হতে হবে"); return; }
    const reader = new FileReader();
    reader.onload = () => set({ logo_url: String(reader.result) });
    reader.readAsDataURL(f);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold sm:text-2xl">ইনভয়েস টেমপ্লেট</h1>
        <p className="text-sm text-muted-foreground">লোগো, রঙ, ঠিকানা ও ফুটার কাস্টমাইজ করুন। POS ও শেয়ারযোগ্য ইনভয়েসে প্রযোজ্য।</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5 rounded-2xl border bg-card p-5">
          <div className="grid gap-1.5">
            <Label>লোগো</Label>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border bg-muted">
                {tpl.logo_url ? <img src={tpl.logo_url} alt="logo" className="h-full w-full object-contain" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
              </div>
              <Input type="file" accept="image/*" onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)} className="h-10" />
              {tpl.logo_url && <Button size="sm" variant="outline" onClick={() => set({ logo_url: null })}>মুছুন</Button>}
            </div>
            <p className="text-[11px] text-muted-foreground">PNG/JPG/SVG · 400KB এর কম হলে সরাসরি এম্বেড হবে।</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <ColorField label="প্রাইমারি রঙ" value={tpl.primary_color} onChange={(v) => set({ primary_color: v })} />
            <ColorField label="অ্যাকসেন্ট রঙ" value={tpl.accent_color} onChange={(v) => set({ accent_color: v })} />
            <ColorField label="টেক্সট রঙ" value={tpl.text_color} onChange={(v) => set({ text_color: v })} />
          </div>

          <div className="grid gap-1.5">
            <Label>ঠিকানা</Label>
            <Input value={tpl.address_line ?? ""} onChange={(e) => set({ address_line: e.target.value })} placeholder="যেমন: ২১/এ, নিউমার্কেট, ঢাকা" />
          </div>
          <div className="grid gap-1.5">
            <Label>যোগাযোগ</Label>
            <Input value={tpl.contact_line ?? ""} onChange={(e) => set({ contact_line: e.target.value })} placeholder="ফোন / ইমেইল / ওয়েবসাইট" />
          </div>
          <div className="grid gap-1.5">
            <Label>ফুটার নোট</Label>
            <Textarea rows={2} value={tpl.footer_note ?? ""} onChange={(e) => set({ footer_note: e.target.value })} placeholder="যেমন: ধন্যবাদ, আবার আসবেন।" />
          </div>
          <div className="grid gap-1.5">
            <Label>শর্তাবলী</Label>
            <Textarea rows={3} value={tpl.terms_note ?? ""} onChange={(e) => set({ terms_note: e.target.value })} placeholder="বিক্রীত পণ্য ফেরতযোগ্য নয়..." />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-md border p-3 sm:grid-cols-3">
            <ToggleField label="লোগো দেখাও" checked={tpl.show_logo} onChange={(v) => set({ show_logo: v })} />
            <ToggleField label="QR দেখাও" checked={tpl.show_qr} onChange={(v) => set({ show_qr: v })} />
            <ToggleField label="স্বাক্ষর লাইন" checked={tpl.show_signature} onChange={(v) => set({ show_signature: v })} />
          </div>
          {tpl.show_signature && (
            <div className="grid gap-1.5">
              <Label>স্বাক্ষরের লেবেল</Label>
              <Input value={tpl.signature_label ?? ""} onChange={(e) => set({ signature_label: e.target.value })} placeholder="অনুমোদনকারী" />
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button onClick={() => m.mutate({
              logo_url: tpl.logo_url || null,
              primary_color: tpl.primary_color,
              accent_color: tpl.accent_color,
              text_color: tpl.text_color,
              address_line: tpl.address_line || null,
              contact_line: tpl.contact_line || null,
              footer_note: tpl.footer_note || null,
              terms_note: tpl.terms_note || null,
              show_logo: tpl.show_logo, show_qr: tpl.show_qr,
              show_signature: tpl.show_signature,
              signature_label: tpl.signature_label || null,
            })} disabled={m.isPending}>
              <Save className="mr-2 h-4 w-4" /> সংরক্ষণ
            </Button>
            <Button variant="outline" onClick={() => setTpl({ ...DEFAULT_TEMPLATE })}>
              <RotateCcw className="mr-2 h-4 w-4" /> ডিফল্ট
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">প্রিভিউ</div>
          <TemplatePreview tpl={tpl} />
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-10 shrink-0 rounded border" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 font-mono text-xs uppercase" />
      </div>
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function TemplatePreview({ tpl }: { tpl: any }) {
  return (
    <div className="overflow-hidden rounded-md border bg-white text-[11px]" style={{ color: tpl.text_color }}>
      <div className="flex items-center gap-3 p-3" style={{ background: tpl.primary_color, color: "#fff" }}>
        {tpl.show_logo && tpl.logo_url && (
          <img src={tpl.logo_url} alt="logo" className="h-8 w-8 rounded bg-white/20 object-contain p-0.5" />
        )}
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest opacity-80">Invoice</div>
          <div className="truncate font-bold">আপনার দোকান</div>
        </div>
      </div>
      <div className="p-3" style={{ background: tpl.accent_color }}>
        <div className="text-[10px]">Invoice #INV-DEMO</div>
        {tpl.address_line && <div className="text-[10px] opacity-80">{tpl.address_line}</div>}
        {tpl.contact_line && <div className="text-[10px] opacity-80">{tpl.contact_line}</div>}
      </div>
      <div className="space-y-1 p-3">
        <div className="flex justify-between"><span>ডেমো পণ্য × 1</span><span>৳100</span></div>
        <div className="flex justify-between border-t pt-1 font-bold"><span>TOTAL</span><span>৳100</span></div>
      </div>
      {tpl.footer_note && <div className="border-t p-2 text-center text-[10px] opacity-70">{tpl.footer_note}</div>}
    </div>
  );
}