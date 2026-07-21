## সমস্যা

1. এখন একটি শপের জন্য একাধিক subscription row একসাথে `status = 'active'` থাকতে পারে (আপগ্রেড/ডাউনগ্রেড পেমেন্ট approve হওয়ার সময় পুরনোটা `expired` করা হয় না — শুধু নতুন insert হয়)। ছবিতে দেখানো "Standard + Premium দুইটাই active" ঠিক এই কারণেই।
2. পেন্ডিং সাবস্ক্রিপশন ইনভয়েসের বিপরীতে এডমিন নিজে থেকে পেমেন্ট রিসিভ/রেকর্ড করে approve করার কোনো ফ্লো নেই — এখন শুধু দোকানদার bKash TrxID জমা দিলে এডমিন approve করতে পারে।

## সমাধান (২ ভাগ)

### Part A — এক শপে একটাই active subscription

**`src/lib/subscription.server.ts` (`activatePaymentAndExtendShop`)** — নতুন subscription insert বা active update করার ঠিক আগে একই shop-এর অন্য সব active row কে `superseded` করা হবে:

```text
UPDATE subscriptions
  SET status = 'expired', ends_at = now()
WHERE shop_id = :shop_id
  AND status = 'active'
  AND id <> :current_sub_id   -- যদি current থাকে
```

- Renewal (একই package + cycle): existing active row-এর `ends_at` extend হবে (আজকের লজিকই), অন্য কোনো stray active থাকলে সেটা close হয়ে যাবে।
- Upgrade/Downgrade/Initial: পুরনো active row `expired` হবে, তারপর নতুন row insert হবে — ফলে একটাই active থাকবে।

**`src/lib/proration.server.ts` (`applyImmediateDowngrade`)** — একই supersede-then-insert প্যাটার্ন যোগ করা হবে (এখন insert-only)।

**Backfill migration**: প্রতিটা শপের latest active ছাড়া বাকি সব active row কে `expired` মার্ক করে বর্তমান ডাটা পরিষ্কার করা হবে (partial unique index দেওয়া হবে না — race-safety application layer থেকেই আসবে, migration সহজ থাকবে)।

### Part B — এডমিন থেকে সাবস্ক্রিপশন ইনভয়েসে ম্যানুয়াল পেমেন্ট রিসিভ

নতুন server function `recordManualSubscriptionPayment` (admin-only, `src/lib/admin.functions.ts`) যা করবে:

1. একটি pending `subscription_payments` row-কে ইনপুট নেবে: `payment_id`, `method` (cash / bank / bkash-manual), `reference_no` (রসিদ/ট্রানজেকশন নাম্বার), `note`।
2. `payment_method`, `transaction_id`, `raw_response.manual = true`, `raw_response.received_by = <admin email>` সেট করবে।
3. তারপর existing `activatePaymentAndExtendShop(payment_id, { source: 'admin_manual' })` কল করবে — ফলে audit log, SMS, এবং Part A এর supersede লজিক সবই reuse হবে।

**UI — `src/routes/admin.subscriptions.tsx`**: pending row-এ এখন যে `Check` (approve) বাটন আছে, সেটার পাশে "Receive Payment" (💵) বাটন যোগ হবে যা একটি ছোট dialog খুলবে: Method dropdown + Reference no + Note → submit করলে `recordManualSubscriptionPayment` কল হবে।

**UI — `src/routes/admin.shops.$shopId.tsx`** (শপ ডিটেইলস পেজে): pending invoice থাকলে সেখান থেকেও একই dialog দিয়ে receive-payment করা যাবে (একই server fn)।

## Technical notes

- একটাই `activatePaymentAndExtendShop` হেল্পার সব paths (bKash callback, admin approve, admin manual receive) থেকে ব্যবহৃত হবে — supersede লজিক এক জায়গায় থাকলে drift হবে না।
- Existing atomic `paid_at` claim already prevents double-processing — manual receive সেটার সুবিধা পাবে।
- কোনো schema change লাগবে না; শুধু একটা data-cleanup migration (backfill)।

## Files touched

- `src/lib/subscription.server.ts` — supersede লজিক যোগ
- `src/lib/proration.server.ts` — supersede লজিক যোগ
- `src/lib/admin.functions.ts` — `recordManualSubscriptionPayment` server fn
- `src/routes/admin.subscriptions.tsx` — "Receive Payment" dialog
- `src/routes/admin.shops.$shopId.tsx` — pending invoice এ same dialog
- একটি migration — বর্তমান duplicate active rows পরিষ্কার
