CREATE TABLE public.app_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.app_flags TO authenticated;
GRANT ALL ON public.app_flags TO service_role;

ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_flags_select_authenticated" ON public.app_flags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "app_flags_insert_admin" ON public.app_flags
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "app_flags_update_admin" ON public.app_flags
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER app_flags_updated_at BEFORE UPDATE ON public.app_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_flags (key, enabled) VALUES ('demo_ai_scanner_enabled', false)
  ON CONFLICT (key) DO NOTHING;