CREATE TABLE public.app_announcements (
  id integer PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT false,
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  variant text NOT NULL DEFAULT 'info',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_announcements_singleton CHECK (id = 1),
  CONSTRAINT app_announcements_variant_chk CHECK (variant IN ('info','warning','critical'))
);

GRANT SELECT ON public.app_announcements TO anon;
GRANT SELECT, UPDATE ON public.app_announcements TO authenticated;
GRANT ALL ON public.app_announcements TO service_role;

ALTER TABLE public.app_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_announcements_select_all ON public.app_announcements
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY app_announcements_update_admin ON public.app_announcements
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER app_announcements_updated_at
  BEFORE UPDATE ON public.app_announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_announcements (id, enabled, title, message, variant)
VALUES (1, false, 'Email issues',
  'We''re currently having problems with our email system. If you need to get in touch, please use the Feedback button in the top right of the app instead of emailing us.',
  'warning');