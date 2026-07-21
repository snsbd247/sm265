import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyShop } from "@/lib/shop.functions";
import { getShopNotifications } from "@/lib/notifications.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { LayoutDashboard, Store, LogOut, CreditCard, Package, Tag, Ruler, Boxes, Truck, ShoppingCart, Users, Receipt, CalendarClock, BarChart3, Bell, Menu, Activity, Warehouse, TrendingUp, PieChart, UserCog, Wallet, FileText, KeyRound, PanelLeftClose, PanelLeft } from "lucide-react";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { isModuleAllowed, type ModuleKey } from "@/lib/modules";
import { SidebarNavList, SidebarIconRail, readCollapsed, writeCollapsed, type SidebarNavItem } from "@/components/sidebar-nav";

export const Route = createFileRoute("/app")({ ssr: false, component: AppLayout });

type NavItem = { to: string; label: string; icon: any; exact?: boolean; module: ModuleKey };
type NavGroup = { id: string; label: string; icon: any; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "ওভারভিউ",
    icon: Activity,
    items: [
      { to: "/app", label: "ড্যাশবোর্ড", icon: LayoutDashboard, exact: true, module: "dashboard" },
    ],
  },
  {
    id: "inventory",
    label: "ইনভেন্টরি",
    icon: Warehouse,
    items: [
      { to: "/app/products", label: "পণ্য", icon: Package, module: "products" },
      { to: "/app/categories", label: "ক্যাটাগরি", icon: Tag, module: "categories" },
      { to: "/app/units", label: "একক", icon: Ruler, module: "units" },
      { to: "/app/stock", label: "স্টক", icon: Boxes, module: "stock" },
    ],
  },
  {
    id: "purchases",
    label: "ক্রয়",
    icon: ShoppingCart,
    items: [
      { to: "/app/suppliers", label: "সাপ্লায়ার", icon: Truck, module: "suppliers" },
      { to: "/app/purchases", label: "ক্রয় অর্ডার", icon: ShoppingCart, module: "purchases" },
    ],
  },
  {
    id: "sales",
    label: "বিক্রয়",
    icon: TrendingUp,
    items: [
      { to: "/app/customers", label: "কাস্টমার", icon: Users, module: "customers" },
      { to: "/app/sales", label: "বিক্রয়", icon: Receipt, module: "sales" },
      { to: "/app/installments", label: "কিস্তি", icon: CalendarClock, module: "installments" },
      { to: "/app/shifts", label: "শিফট", icon: Wallet, module: "shifts" },
    ],
  },
  {
    id: "insights",
    label: "ইনসাইটস",
    icon: PieChart,
    items: [
      { to: "/app/reports", label: "রিপোর্ট", icon: BarChart3, module: "reports" },
    ],
  },
  {
    id: "account",
    label: "একাউন্ট",
    icon: UserCog,
    items: [
      { to: "/app/subscription", label: "সাবস্ক্রিপশন", icon: CreditCard, module: "subscription" },
      { to: "/app/usage", label: "ব্যবহার রিপোর্ট", icon: PieChart, module: "usage" },
      { to: "/app/settings/invoice-template", label: "ইনভয়েস টেমপ্লেট", icon: FileText, module: "invoice_template" },
      { to: "/app/change-password", label: "পাসওয়ার্ড পরিবর্তন", icon: KeyRound, module: "change_password" },
    ],
  },
];

