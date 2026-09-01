-- Persist one-off repayment instructions created while topping up a loan.
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS repayment_adjustments jsonb NOT NULL DEFAULT '[]'::jsonb;
