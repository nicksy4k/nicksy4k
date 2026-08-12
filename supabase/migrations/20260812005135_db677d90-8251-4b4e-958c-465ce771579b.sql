ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS courier text,
  ADD COLUMN IF NOT EXISTS tracking_number text;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_delivery_status_check
  CHECK (delivery_status IS NULL OR delivery_status IN ('awaiting_dispatch','in_transit','delivered'));