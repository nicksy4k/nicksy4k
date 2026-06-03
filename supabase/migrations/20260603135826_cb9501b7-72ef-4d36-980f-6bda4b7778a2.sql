
-- Transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  retailer text NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  receipt_attached boolean NOT NULL DEFAULT false,
  receipt_type text NOT NULL DEFAULT 'None',
  receipt_location text NOT NULL DEFAULT '',
  notes text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx_select_own" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tx_insert_own" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tx_update_own" ON public.transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tx_delete_own" ON public.transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Incomes
CREATE TABLE public.incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  source text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'Other',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incomes TO authenticated;
GRANT ALL ON public.incomes TO service_role;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inc_select_own" ON public.incomes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "inc_insert_own" ON public.incomes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inc_update_own" ON public.incomes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "inc_delete_own" ON public.incomes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Savings
CREATE TABLE public.savings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('deposit','withdrawal')),
  amount numeric NOT NULL DEFAULT 0,
  account text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings TO authenticated;
GRANT ALL ON public.savings TO service_role;
ALTER TABLE public.savings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sav_select_own" ON public.savings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sav_insert_own" ON public.savings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sav_update_own" ON public.savings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sav_delete_own" ON public.savings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Commitments
CREATE TABLE public.commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  store text NOT NULL DEFAULT '',
  payment_method text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  last_paid_date date,
  next_due_date date,
  notes text,
  paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commitments TO authenticated;
GRANT ALL ON public.commitments TO service_role;
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "com_select_own" ON public.commitments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "com_insert_own" ON public.commitments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "com_update_own" ON public.commitments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "com_delete_own" ON public.commitments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Categories (expense + income)
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('expense','income')),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_select_own" ON public.categories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cat_insert_own" ON public.categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cat_update_own" ON public.categories FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cat_delete_own" ON public.categories FOR DELETE TO authenticated USING (auth.uid() = user_id);
