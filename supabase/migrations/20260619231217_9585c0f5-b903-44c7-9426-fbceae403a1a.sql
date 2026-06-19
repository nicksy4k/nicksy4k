ALTER TABLE public.commitments ADD COLUMN IF NOT EXISTS debt_id uuid REFERENCES public.debts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS commitments_debt_id_idx ON public.commitments(debt_id);