ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS import_reminder_mode text NOT NULL DEFAULT 'cycle',
  ADD COLUMN IF NOT EXISTS import_reminder_days integer NOT NULL DEFAULT 2;