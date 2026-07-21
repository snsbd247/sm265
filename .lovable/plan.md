# ইনভয়েস-ভিত্তিক শপ তৈরি ও প্যাকেজ আপগ্রেড (Prorated Billing)

## লক্ষ্য
- নতুন শপ তৈরির সাথে সাথে **Invoice জেনারেট** হবে। পেমেন্ট না হওয়া পর্যন্ত শপ **`pending_payment` (locked)** অবস্থায় থাকবে — লগইন করা যাবে কিন্তু ড্যাশবোর্ডে শুধু "ইনভয়েস পরিশোধ করুন" স্ক্রিন দেখাবে।
- প্যাকেজ পরিবর্তন করলে **আগের প্যাকেজের অব্যবহৃত মূল্য ক্যালকুলেট** করে পার্থক্যের ইনভয়েস তৈরি হবে। ইনভয়েস পরিশোধের আগ পর্যন্ত পুরনো প্যাকেজ সক্রিয় থাকবে; পরিশোধের পর নতুন প্যাকেজ activate হবে।

## অতিরিক্ত সাজেশন (আমার সুপারিশ)
1. **Downgrade rule**: নতুন প্যাকেজ সস্তা হলে টাকা রিফান্ড না দিয়ে **credit balance** হিসেবে জমা রাখুন — পরের রিনিউয়ালে adjust হবে। রিফান্ড না দেওয়াই সাধারণ SaaS practice।
2. **Same-package cycle change** (monthly → yearly): শুধু পার্থক্যের ইনভয়েস (yearly price − remaining monthly value)।
3. **Grace period**: `subscription_end` পার হওয়ার পরে ৩ দিন grace — এর মধ্যে পরিশোধ করলে আগের `end_date` থেকে extend হবে, নাহলে current date থেকে।
4. **Invoice number**: human-readable sequential (`INV-2026-000123`) — শুধু UUID না।
5. **Invoice PDF / print**: এডমিন ও শপ দুই side থেকেই ডাউনলোডযোগ্য (আপনার existing `admin.invoices.en.$subscriptionId.tsx` reuse)।
6. **Auto-lock cron**: `subscription_end + grace` পার হলে auto-expire (already partially exists — এতে integrate)।
7. **Pending upgrade cancel**: শপ owner চাইলে unpaid upgrade invoice cancel করে আগের প্যাকেজেই থাকতে পারবে।
8. **Audit trail**: প্রতিটি package change (who/when/from/to/prorated amount) `subscriptions` টেবিলেই note ফিল্ডে save।

## ডাটা মডেল পরিবর্তন

### `shops` টেবিল
- নতুন status value: **`pending_payment`** (enum-এ যোগ)। অর্থ: অ্যাকাউন্ট আছে কিন্তু initial invoice unpaid।
- নতুন কলাম: `credit_balance NUMERIC DEFAULT 0` — downgrade credit।
- নতুন কলাম: `pending_package_id UUID`, `pending_billing_cycle TEXT` — approved হওয়ার অপেক্ষায় থাকা upgrade।

### `subscription_payments` টেবিল
- নতুন কলাম: `invoice_no TEXT UNIQUE` — human-readable।
- নতুন কলাম: `invoice_type TEXT` — `initial | renewal | upgrade | downgrade`।
- নতুন কলাম: `proration_details JSONB` — { old_pkg, new_pkg, days_used, unused_value, credit_applied, net_amount }।
- নতুন কলাম: `due_date DATE` — invoice payment deadline।

### Sequence
- `CREATE SEQUENCE invoice_seq;` — invoice number জেনারেশনের জন্য।

## Server functions পরিবর্তন

### `createShop` (rewrite)
- `status: 'pending_payment'` set করবে (আগের `'active'` না)।
- `subscription_end` এখনই set করবে **না** — payment approve হলে set হবে।
- সাথে সাথে `subscription_payments` এ pending invoice তৈরি করবে:
  - `invoice_no`: `INV-YYYY-NNNNNN`
  - `invoice_type: 'initial'`
  - `amount`: package monthly/yearly price
  - `due_date`: 7 দিন পরে
- Existing `account_created` SMS-এ invoice_no + amount যোগ।