function AppLayout() {
  const { loading, session, primaryShopId } = useAuth();
  const navigate = useNavigate();
  const fn = useServerFn(getMyShop);
  const shopQ = useQuery({ queryKey: ["my-shop"], queryFn: () => fn(), enabled: !!session });
  const notifFn = useServerFn(getShopNotifications);
  const notifQ = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notifFn(),
    enabled: !!session,
    refetchInterval: 60_000,
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { setCollapsed(readCollapsed()); }, []);
  const toggleCollapsed = () => { const n = !collapsed; setCollapsed(n); writeCollapsed(n); };
  const loc = useLocation();

  const allowedModules: string[] | null =
    (shopQ.data?.shop?.package as any)?.allowed_modules ?? null;
  const visibleGroups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((n) => isModuleAllowed(allowedModules, n.module)) }))
    .filter((g) => g.items.length > 0);

  const isItemActive = (n: NavItem) => (n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to));
  const isItemActiveGeneric = (n: SidebarNavItem) => (n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to));
  const activeGroupId = visibleGroups.find((g) => g.items.some(isItemActive))?.id ?? "overview";
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((g) => [g.id, true]))
  );
  const toggleGroup = (id: string) => setOpenGroups((s) => ({ ...s, [id]: !s[id] }));
  useEffect(() => { setOpenGroups((s) => ({ ...s, [activeGroupId]: true })); }, [activeGroupId]);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!primaryShopId) navigate({ to: "/" });
  }, [loading, session, primaryShopId, navigate]);

  useEffect(() => {
    if (shopQ.data?.shop && ["expired", "locked", "suspended"].includes(shopQ.data.shop.status)) {
      navigate({ to: "/renew" });
    }
    if (shopQ.data?.shop?.status === "pending_payment" && loc.pathname !== "/app/pay-invoice") {
      navigate({ to: "/app/pay-invoice" });
    }
  }, [shopQ.data, navigate, loc.pathname]);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  if (loading || !session || shopQ.isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">লোড হচ্ছে...</div>;
  }

  const signOut = async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); };

  const overdueCount = (notifQ.data as any)?.overdue_count ?? 0;
  const lowStockCount = (notifQ.data as any)?.low_stock_count ?? 0;
  const subExpiringSoon = (notifQ.data?.items ?? []).some((n: any) => n.type === "sub-expiring");
  const itemBadge = (to: string): { text: string; tone: "danger" | "warn" } | null => {
    if (to === "/app/installments" && overdueCount > 0) return { text: String(overdueCount), tone: "danger" };
    if (to === "/app/products" && lowStockCount > 0) return { text: String(lowStockCount), tone: "warn" };
    if (to === "/app/subscription" && subExpiringSoon) return { text: "!", tone: "warn" };
    return null;
  };

  const groupsWithBadges = visibleGroups.map((g) => ({
    ...g,
    items: g.items.map((n) => ({ ...n, badge: itemBadge(n.to) })),
  }));

  const ShopHeader = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex min-w-0 items-center border-b border-emerald-900/50 bg-emerald-900/40 ${compact ? "justify-center px-3 py-4" : "gap-3 px-6 py-5 pr-12"}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 shadow-lg shadow-emerald-500/20">
        <Store className="h-5 w-5 text-white" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <div className="font-bold truncate text-white leading-tight">{shopQ.data?.shop?.name}</div>
          <div className="text-xs font-medium text-emerald-400/80 mt-0.5 truncate">{shopQ.data?.shop?.owner_name}</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className={`hidden flex-col bg-emerald-950 text-slate-100 border-r border-emerald-900/50 md:flex transition-[width] duration-200 ${collapsed ? "w-[72px]" : "w-64"}`}>
        <ShopHeader compact={collapsed} />
        {collapsed ? (
          <SidebarIconRail groups={groupsWithBadges} isItemActive={isItemActiveGeneric} />
        ) : (
          <SidebarNavList groups={groupsWithBadges} isItemActive={isItemActiveGeneric} openGroups={openGroups} toggleGroup={toggleGroup} />
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
        <ImpersonationBanner />

        <div className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            {/* Mobile menu trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" className="h-9 shrink-0 gap-2 px-3 md:hidden" aria-label="মেন্যু খুলুন">
                  <Menu className="h-5 w-5" />
                  <span className="text-sm font-medium">মেন্যু</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-[min(84vw,20rem)] flex-col p-0 bg-emerald-950 text-slate-100 border-emerald-900/50">
                <SheetTitle className="sr-only">মেন্যু</SheetTitle>
                <ShopHeader />
                <SidebarNavList groups={groupsWithBadges} isItemActive={isItemActiveGeneric} openGroups={openGroups} toggleGroup={toggleGroup} onItemClick={() => setMobileOpen(false)} />
                <div className="mt-auto border-t border-emerald-900/50 bg-emerald-900/20 p-4">
                  <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all">
                    <LogOut className="h-4 w-4" /> লগআউট
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0 md:hidden">
              <div className="truncate text-sm font-semibold text-slate-900">{shopQ.data?.shop?.name}</div>
              <div className="truncate text-xs text-slate-500">শপ প্যানেল</div>
            </div>
          </div>
          <NotificationsBell />
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NotificationsBell() {
  const fn = useServerFn(getShopNotifications);
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });
  const items = data?.items ?? [];
  const count = data?.count ?? 0;
  const severityColor = (s: string) => s === "danger" ? "text-destructive" : s === "warn" ? "text-amber-600" : "text-muted-foreground";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1 text-[10px]" variant="destructive">{count}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-1.5rem)] max-w-sm p-0 sm:w-80">
        <div className="border-b px-4 py-2 font-semibold text-sm">নোটিফিকেশন</div>
        {items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">সব ক্লিয়ার ✓</div>
        ) : (
          <div className="max-h-80 divide-y overflow-y-auto">
            {items.map((n: any, i: number) => (
              <Link key={i} to={n.href ?? "/app"} className="block px-4 py-3 hover:bg-muted/50">
                <div className={`text-sm font-medium ${severityColor(n.severity)}`}>{n.title}</div>
                <div className="text-xs text-muted-foreground">{n.body}</div>
              </Link>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
