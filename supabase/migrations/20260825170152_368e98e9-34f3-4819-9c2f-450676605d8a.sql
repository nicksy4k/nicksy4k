CREATE TABLE public.demo_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  referrer text,
  landing_path text,
  user_agent text,
  device_type text,
  platform text,
  language text,
  timezone text,
  screen text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.demo_sessions TO authenticated;
GRANT ALL ON public.demo_sessions TO service_role;

ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view demo sessions"
  ON public.demo_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX demo_sessions_started_at_idx ON public.demo_sessions (started_at DESC);