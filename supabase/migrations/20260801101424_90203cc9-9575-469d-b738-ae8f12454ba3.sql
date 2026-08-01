ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS currency_symbol text,
  ADD COLUMN IF NOT EXISTS symbol_position text NOT NULL DEFAULT 'before',
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'midnight';

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS joy_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS blur_amounts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_category_chart boolean NOT NULL DEFAULT false;