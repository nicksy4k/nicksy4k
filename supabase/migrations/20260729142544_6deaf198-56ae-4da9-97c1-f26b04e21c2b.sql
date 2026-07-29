
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'GBP',
  heard_about text,
  accepted_privacy_at timestamptz,
  accepted_beta_disclaimer_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public.profiles (
    id, full_name, display_name, country, currency, heard_about,
    accepted_privacy_at, accepted_beta_disclaimer_at
  ) VALUES (
    NEW.id,
    COALESCE(meta->>'full_name', ''),
    COALESCE(meta->>'display_name', ''),
    COALESCE(meta->>'country', ''),
    COALESCE(NULLIF(meta->>'currency', ''), 'GBP'),
    NULLIF(meta->>'heard_about', ''),
    CASE WHEN meta->>'accepted_privacy_at' IS NOT NULL
      THEN (meta->>'accepted_privacy_at')::timestamptz ELSE NULL END,
    CASE WHEN meta->>'accepted_beta_disclaimer_at' IS NOT NULL
      THEN (meta->>'accepted_beta_disclaimer_at')::timestamptz ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
