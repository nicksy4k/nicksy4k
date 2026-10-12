CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'revolut',
  file_name text,
  transaction_count integer NOT NULL DEFAULT 0,
  income_count integer NOT NULL DEFAULT 0,
  total_out numeric NOT NULL DEFAULT 0,
  total_in numeric NOT NULL DEFAULT 0,
  undone_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own import batches select" ON public.import_batches FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own import batches insert" ON public.import_batches FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own import batches update" ON public.import_batches FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own import batches delete" ON public.import_batches FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.transactions ADD COLUMN import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL;
ALTER TABLE public.incomes ADD COLUMN import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL;
CREATE INDEX idx_transactions_import_batch ON public.transactions(import_batch_id);
CREATE INDEX idx_incomes_import_batch ON public.incomes(import_batch_id);