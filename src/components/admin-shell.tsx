import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, Store, Package, Settings, LogOut, ShieldCheck, CreditCard, MessageSquare, Menu, Sparkles, ShieldAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/hooks/use-branding";
import type { ReactNode } from "react";


const nav: { to: string; label: string; icon: any; color: string; exact?: boolean }[] = [
  { to: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard, color: "from-sky-400 to-indigo-500", exact: true },
  { to: "/admin/shops", label: "দোকান সমূহ", icon: Store, color: "from-emerald-400 to-teal-500" },
  { to: "/admin/subscriptions", label: "পেমেন্ট", icon: CreditCard, color: "from-amber-400 to-orange-500" },
  { to: "/admin/packages", label: "প্যাকেজ", icon: Package, color: "from-fuchsia-400 to-pink-500" },
  { to: "/admin/admins", label: "এডমিন ইউজার", icon: Users, color: "from-indigo-400 to-violet-500" },
  { to: "/admin/sms-logs", label: "SMS লগ", icon: MessageSquare, color: "from-cyan-400 to-blue-500" },
  { to: "/admin/impersonation-logs", label: "ইম্পার্সোনেশন লগ", icon: ShieldAlert, color: "from-rose-400 to-orange-500" },
  { to: "/admin/settings", label: "সেটিংস", icon: Settings, color: "from-violet-400 to-purple-600" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { siteName, logoUrl } = useBranding();

  useEffect(() => { setOpen(false); }, [loc.pathname]);


  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  };

  const NavList = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {nav.map((n) => {
        const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
        return (
          <Link key={n.to} to={n.to} onClick={onClick}
            className={`group flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
              active
                ? "bg-white/10 text-white shadow-lg shadow-black/20 ring-1 ring-white/10"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${n.color} shadow-md ${active ? "" : "opacity-90 group-hover:opacity-100"}`}>
              <n.icon className="h-4 w-4 text-white" />
            </span>
            <span className="truncate font-medium">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const Brand = () => (
    <div className="flex min-w-0 items-center gap-3 border-b border-white/10 px-4 py-4 pr-12">
      {logoUrl ? (
        <img src={logoUrl} alt={siteName} className="h-10 w-10 shrink-0 rounded-xl object-contain bg-white p-1" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-rose-500 shadow-lg">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate font-bold text-white">{siteName}</div>
        <div className="truncate text-[11px] text-slate-400 flex items-center gap-1"><Sparkles className="h-3 w-3" /> সুপার এডমিন</div>
      </div>
    </div>
  );


  const current = nav.find((n) => n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to));

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-slate-100 md:flex">
        <Brand />
        <NavList />
        <div className="border-t border-white/10 p-3">
          <Button variant="ghost" className="w-full justify-start text-slate-300 hover:bg-white/5 hover:text-white" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> লগআউট
          </Button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col bg-gradient-to-br from-slate-50 via-indigo-50/40 to-fuchsia-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
        <div className="sticky top-0 z-30 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-white/10 bg-gradient-to-r from-slate-950 to-indigo-950 px-3 py-2.5 text-slate-100 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="h-9 shrink-0 gap-2 px-3 text-slate-100 hover:bg-white/10 hover:text-white" aria-label="মেন্যু খুলুন">
                <Menu className="h-5 w-5" />
                <span className="text-sm font-medium">মেন্যু</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(84vw,20rem)] border-white/10 bg-gradient-to-b from-slate-950 to-indigo-950 p-0 text-slate-100">
              <SheetTitle className="sr-only">মেন্যু</SheetTitle>
              <div className="flex h-full flex-col">
                <Brand />
                <NavList onClick={() => setOpen(false)} />
                <div className="border-t border-white/10 p-3">
                  <Button variant="ghost" className="w-full justify-start text-slate-300 hover:bg-white/5 hover:text-white" onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" /> লগআউট
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex min-w-0 items-center gap-2">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="h-9 w-9 shrink-0 rounded-lg object-contain bg-white p-0.5" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">
                <ShieldCheck className="h-4 w-4 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{siteName}</div>
              <div className="truncate text-xs text-slate-300">{current?.label ?? "এডমিন প্যানেল"}</div>
            </div>
          </div>

        </div>
        <div className="min-w-0 flex-1 overflow-x-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </main>
    </div>
  );
}
