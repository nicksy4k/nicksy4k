ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS claim_date date,
  ADD COLUMN IF NOT EXISTS claim_deadline date,
  ADD COLUMN IF NOT EXISTS claim_reference text;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_delivery_status_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_delivery_status_check
  CHECK (delivery_status IS NULL OR delivery_status IN ('awaiting_dispatch','in_transit','out_for_delivery','delayed_claim','delivered'));