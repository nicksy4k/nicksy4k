CREATE TABLE public.debt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id uuid NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  item_name text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX debt_items_debt_id_idx ON public.debt_items(debt_id);
CREATE INDEX debt_items_user_id_idx ON public.debt_items(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_items TO authenticated;
GRANT ALL ON public.debt_items TO service_role;

ALTER TABLE public.debt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select their own debt items" ON public.debt_items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own debt items" ON public.debt_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own debt items" ON public.debt_items
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own debt items" ON public.debt_items
  FOR DELETE TO authenticated USING (auth.uid() = user_id);