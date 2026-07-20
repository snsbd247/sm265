// Tracks the currently-open impersonation tab from the admin's tab.
// Module-scope singleton so both admin.shops.index and admin.shops.$shopId
// share the same reference across route navigations.

let openWin: Window | null = null;
let openShopId: string | null = null;

export function getActiveImpersonation(): { win: Window; shopId: string | null } | null {
  if (!openWin || openWin.closed) {
    openWin = null;
    openShopId = null;
    return null;
  }
  return { win: openWin, shopId: openShopId };
}

export function setActiveImpersonation(win: Window | null, shopId: string) {
  openWin = win;
  openShopId = shopId;
}

export function clearActiveImpersonation() {
  openWin = null;
  openShopId = null;
}
