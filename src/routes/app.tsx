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
import { LayoutDashboard, Store, LogOut, CreditCard, Package, Tag, Ruler, Boxes, Truck, ShoppingCart, Users, Receipt, CalendarClock, BarChart3, Bell, Menu, ChevronDown, Activity, Warehouse, TrendingUp, PieChart, UserCog } from "lucide-react";
import { ImpersonationBanner } from "@/components/impersonation-banner";

export const Route = createFileRoute("/app")({ ssr: false, component: AppLayout });

type NavItem = { to: string; label: string; icon: any; exact?: boolean };
type NavGroup = { id: string; label: string; icon: any; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "ওভারভিউ",
    icon: Activity,
    items: [
      { to: "/app", label: "ড্যাশবোর্ড", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    id: "inventory",
    label: "ইনভেন্টরি",
    icon: Warehouse,
    items: [
      { to: "/app/products", label: "পণ্য", icon: Package },
      { to: "/app/categories", label: "ক্যাটাগরি", icon: Tag },
      { to: "/app/units", label: "একক", icon: Ruler },
      { to: "/app/stock", label: "স্টক", icon: Boxes },
    ],
  },
  {
    id: "purchases",
    label: "ক্রয়",
    icon: ShoppingCart,
    items: [
      { to: "/app/suppliers", label: "সাপ্লায়ার", icon: Truck },
      { to: "/app/purchases", label: "ক্রয় অর্ডার", icon: ShoppingCart },
    ],
  },
  {
    id: "sales",
    label: "বিক্রয়",
    icon: TrendingUp,
    items: [
      { to: "/app/customers", label: "কাস্টমার", icon: Users },
      { to: "/app/sales", label: "বিক্রয়", icon: Receipt },
      { to: "/app/installments", label: "কিস্তি", icon: CalendarClock },
    ],
  },
  {
    id: "insights",
    label: "ইনসাইটস",
    icon: PieChart,
    items: [
      { to: "/app/reports", label: "রিপোর্ট", icon: BarChart3 },
    ],
  },
  {
    id: "account",
    label: "একাউন্ট",
    icon: UserCog,
    items: [
      { to: "/app/subscription", label: "সাবস্ক্রিপশন", icon: CreditCard },
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
  const loc = useLocation();

  const isItemActive = (n: NavItem) => (n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to));
  const activeGroupId = NAV_GROUPS.find((g) => g.items.some(isItemActive))?.id ?? "overview";
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
  }, [shopQ.data, navigate]);

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

  const NavList = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((g) => {
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
                  const b = itemBadge(n.to);
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
                      {b && (
                        <span className={`ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                          b.tone === "danger" ? "bg-rose-500 text-white" : "bg-amber-400 text-slate-900"
                        }`}>
                          {b.text}
                        </span>
                      )}
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

  const ShopHeader = () => (
    <div className="flex min-w-0 items-center gap-3 border-b border-white/10 px-5 py-5 pr-12">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-500 shadow-md">
        <Store className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold truncate text-white leading-tight">{shopQ.data?.shop?.name}</div>
        <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300/70 mt-0.5 truncate">{shopQ.data?.shop?.owner_name}</div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col bg-[#0d3b2e] text-slate-100 md:flex">
        <ShopHeader />
        <NavList />
        <div className="border-t border-white/10 p-3">
          <Button variant="ghost" className="w-full justify-start text-emerald-50/80 hover:bg-white/5 hover:text-white" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> লগআউট
          </Button>
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
              <SheetContent side="left" className="flex w-[min(84vw,20rem)] flex-col p-0 bg-[#0d3b2e] text-slate-100 border-white/10">
                <SheetTitle className="sr-only">মেন্যু</SheetTitle>
                <ShopHeader />
                <NavList onClick={() => setMobileOpen(false)} />
                <div className="border-t border-white/10 p-2">
                  <Button variant="ghost" className="w-full justify-start text-emerald-50/80 hover:bg-white/5 hover:text-white" onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" /> লগআউট
                  </Button>
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
