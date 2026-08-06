ALTER TABLE public.commitments
  ADD COLUMN IF NOT EXISTS is_subscription boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cadence text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS promo_price numeric,
  ADD COLUMN IF NOT EXISTS promo_ends_on date,
  ADD COLUMN IF NOT EXISTS standard_price numeric,
  ADD COLUMN IF NOT EXISTS promo_alert_snoozed_until timestamptz;