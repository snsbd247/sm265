import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type SidebarNavItem = {
  to: string;
  label: string;
  icon: any;
  exact?: boolean;
  badge?: { text: string; tone: "danger" | "warn" } | null;
};
export type SidebarNavGroup = {
  id: string;
  label: string;
  icon: any;
  items: SidebarNavItem[];
};

function BadgePill({ tone, text }: { tone: "danger" | "warn"; text: string }) {
  return (
    <span
      className={`ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
        tone === "danger" ? "bg-rose-500 text-white" : "bg-amber-400 text-slate-900"
      }`}
    >
      {text}
    </span>
  );
}

function ItemRow({
  item,
  active,
  onClick,
}: {
  item: SidebarNavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={`group relative flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 ${
        active
          ? "bg-emerald-500/10 text-emerald-300 backdrop-blur-md border-r-4 border-emerald-400 shadow-[inset_0_0_20px_rgba(16,185,129,0.06)]"
          : "text-emerald-100/70 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
          active
            ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30"
            : "text-emerald-100/60 group-hover:text-white"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2} />
      </span>
      <span className="truncate font-medium">{item.label}</span>
      {item.badge && <BadgePill tone={item.badge.tone} text={item.badge.text} />}
    </Link>
  );
}

/** Expanded desktop / mobile drawer nav list */
export function SidebarNavList({
  groups,
  isItemActive,
  openGroups,
  toggleGroup,
  onItemClick,
}: {
  groups: SidebarNavGroup[];
  isItemActive: (i: SidebarNavItem) => boolean;
  openGroups: Record<string, boolean>;
  toggleGroup: (id: string) => void;
  onItemClick?: () => void;
}) {
  return (
    <nav aria-label="Primary" className="flex-1 space-y-5 overflow-y-auto p-3">
      {groups.map((g) => {
        const isOpen = openGroups[g.id] ?? true;
        const hasActive = g.items.some(isItemActive);
        const GIcon = g.icon;
        const panelId = `sb-group-${g.id}`;
        return (
          <div key={g.id} className="space-y-1">
            <button
              type="button"
              onClick={() => toggleGroup(g.id)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className={`flex w-full items-center justify-between rounded-md px-3 pb-1 text-[10px] font-bold uppercase tracking-widest transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
                hasActive ? "text-emerald-400/80" : "text-emerald-500/50 hover:text-emerald-400/80"
              }`}
            >
              <span className="flex items-center gap-2">
                <GIcon className="h-3 w-3" />
                {g.label}
              </span>
              <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
            </button>
            {isOpen && (
              <div id={panelId} role="group" aria-label={g.label} className="space-y-1">
                {g.items.map((n) => (
                  <ItemRow key={n.to} item={n} active={isItemActive(n)} onClick={onItemClick} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Collapsed desktop icon rail with hover popover for group sub-items */
export function SidebarIconRail({
  groups,
  isItemActive,
  onItemClick,
  tooltipDelay = 150,
  tooltipSide = "right",
  tooltipSideOffset = 8,
}: {
  groups: SidebarNavGroup[];
  isItemActive: (i: SidebarNavItem) => boolean;
  onItemClick?: () => void;
  tooltipDelay?: number;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  tooltipSideOffset?: number;
}) {
  return (
    <TooltipProvider delayDuration={tooltipDelay}>
      <nav aria-label="Primary" className="flex-1 space-y-2 overflow-y-auto px-2 py-3">
        {groups.map((g) => {
          const GIcon = g.icon;
          const hasActive = g.items.some(isItemActive);
          // Single-item group → just render the item icon
          if (g.items.length === 1) {
            const n = g.items[0];
            const active = isItemActive(n);
            const Icon = n.icon;
            return (
              <Tooltip key={g.id}>
                <TooltipTrigger asChild>
                  <Link
                    to={n.to}
                    onClick={onItemClick}
                    aria-label={n.label}
                    aria-current={active ? "page" : undefined}
                    className={`relative mx-auto flex h-11 w-11 items-center justify-center rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                      active
                        ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30 backdrop-blur-md"
                        : "text-emerald-100/60 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                    {n.badge && (
                      <span
                        className={`absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                          n.badge.tone === "danger" ? "bg-rose-500 text-white" : "bg-amber-400 text-slate-900"
                        }`}
                      >
                        {n.badge.text}
                      </span>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  side={tooltipSide}
                  sideOffset={tooltipSideOffset}
                  className={`border text-xs font-medium ${
                    active
                      ? "border-emerald-400/60 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "border-emerald-800/50 bg-emerald-900 text-white"
                  }`}
                >
                  {n.label}
                  {active && <span className="ml-2 text-[10px] uppercase tracking-wider opacity-80">• Active</span>}
                </TooltipContent>
              </Tooltip>
            );
          }
          return (
            <Popover key={g.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`relative mx-auto flex h-11 w-11 items-center justify-center rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                        hasActive
                          ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30 backdrop-blur-md"
                          : "text-emerald-100/60 hover:bg-white/5 hover:text-white"
                      }`}
                      aria-label={g.label}
                      aria-haspopup="menu"
                    >
                      <GIcon className="h-5 w-5" strokeWidth={hasActive ? 2.5 : 2} />
                      <ChevronRight className="absolute -right-0.5 top-1/2 h-3 w-3 -translate-y-1/2 opacity-40" />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent
                  side={tooltipSide}
                  sideOffset={tooltipSideOffset}
                  className={`border text-xs font-medium ${
                    hasActive
                      ? "border-emerald-400/60 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "border-emerald-800/50 bg-emerald-900 text-white"
                  }`}
                >
                  {g.label}
                  {hasActive && <span className="ml-2 text-[10px] uppercase tracking-wider opacity-80">• Active</span>}
                </TooltipContent>
              </Tooltip>
              <PopoverContent
                side={tooltipSide}
                align="start"
                sideOffset={12}
                className="w-60 border border-emerald-800/50 bg-emerald-950 p-2 text-slate-100 shadow-2xl"
              >
                <div className="mb-2 px-2 pt-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">
                  {g.label}
                </div>
                <div role="menu" aria-label={g.label} className="space-y-1">
                  {g.items.map((n) => (
                    <ItemRow key={n.to} item={n} active={isItemActive(n)} onClick={onItemClick} />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}

const KEY = "sidebar:collapsed";
export function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}
export function writeCollapsed(v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, v ? "1" : "0");
}