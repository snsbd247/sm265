-- Supersede older active subscriptions per shop, keep only the latest one active
WITH ranked AS (
  SELECT id, shop_id,
    ROW_NUMBER() OVER (PARTITION BY shop_id ORDER BY starts_at DESC, created_at DESC) AS rn
  FROM public.subscriptions
  WHERE status = 'active'
)
UPDATE public.subscriptions s
SET status = 'expired', ends_at = LEAST(ends_at, now())
FROM ranked r
WHERE s.id = r.id AND r.rn > 1;