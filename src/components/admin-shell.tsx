import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, Store, Package, Settings, LogOut, ShieldCheck, CreditCard, MessageSquare, Menu, ShieldAlert, Users, ChevronDown, Activity, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/hooks/use-branding";
import type { ReactNode } from "react";


type NavItem = { to: string; label: string; icon: any; exact?: boolean };
type NavGroup = { id: string; label: string; icon: any; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    id: "overview",
    label: "ওভারভিউ",
    icon: Activity,
    items: [
      { to: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    id: "management",
    label: "ম্যানেজমেন্ট",
    icon: Store,
    items: [
      { to: "/admin/shops", label: "দোকান সমূহ", icon: Store },
      { to: "/admin/subscriptions", label: "পেমেন্ট", icon: CreditCard },
      { to: "/admin/packages", label: "প্যাকেজ", icon: Package },
      { to: "/admin/admins", label: "এডমিন ইউজার", icon: Users },
    ],
  },
  {
    id: "logs",
    label: "লগস",
    icon: FileText,
    items: [
      { to: "/admin/sms-logs", label: "SMS লগ", icon: MessageSquare },
      { to: "/admin/impersonation-logs", label: "ইম্পার্সোনেশন লগ", icon: ShieldAlert },
    ],
  },
  {
    id: "system",
    label: "সিস্টেম",
    icon: Settings,
    items: [
      { to: "/admin/settings", label: "সেটিংস", icon: Settings },
    ],
  },
];

const allItems = navGroups.flatMap((g) => g.items);

export function AdminShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { siteName, logoUrl } = useBranding();

  const isItemActive = (n: NavItem) => (n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to));
  const activeGroupId = navGroups.find((g) => g.items.some(isItemActive))?.id ?? "overview";
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navGroups.map((g) => [g.id, true]))
  );
  const toggleGroup = (id: string) => setOpenGroups((s) => ({ ...s, [id]: !s[id] }));

  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => { setOpenGroups((s) => ({ ...s, [activeGroupId]: true })); }, [activeGroupId]);


  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  };

  const NavList = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
      {navGroups.map((g) => {
        const isOpen = openGroups[g.id] ?? true;
        const hasActive = g.items.some(isItemActive);
        return (
          <div key={g.id} className="space-y-0.5">
            <button
              type="button"
              onClick={() => toggleGroup(g.id)}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest transition ${
                hasActive ? "text-emerald-200" : "text-emerald-200/50 hover:text-emerald-200/80"
              }`}
            >
              <span className="flex items-center gap-2">
                <g.icon className="h-3 w-3" />
                {g.label}
              </span>
              <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
            </button>
            {isOpen && (
              <div className="space-y-0.5">
                {g.items.map((n) => {
                  const active = isItemActive(n);
                  return (
                    <Link key={n.to} to={n.to} onClick={onClick}
                      className={`group relative flex min-w-0 items-center gap-3 rounded-md px-3 py-2 text-sm transition-all ${
                        active
                          ? "bg-emerald-600/25 text-white"
                          : "text-emerald-50/80 hover:bg-white/5 hover:text-white"
                      }`}>
                      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-emerald-300" />}
                      <n.icon className={`h-4 w-4 shrink-0 ${active ? "text-emerald-200" : "opacity-70 group-hover:opacity-100"}`} />
                      <span className="truncate font-medium">{n.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  const Brand = () => (
    <div className="flex min-w-0 items-center gap-3 border-b border-white/10 px-5 py-5 pr-12">
      {logoUrl ? (
        <img src={logoUrl} alt={siteName} className="h-9 w-9 shrink-0 rounded-md object-contain bg-white p-1" />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-500 shadow-md">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate font-bold text-white leading-tight">{siteName}</div>
        <div className="truncate text-[10px] font-semibold uppercase tracking-widest text-emerald-300/70 mt-0.5">সুপার এডমিন</div>
      </div>
    </div>
  );


  const current = allItems.find(isItemActive);

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 flex-col bg-[#0d3b2e] text-slate-100 md:flex">
        <Brand />
        <NavList />
        <div className="border-t border-white/10 p-3">
          <Button variant="ghost" className="w-full justify-start text-emerald-50/80 hover:bg-white/5 hover:text-white" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> লগআউট
          </Button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col bg-slate-50 dark:bg-slate-950">
        <div className="sticky top-0 z-30 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-white/10 bg-[#0d3b2e] px-3 py-2.5 text-slate-100 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="h-9 shrink-0 gap-2 px-3 text-slate-100 hover:bg-white/10 hover:text-white" aria-label="মেন্যু খুলুন">
                <Menu className="h-5 w-5" />
                <span className="text-sm font-medium">মেন্যু</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(84vw,20rem)] border-white/10 bg-[#0d3b2e] p-0 text-slate-100">
              <SheetTitle className="sr-only">মেন্যু</SheetTitle>
              <div className="flex h-full flex-col">
                <Brand />
                <NavList onClick={() => setOpen(false)} />
                <div className="border-t border-white/10 p-3">
                  <Button variant="ghost" className="w-full justify-start text-emerald-50/80 hover:bg-white/5 hover:text-white" onClick={signOut}>
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
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500">
                <ShieldCheck className="h-4 w-4 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{siteName}</div>
              <div className="truncate text-xs text-emerald-200/80">{current?.label ?? "এডমিন প্যানেল"}</div>
            </div>
          </div>

        </div>
        <div className="min-w-0 flex-1 overflow-x-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </main>
    </div>
  );
}
