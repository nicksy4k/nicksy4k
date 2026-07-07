CREATE TABLE public.recurring_incomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'Other',
  notes TEXT,
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly','fortnightly','four-weekly','monthly')),
  next_date DATE NOT NULL,
  last_generated_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_incomes TO authenticated;
GRANT ALL ON public.recurring_incomes TO service_role;

ALTER TABLE public.recurring_incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rinc_select_own" ON public.recurring_incomes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rinc_insert_own" ON public.recurring_incomes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rinc_update_own" ON public.recurring_incomes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rinc_delete_own" ON public.recurring_incomes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_recurring_incomes_updated_at
  BEFORE UPDATE ON public.recurring_incomes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX recurring_incomes_user_id_idx ON public.recurring_incomes(user_id);
CREATE INDEX recurring_incomes_next_date_idx ON public.recurring_incomes(next_date) WHERE active = true;