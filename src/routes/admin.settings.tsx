import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGatewaySettings, saveBkashSettings, saveSmsSettings, saveSmsTemplate, sendTestSms, getBranding, saveBranding } from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Send } from "lucide-react";


export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getGatewaySettings);
  const bkashFn = useServerFn(saveBkashSettings);
  const smsFn = useServerFn(saveSmsSettings);
  const tplFn = useServerFn(saveSmsTemplate);
  const brandGetFn = useServerFn(getBranding);
  const brandSaveFn = useServerFn(saveBranding);
  const { data } = useQuery({ queryKey: ["gateway-settings"], queryFn: () => getFn() });
  const brand = useQuery({ queryKey: ["branding"], queryFn: () => brandGetFn() });

  return (
    <AdminShell>
      <div className="p-4 sm:p-6">
      <h1 className="text-xl font-bold sm:text-2xl">সেটিংস</h1>
      <p className="text-sm text-muted-foreground">সাইট ব্র্যান্ডিং, পেমেন্ট ও SMS গেটওয়ে ব্যবস্থাপনা</p>
      <Tabs defaultValue="branding" className="mt-5">
        <TabsList className="h-auto max-w-full justify-start overflow-x-auto p-1">
          <TabsTrigger value="branding">ব্র্যান্ডিং</TabsTrigger>
          <TabsTrigger value="bkash">bKash পেমেন্ট</TabsTrigger>
          <TabsTrigger value="sms">Greenweb SMS</TabsTrigger>
          <TabsTrigger value="templates">SMS টেমপ্লেট</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <BrandingForm initial={brand.data} onSave={async (v) => {
            await brandSaveFn({ data: v });
            await qc.invalidateQueries({ queryKey: ["branding"] });
          }} />
        </TabsContent>


        <TabsContent value="bkash">
          {data && <BkashForm initial={data.bkash} onSave={async (v) => {
            await bkashFn({ data: v }); toast.success("সেভ হয়েছে"); qc.invalidateQueries({ queryKey: ["gateway-settings"] });
          }} />}
        </TabsContent>
        <TabsContent value="sms">
          {data && <SmsForm initial={data.sms} onSave={async (v) => {
            await smsFn({ data: v }); toast.success("সেভ হয়েছে"); qc.invalidateQueries({ queryKey: ["gateway-settings"] });
          }} />}
          <TestSmsForm />
        </TabsContent>
        <TabsContent value="templates">
          <div className="space-y-4">
            {data?.templates?.map((t: any) => (
              <TemplateCard key={t.id} tpl={t} onSave={async (v) => {
                await tplFn({ data: v }); toast.success("টেমপ্লেট সেভ"); qc.invalidateQueries({ queryKey: ["gateway-settings"] });
              }} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </AdminShell>
  );
}

function BkashForm({ initial, onSave }: { initial: any; onSave: (v: any) => Promise<void> }) {
  const [f, setF] = useState({
    mode: initial?.mode ?? "sandbox",
    app_key: initial?.app_key ?? "",
    app_secret: initial?.app_secret ?? "",
    username: initial?.username ?? "",
    password: initial?.password ?? "",
    merchant_number: initial?.merchant_number ?? "",
    is_active: initial?.is_active ?? false,
  });
  useEffect(() => setF({
    mode: initial?.mode ?? "sandbox", app_key: initial?.app_key ?? "", app_secret: initial?.app_secret ?? "",
    username: initial?.username ?? "", password: initial?.password ?? "",
    merchant_number: initial?.merchant_number ?? "", is_active: initial?.is_active ?? false,
  }), [initial]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="mt-4 max-w-xl space-y-3 rounded-lg border bg-card p-4 sm:p-6">
      <div><Label>মোড</Label>
        <Select value={f.mode} onValueChange={(v) => setF({ ...f, mode: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="sandbox">Sandbox (টেস্ট)</SelectItem><SelectItem value="live">Live</SelectItem></SelectContent>
        </Select>
      </div>
      <div><Label>App Key</Label><Input value={f.app_key} onChange={(e) => setF({ ...f, app_key: e.target.value })} /></div>
      <div><Label>App Secret</Label><Input type="password" value={f.app_secret} onChange={(e) => setF({ ...f, app_secret: e.target.value })} /></div>
      <div><Label>Username</Label><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
      <div><Label>Password</Label><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
      <div><Label>Merchant Number</Label><Input value={f.merchant_number} onChange={(e) => setF({ ...f, merchant_number: e.target.value })} /></div>
      <div className="flex items-center gap-2"><Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} /><Label>একটিভ</Label></div>
      <Button type="submit">সেভ</Button>
    </form>
  );
}

function SmsForm({ initial, onSave }: { initial: any; onSave: (v: any) => Promise<void> }) {
  const [f, setF] = useState({
    api_token: initial?.api_token ?? "", sender_id: initial?.sender_id ?? "", is_active: initial?.is_active ?? false,
  });
  useEffect(() => setF({
    api_token: initial?.api_token ?? "", sender_id: initial?.sender_id ?? "", is_active: initial?.is_active ?? false,
  }), [initial]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="mt-4 max-w-xl space-y-3 rounded-lg border bg-card p-4 sm:p-6">
      <div><Label>API Token</Label><Input value={f.api_token} onChange={(e) => setF({ ...f, api_token: e.target.value })} /></div>
      <div><Label>Sender ID</Label><Input value={f.sender_id} onChange={(e) => setF({ ...f, sender_id: e.target.value })} /></div>
      <div className="flex items-center gap-2"><Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} /><Label>একটিভ</Label></div>
      <Button type="submit">সেভ</Button>
    </form>
  );
}

function TemplateCard({ tpl, onSave }: { tpl: any; onSave: (v: any) => Promise<void> }) {
  const [f, setF] = useState({ id: tpl.id, title: tpl.title, body: tpl.body, is_active: tpl.is_active });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }} className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <code className="text-xs text-muted-foreground">{tpl.code}</code>
        <div className="flex items-center gap-2"><Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} /><span className="text-xs">একটিভ</span></div>
      </div>
      <Input className="mb-2" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <Textarea rows={2} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      <div className="mt-2 flex justify-end"><Button size="sm" type="submit">সেভ</Button></div>
    </form>
  );
}

