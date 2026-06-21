
ALTER TABLE public.transactions
  ADD COLUMN protection_type text,
  ADD COLUMN protection_duration text,
  ADD COLUMN expiration_date date,
  ADD COLUMN dismissed_at timestamptz;

CREATE INDEX IF NOT EXISTS transactions_user_expiration_idx
  ON public.transactions (user_id, expiration_date)
  WHERE expiration_date IS NOT NULL AND dismissed_at IS NULL;

-- Strip the deprecated per-item return_window_expiry from items JSON
UPDATE public.transactions
SET items = (
  SELECT jsonb_agg(elem - 'return_window_expiry')
  FROM jsonb_array_elements(items) elem
)
WHERE items IS NOT NULL
  AND jsonb_typeof(items) = 'array'
  AND items::text LIKE '%return_window_expiry%';
