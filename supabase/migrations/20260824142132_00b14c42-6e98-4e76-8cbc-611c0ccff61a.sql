CREATE TABLE public.alert_snoozes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_key text NOT NULL,
  snoozed_until timestamp with time zone,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, alert_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_snoozes TO authenticated;
GRANT ALL ON public.alert_snoozes TO service_role;

ALTER TABLE public.alert_snoozes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alert_snoozes_select_own" ON public.alert_snoozes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "alert_snoozes_insert_own" ON public.alert_snoozes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alert_snoozes_update_own" ON public.alert_snoozes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alert_snoozes_delete_own" ON public.alert_snoozes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_alert_snoozes_updated_at
  BEFORE UPDATE ON public.alert_snoozes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();