function TestSmsForm() {
  const testFn = useServerFn(sendTestSms);
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("Supershop টেস্ট SMS — কাজ করছে ✅");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r: any = await testFn({ data: { phone, message: msg } });
          if (r?.ok) toast.success("SMS পাঠানো হয়েছে"); else toast.error(r?.response ?? "ব্যর্থ");
        } catch (err: any) { toast.error(err?.message ?? "ব্যর্থ"); }
        setBusy(false);
      }}
      className="mt-4 max-w-xl space-y-3 rounded-lg border bg-card p-4 sm:p-6"
    >
      <div className="font-semibold">টেস্ট SMS পাঠান</div>
      <div><Label>ফোন নম্বর</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" required /></div>
      <div><Label>ম্যাসেজ</Label><Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} required /></div>
      <Button type="submit" disabled={busy}><Send className="mr-2 h-4 w-4" />{busy ? "পাঠানো হচ্ছে..." : "পাঠান"}</Button>
    </form>
  );
}

const LOGO_MAX_KB = 512;
const FAVICON_MAX_KB = 128;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const FAVICON_TYPES = ["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml", "image/jpeg"];

const EMPTY_BRAND = {
  site_name: "", tagline: "", logo_url: "", favicon_url: "",
  contact_email: "", contact_phone: "", contact_address: "",
  facebook_url: "", website_url: "", footer_note: "",
};

