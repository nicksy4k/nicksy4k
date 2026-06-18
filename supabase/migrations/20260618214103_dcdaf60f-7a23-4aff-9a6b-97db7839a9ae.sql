
ALTER TABLE public.commitments ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Subscriptions';

CREATE TABLE public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  person_name text NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  payments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY loans_select_own ON public.loans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY loans_insert_own ON public.loans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY loans_update_own ON public.loans FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY loans_delete_own ON public.loans FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'standard',
  total_amount numeric NOT NULL DEFAULT 0,
  installments_total integer,
  notes text,
  payments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts TO authenticated;
GRANT ALL ON public.debts TO service_role;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY debts_select_own ON public.debts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY debts_insert_own ON public.debts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY debts_update_own ON public.debts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY debts_delete_own ON public.debts FOR DELETE TO authenticated USING (auth.uid() = user_id);
