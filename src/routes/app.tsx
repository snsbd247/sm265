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
import { LayoutDashboard, Store, LogOut, CreditCard, Package, Tag, Ruler, Boxes, Truck, ShoppingCart, Users, Receipt, CalendarClock, BarChart3, Bell, Menu, Sparkles } from "lucide-react";
import { ImpersonationBanner } from "@/components/impersonation-banner";

export const Route = createFileRoute("/app")({ ssr: false, component: AppLayout });

const NAV_ITEMS: { to: string; label: string; icon: any; color: string; exact?: boolean }[] = [
  { to: "/app", label: "ড্যাশবোর্ড", icon: LayoutDashboard, color: "from-sky-400 to-indigo-500", exact: true },
  { to: "/app/products", label: "পণ্য", icon: Package, color: "from-emerald-400 to-teal-500" },
  { to: "/app/categories", label: "ক্যাটাগরি", icon: Tag, color: "from-pink-400 to-rose-500" },
  { to: "/app/units", label: "একক", icon: Ruler, color: "from-amber-400 to-orange-500" },
  { to: "/app/stock", label: "স্টক", icon: Boxes, color: "from-lime-400 to-emerald-500" },
  { to: "/app/suppliers", label: "সাপ্লায়ার", icon: Truck, color: "from-cyan-400 to-blue-500" },
  { to: "/app/purchases", label: "ক্রয়", icon: ShoppingCart, color: "from-violet-400 to-purple-600" },
  { to: "/app/customers", label: "কাস্টমার", icon: Users, color: "from-fuchsia-400 to-pink-500" },
  { to: "/app/sales", label: "বিক্রয়", icon: Receipt, color: "from-orange-400 to-red-500" },
  { to: "/app/installments", label: "কিস্তি", icon: CalendarClock, color: "from-yellow-400 to-amber-500" },
  { to: "/app/reports", label: "রিপোর্ট", icon: BarChart3, color: "from-teal-400 to-cyan-500" },
  { to: "/app/subscription", label: "সাবস্ক্রিপশন", icon: CreditCard, color: "from-indigo-400 to-blue-600" },
];

function AppLayout() {
  const { loading, session, primaryShopId } = useAuth();
  const navigate = useNavigate();
  const fn = useServerFn(getMyShop);
  const shopQ = useQuery({ queryKey: ["my-shop"], queryFn: () => fn(), enabled: !!session });
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();

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

  const NavList = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {NAV_ITEMS.map((n) => {
        const active = n.exact ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
        return (
          <Link key={n.to} to={n.to} onClick={onClick}
            className={`group flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
              active
                ? "bg-gradient-to-r from-primary/10 to-primary/5 text-foreground shadow-sm ring-1 ring-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${n.color} shadow-md ${active ? "" : "opacity-85 group-hover:opacity-100"}`}>
              <n.icon className="h-4 w-4 text-white" />
            </span>
            <span className="truncate font-medium">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const ShopHeader = () => (
    <div className="flex min-w-0 items-center gap-3 border-b bg-gradient-to-r from-primary/5 via-transparent to-transparent px-4 py-4 pr-12">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-500 shadow-lg">
        <Store className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold truncate">{shopQ.data?.shop?.name}</div>
        <div className="text-xs text-muted-foreground truncate flex items-center gap-1"><Sparkles className="h-3 w-3" />{shopQ.data?.shop?.owner_name}</div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-card md:flex">
        <ShopHeader />
        <NavList />
        <div className="border-t p-3">
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> লগআউট
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-gradient-to-br from-slate-50 via-sky-50/40 to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
        <ImpersonationBanner />

        <div className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-card/80 backdrop-blur px-3 py-2.5 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            {/* Mobile menu trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" className="h-9 shrink-0 gap-2 px-3 md:hidden" aria-label="মেন্যু খুলুন">
                  <Menu className="h-5 w-5" />
                  <span className="text-sm font-medium">মেন্যু</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-[min(84vw,20rem)] flex-col p-0">
                <SheetTitle className="sr-only">মেন্যু</SheetTitle>
                <ShopHeader />
                <NavList onClick={() => setMobileOpen(false)} />
                <div className="border-t p-2">
                  <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" /> লগআউট
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0 md:hidden">
              <div className="truncate text-sm font-semibold">{shopQ.data?.shop?.name}</div>
              <div className="truncate text-xs text-muted-foreground">শপ প্যানেল</div>
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