function BrandingForm({ initial, onSave }: { initial: any; onSave: (v: any) => Promise<void> }) {
  const [f, setF] = useState(EMPTY_BRAND);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!initial) return;
    setF({
      site_name: initial.site_name ?? "",
      tagline: initial.tagline ?? "",
      logo_url: initial.logo_url ?? "",
      favicon_url: initial.favicon_url ?? "",
      contact_email: initial.contact_email ?? "",
      contact_phone: initial.contact_phone ?? "",
      contact_address: initial.contact_address ?? "",
      facebook_url: initial.facebook_url ?? "",
      website_url: initial.website_url ?? "",
      footer_note: initial.footer_note ?? "",
    });
  }, [initial]);

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const handleFile = async (key: "logo_url" | "favicon_url", file: File | null) => {
    if (!file) return;
    const isFav = key === "favicon_url";
    const maxKB = isFav ? FAVICON_MAX_KB : LOGO_MAX_KB;
    const allowed = isFav ? FAVICON_TYPES : LOGO_TYPES;
    if (!allowed.includes(file.type)) {
      toast.error(
        isFav
          ? "ফেভিকন হিসেবে PNG/ICO/SVG/JPG ফাইল আপলোড করুন"
          : "লোগো হিসেবে PNG/JPG/WEBP/SVG ফাইল আপলোড করুন"
      );
      return;
    }
    if (file.size > maxKB * 1024) {
      toast.error(`ফাইল সাইজ ${maxKB}KB এর কম হতে হবে (বর্তমান: ${Math.round(file.size / 1024)}KB)`);
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setF((prev) => ({ ...prev, [key]: dataUrl }));
      toast.success("ছবি লোড হয়েছে — সেভ করুন");
    } catch {
      toast.error("ছবি পড়া যায়নি");
    }
  };

  const resetDefaults = () => {
    if (!confirm("সব ব্র্যান্ডিং মুছে ডিফল্টে ফিরিয়ে নিতে চান?")) return;
    setF(EMPTY_BRAND);
    toast.info("ডিফল্টে রিসেট করা হলো — সেভ করলে কার্যকর হবে");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(f);
      toast.success("ব্র্যান্ডিং সেভ হয়েছে");
    } catch (err: any) {
      toast.error(err?.message || "সেভ ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 max-w-3xl space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border bg-muted/30 p-3">
          <Label>লোগো <span className="text-xs text-muted-foreground">(সর্বোচ্চ {LOGO_MAX_KB}KB)</span></Label>
          <div className="mt-2 flex items-center gap-3">
            {f.logo_url ? (
              <img src={f.logo_url} alt="logo" className="h-16 w-16 rounded object-contain bg-white p-1 border" />
            ) : (
              <div className="h-16 w-16 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">নেই</div>
            )}
            <div className="flex-1 space-y-2">
              <Input type="file" accept={LOGO_TYPES.join(",")} onChange={(e) => handleFile("logo_url", e.target.files?.[0] ?? null)} />
              {f.logo_url && <Button type="button" variant="ghost" size="sm" onClick={() => setF({ ...f, logo_url: "" })}>মুছুন</Button>}
            </div>
          </div>
        </div>
        <div className="rounded-md border bg-muted/30 p-3">
          <Label>ফেভিকন <span className="text-xs text-muted-foreground">(সর্বোচ্চ {FAVICON_MAX_KB}KB)</span></Label>
          <div className="mt-2 flex items-center gap-3">
            {f.favicon_url ? (
              <img src={f.favicon_url} alt="favicon" className="h-10 w-10 rounded object-contain bg-white p-1 border" />
            ) : (
              <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center text-[10px] text-muted-foreground">নেই</div>
            )}
            <div className="flex-1 space-y-2">
              <Input type="file" accept={FAVICON_TYPES.join(",")} onChange={(e) => handleFile("favicon_url", e.target.files?.[0] ?? null)} />
              {f.favicon_url && <Button type="button" variant="ghost" size="sm" onClick={() => setF({ ...f, favicon_url: "" })}>মুছুন</Button>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>সাইটের নাম *</Label><Input required value={f.site_name} onChange={(e) => setF({ ...f, site_name: e.target.value })} /></div>
        <div><Label>ট্যাগলাইন</Label><Input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></div>
      </div>

      <div className="border-t pt-4">
        <h3 className="mb-3 font-semibold text-sm">যোগাযোগের তথ্য</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>ইমেইল</Label><Input type="email" value={f.contact_email} onChange={(e) => setF({ ...f, contact_email: e.target.value })} /></div>
          <div><Label>ফোন</Label><Input value={f.contact_phone} onChange={(e) => setF({ ...f, contact_phone: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>ঠিকানা</Label><Input value={f.contact_address} onChange={(e) => setF({ ...f, contact_address: e.target.value })} /></div>
          <div><Label>ওয়েবসাইট</Label><Input value={f.website_url} onChange={(e) => setF({ ...f, website_url: e.target.value })} /></div>
          <div><Label>ফেসবুক</Label><Input value={f.facebook_url} onChange={(e) => setF({ ...f, facebook_url: e.target.value })} /></div>
        </div>
      </div>

      <div><Label>ফুটার/রিসিপ্ট নোট</Label><Textarea rows={2} value={f.footer_note} onChange={(e) => setF({ ...f, footer_note: e.target.value })} placeholder="যেমন: ধন্যবাদ আমাদের সাথে থাকার জন্য।" /></div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={saving}>{saving ? "সেভ হচ্ছে..." : "সেভ করুন"}</Button>
        <Button type="button" variant="outline" onClick={resetDefaults} disabled={saving}>ডিফল্টে রিসেট</Button>
      </div>
    </form>
  );
}