### `upgradeShopPackage` (rewrite → `requestPackageChange`)
- **Proration logic**:
  ```
  total_days = billing_cycle অনুযায়ী period days (30 বা 365)
  used_days = today − subscription_start
  remaining_days = total_days − used_days
  old_daily = old_amount / total_days
  unused_value = old_daily × remaining_days
  new_amount = new_package price (new cycle)
  net = new_amount − unused_value − shop.credit_balance
  ```
- `net > 0` → **upgrade invoice** তৈরি (`invoice_type: 'upgrade'`), `pending_package_id` + `pending_billing_cycle` set, শপ status **পরিবর্তন হবে না**।
- `net ≤ 0` → **downgrade**: immediate switch, `credit_balance += |net|`, subscription টেবিলে log।

### `approveSubscriptionPayment` (extend)
- `invoice_type` চেক করে:
  - `initial`: `pending_payment → active`, subscription_start = today, end = today + period।
  - `renewal`: existing behavior।
  - `upgrade`: `pending_package_id` → `package_id`, নতুন period শুরু, `pending_*` clear।
- Credit balance ব্যবহার হয়ে থাকলে shop.credit_balance = 0।

### নতুন: `cancelPendingUpgrade`
- Shop owner unpaid upgrade invoice cancel করতে পারবে। `pending_package_id` clear, invoice `status: 'cancelled'`।

## Frontend পরিবর্তন

### Admin: `admin.shops.tsx` (Create dialog)
- Create করার পর success toast-এ invoice_no + amount দেখাবে।
- Shop card-এ `pending_payment` badge (orange)।

### Admin: `admin.shops.$shopId.tsx`
- "প্যাকেজ পরিবর্তন" dialog: নতুন package/cycle select করলে **প্রিভিউ কার্ড** দেখাবে:
  - পুরনো প্যাকেজে কতদিন ব্যবহার হয়েছে
  - অব্যবহৃত মূল্য (unused_value)
  - Credit balance
  - **নেট payable**
- Confirm করলে invoice তৈরি, "পরিশোধের অপেক্ষায়" badge।
- Pending upgrade থাকলে top-এ alert banner + "Cancel Pending" বাটন।

### Shop-side: `app.tsx` layout guard
- `shop.status === 'pending_payment'` হলে সব `/app/*` route redirect → `/app/pay-invoice`।
- নতুন route `app.pay-invoice.tsx`: unpaid initial invoice দেখাবে, bKash pay বাটন (existing `initiateBkashPayment` reuse) + manual TrxID submit।

### Shop-side: `app.subscription.tsx`
- Pending upgrade থাকলে top-এ prominent card: "নতুন প্যাকেজ approve-এর অপেক্ষায় — invoice #XXX, ৳YYY"।
- Pay/Cancel বাটন।

### Invoice view: `admin.invoices.en.$subscriptionId.tsx` extend
- `invoice_type` অনুযায়ী breakdown (Proration table upgrade-এর জন্য)।

## Cron / background
- `api/public/cron/expiry-check.ts`: `pending_payment` invoices যেগুলোর due_date পার — শপ owner-কে reminder SMS পাঠাবে (৩, ৭, ১৪ দিন পর)। ১৪ দিন পার হলে invoice auto-cancel + শপ soft-delete flag।

## Migration ধাপ
1. `shops.status` enum-এ `pending_payment` যোগ, `credit_balance`, `pending_package_id`, `pending_billing_cycle` columns।
2. `subscription_payments`-এ `invoice_no`, `invoice_type`, `proration_details`, `due_date` columns; `invoice_seq` sequence; trigger যা INSERT-এ auto invoice_no set করবে।
3. Existing rows-এর জন্য backfill (`invoice_type = 'renewal'`, invoice_no generate)।

## রোলআউট ক্রম
1. Migration (schema + trigger)।
2. Server functions rewrite (`createShop`, upgrade flow, approve)।
3. Admin UI (create dialog, upgrade preview, pending banner)।
4. Shop UI (pay-invoice route, layout guard, subscription page pending card)।
5. Cron reminder job।
6. Playwright test: create shop → locked → pay → active; upgrade → invoice → old package thakbe → pay → new package active।

---
**অনুমোদন দিলে ১ থেকে ৬ পর্যন্ত পর্যায়ক্রমে ইমপ্লিমেন্ট শুরু করবো।**
