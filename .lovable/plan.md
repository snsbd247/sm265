## Overview
Enforce customer/invoice/staff limits per package, add usage-history reports, harden single-active subscription invariants, expose payment history/audit UI for subscription invoices, and notify shop owners on activation/expiry.

## 1. Schema additions (single migration)
Extend `packages`:
- `max_customers int not null default 0` (-1 = unlimited)
- `max_invoices_per_month int not null default 0`
- `max_invoice_total_per_month numeric(14,2) not null default 0`
- `max_staff int not null default 0` (distinct from `max_users` which stays as-is; if user prefers we can reuse `max_users`)

Extend `subscription_payments`:
- `paid_via text` ('cash' | 'bank' | 'bkash-manual' | 'bkash-webhook' | 'admin')
- `payment_note text`

New table `subscription_payment_ledger` (append-only receipt log):
- `id`, `payment_id fk`, `shop_id fk`, `amount numeric`, `method text`, `reference text`, `note text`, `received_by uuid`, `created_at`
- Full grants + RLS (shop members SELECT own, super-admin ALL).

## 2. limits.server.ts — expand
Add `LimitKind` variants: `customers`, `invoices`, `invoice_total`, `staff`. Extend `loadShopPackageLimits`, `countUsage` (monthly window for invoice metrics), `getUsage`, `enforceLimit`. Reuse `LimitExceededError` with Bengali labels + upgrade-CTA hint.

## 3. Enforcement points
- `saveCustomer` (create only) → `enforceLimit("customers")`
- `createSale` server fn → `enforceLimit("invoices")` + check monthly total + new sale amount against `invoice_total`
- Staff-add function (in `shop.functions.ts` / admin) → `enforceLimit("staff")`
- All throw structured error → existing `UpgradeDialog` on the frontend picks up `LIMIT_EXCEEDED`. Wire the dialog in Customers page (import same component used in Products page).

## 4. Usage history report
New route `src/routes/app.usage.tsx`:
- Server fn `getUsageHistory` (in `limits.server.ts` companion `usage.functions.ts`) returns last 12 months of used vs limit for products, staff, sms, customers, invoices, invoice_total (products/staff/customers use current snapshot; sms/invoices are month-bucketed via SQL `date_trunc`).
- Render KPI cards + Recharts bar charts (reuse `TrendChart` component or new one).
- Add sidebar link under "প্যাকেজ / সাবস্ক্রিপশন".

## 5. Subscription invariants (race-safe)
- Add unique partial index: `create unique index one_active_sub_per_shop on subscriptions(shop_id) where status='active'`.
- Wrap `activatePaymentAndExtendShop` supersede+insert in an advisory lock: `pg_advisory_xact_lock(hashtext(shop_id::text))` via RPC `claim_shop_activation(shop_id uuid)`.
- On unique-violation catch → retry once after re-expiring, log audit.

## 6. Subscription payment history + audit UI
- New server fn `getSubscriptionInvoiceDetail(paymentId)` returns invoice + ledger entries + audit_logs filtered by `target_id=payment_id`.
- Extend admin subscription-payment approval flow: after marking `success`, insert ledger row and log audit (already done; verify).
- Add manual "Receive Payment" dialog on `admin.subscriptions.tsx` supporting cash / bank / bkash-manual; each insert creates ledger row + updates status pending→paid; on full amount → triggers activation; partial amount → keeps `pending` with remaining balance surfaced.
- Shop-side `/app/pay-invoice` page: show ledger of payments applied to each invoice with method/date/reference.

## 7. Owner notifications on state change
- Extend `activatePaymentAndExtendShop`: already sends SMS. Add in-app notification row (new `notifications` table if none — check first; if `notifications.functions.ts` exists, reuse).
- Add nightly cron `expire-subscriptions` server route `/api/public/hooks/expire-subs` — scans shops where `subscription_end < now()` and status active → sets `expired`, SMS + notification.

## 8. Frontend upgrade-dialog wiring
Ensure Customers page, POS (`sales.new.tsx`), Staff add form all catch `LIMIT_EXCEEDED` errors and open `<UpgradeDialog />` with the returned `kind` + package name.

## Technical notes
- All new tables need `GRANT` + RLS following project conventions.
- Monthly counters use UTC month buckets (matches existing sms count).
- `credits.functions.ts`? Not needed.
- Preserve existing `max_users` semantics; introduce `max_staff` only if user wants staff enforcement separate. Otherwise reuse `max_users` and skip that column.

## Open question
Should `max_staff` reuse existing `max_users` column or be a new column? Existing `enforceLimit("users")` already covers this — I'll reuse `max_users` and just wire it into the staff-add UI to keep schema minimal.
