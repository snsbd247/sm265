import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Store, Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";

export const Route = createFileRoute("/login")({ component: ShopLogin });

function ShopLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { siteName, logoUrl } = useBranding();

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { session, primaryShopId, isSuperAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (session && primaryShopId) navigate({ to: "/app" });
    else if (session && isSuperAdmin) navigate({ to: "/admin" });
  }, [session, primaryShopId, isSuperAdmin, authLoading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const uid = signIn.user?.id;
      if (!uid) throw new Error("লগিন ব্যর্থ");
      const { data: roles } = await supabase
        .from("user_roles").select("role, shop_id").eq("user_id", uid);
      const shopRole = (roles ?? []).find((r) => r.shop_id);
      const isAdmin = (roles ?? []).some((r) => r.role === "super_admin");
      toast.success("সফল লগিন");
      if (shopRole) navigate({ to: "/app" });
      else if (isAdmin) navigate({ to: "/admin" });
      else {
        await supabase.auth.signOut();
        toast.error("এই ইউজারের কোনো শপ অ্যাক্সেস নেই।");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "লগিন ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10">
      {/* Colorful backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/25 blur-3xl motion-reduce:hidden" />
        <div className="absolute right-0 top-1/2 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl motion-reduce:hidden" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-amber-300/25 blur-3xl motion-reduce:hidden" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:28px_28px]" />

      <div className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-3xl border bg-white shadow-2xl md:grid-cols-2">
        {/* Left brand panel */}
        <div className="relative hidden bg-gradient-to-br from-primary via-fuchsia-600 to-sky-600 p-10 text-white md:flex md:flex-col md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-10 w-10 rounded-lg bg-white p-1 object-contain" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
                  <Store className="h-5 w-5" />
                </div>
              )}
              <span className="text-xl font-bold">{siteName}</span>
            </div>
            <h2 className="mt-10 text-3xl font-bold leading-snug">দোকানের সব কিছু, এক জায়গায়।</h2>
            <p className="mt-3 text-white/85">POS, স্টক, বাকি, রিপোর্ট — একসাথে চালান, সহজে।</p>
          </div>
          <ul className="space-y-2 text-sm text-white/90">
            <li>✓ POS ও ইনভয়েস প্রিন্ট</li>
            <li>✓ ক্রয়/বিক্রয়/লাভ রিপোর্ট</li>
            <li>✓ কাস্টমার বাকি ও কিস্তি</li>
          </ul>
        </div>

        {/* Right form panel */}
        <div className="p-8 md:p-10">
          <Link to="/" className="mb-6 inline-flex items-center gap-2 md:hidden">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="h-9 w-9 rounded-lg object-contain" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Store className="h-4 w-4" />
              </div>
            )}
            <span className="text-lg font-bold">{siteName}</span>
          </Link>

          <h1 className="text-2xl font-bold">দোকানদার লগিন</h1>
          <p className="mt-1 text-sm text-muted-foreground">আপনার দোকানের একাউন্টে লগিন করুন।</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>ইমেইল</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" placeholder="you@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>পাসওয়ার্ড</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" placeholder="••••••••" />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-fuchsia-600 text-white hover:from-primary/90 hover:to-fuchsia-600/90"
              disabled={loading}
            >
              {loading ? "লগিন হচ্ছে..." : (<>লগিন করুন <ArrowRight className="ml-1 h-4 w-4" /></>)}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            একাউন্ট নেই? সুপার এডমিনকে যোগাযোগ করুন।
          </p>
        </div>
      </div>
    </div>
  );
}
