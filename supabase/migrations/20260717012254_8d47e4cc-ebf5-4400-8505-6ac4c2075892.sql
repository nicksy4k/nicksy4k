ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS carryover_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_carryover_cycle_key text;