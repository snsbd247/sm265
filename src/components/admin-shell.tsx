import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, Store, Package, Settings, LogOut, ShieldCheck, CreditCard, MessageSquare, Menu, ShieldAlert, Users, Activity, FileText, Bell, History, Inbox, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/hooks/use-branding";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminNotifications } from "@/lib/admin.functions";
import { SidebarNavList, SidebarIconRail, readCollapsed, writeCollapsed, type SidebarNavGroup, type SidebarNavItem } from "@/components/sidebar-nav";

const navGroups: SidebarNavGroup[] = [
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
      { to: "/admin/demo-requests", label: "ডেমো রিকোয়েস্ট", icon: Inbox },
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
      { to: "/admin/audit-logs", label: "অডিট লগ", icon: History },
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
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { setCollapsed(readCollapsed()); }, []);
  const toggleCollapsed = () => { const n = !collapsed; setCollapsed(n); writeCollapsed(n); };
  const { siteName, logoUrl } = useBranding();

  const isItemActive = (n: SidebarNavItem) => (n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to));
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

  const Brand = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex min-w-0 items-center border-b border-emerald-900/50 bg-emerald-900/40 ${compact ? "justify-center px-3 py-4" : "gap-3 px-6 py-5 pr-12"}`}>
      {logoUrl ? (
        <img src={logoUrl} alt={siteName} className="h-10 w-10 shrink-0 rounded-xl object-contain bg-white p-1" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 shadow-lg shadow-emerald-500/20">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
      )}
      {!compact && (
        <div className="min-w-0">
          <div className="truncate font-bold text-white leading-tight">{siteName}</div>
          <div className="truncate text-xs font-medium text-emerald-400/80 mt-0.5">সুপার এডমিন প্যানেল</div>
        </div>
      )}
    </div>
  );


  const current = allItems.find(isItemActive);

  return (
    <div className="flex min-h-dvh">
      <aside className={`hidden flex-col bg-emerald-950 text-slate-100 border-r border-emerald-900/50 md:flex transition-[width] duration-200 ${collapsed ? "w-[72px]" : "w-64"}`}>
        <Brand compact={collapsed} />
        {collapsed ? (
          <SidebarIconRail groups={navGroups} isItemActive={isItemActive} />
        ) : (
          <SidebarNavList groups={navGroups} isItemActive={isItemActive} openGroups={openGroups} toggleGroup={toggleGroup} />
        )}
        <div className="mt-auto border-t border-emerald-900/50 bg-emerald-900/20 p-3 space-y-1">
          <button
            onClick={toggleCollapsed}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-emerald-100/70 hover:bg-white/5 hover:text-white transition-all ${collapsed ? "justify-center" : ""}`}
            aria-label={collapsed ? "সাইডবার এক্সপ্যান্ড" : "সাইডবার কোল্যাপ্স"}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> কোল্যাপ্স</>}
          </button>
          <button onClick={signOut} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all ${collapsed ? "justify-center" : ""}`} aria-label="লগআউট">
            <LogOut className="h-4 w-4" /> {!collapsed && "লগআউট"}
          </button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col bg-slate-50 dark:bg-slate-950">
        <div className="sticky top-0 z-30 hidden items-center justify-end gap-2 border-b border-slate-200 bg-white px-6 py-2 md:flex">
          <AdminNotificationsBell />
        </div>
        <div className="sticky top-0 z-30 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-emerald-900/50 bg-emerald-950 px-3 py-2.5 text-slate-100 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="h-9 shrink-0 gap-2 px-3 text-slate-100 hover:bg-white/10 hover:text-white" aria-label="মেন্যু খুলুন">
                <Menu className="h-5 w-5" />
                <span className="text-sm font-medium">মেন্যু</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(84vw,20rem)] border-emerald-900/50 bg-emerald-950 p-0 text-slate-100">
              <SheetTitle className="sr-only">মেন্যু</SheetTitle>
              <div className="flex h-full flex-col">
                <Brand />
                <SidebarNavList groups={navGroups} isItemActive={isItemActive} openGroups={openGroups} toggleGroup={toggleGroup} onItemClick={() => setOpen(false)} />
                <div className="mt-auto border-t border-emerald-900/50 bg-emerald-900/20 p-4">
                  <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all">
                    <LogOut className="h-4 w-4" /> লগআউট
                  </button>
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
          <AdminNotificationsBell dark />
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </main>
    </div>
  );
}

function AdminNotificationsBell({ dark = false }: { dark?: boolean }) {
  const fn = useServerFn(getAdminNotifications);
  const { data } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });
  const items = data?.items ?? [];
  const count = data?.count ?? 0;
  const sev = (s: string) => s === "danger" ? "text-rose-600" : s === "warn" ? "text-amber-600" : "text-slate-600";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative ${dark ? "text-emerald-50 hover:bg-white/10 hover:text-white" : ""}`}
          aria-label="নোটিফিকেশন"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1 text-[10px]" variant="destructive">{count}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-1.5rem)] max-w-sm p-0 sm:w-80">
        <div className="border-b px-4 py-2 text-sm font-semibold">এডমিন নোটিফিকেশন</div>
        {items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">সব ক্লিয়ার ✓</div>
        ) : (
          <div className="max-h-80 divide-y overflow-y-auto">
            {items.map((n: any, i: number) => (
              <Link key={i} to={n.href ?? "/admin"} className="block px-4 py-3 hover:bg-muted/50">
                <div className={`text-sm font-medium ${sev(n.severity)}`}>{n.title}</div>
                <div className="text-xs text-muted-foreground">{n.body}</div>
              </Link>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
