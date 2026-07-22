ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS hidden_retailers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hidden_items text[] NOT NULL DEFAULT '{}';