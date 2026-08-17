ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS plan_amount numeric,
  ADD COLUMN IF NOT EXISTS plan_cadence text,
  ADD COLUMN IF NOT EXISTS plan_start_date date,
  ADD COLUMN IF NOT EXISTS plan_next_due date;

ALTER TABLE public.loans
  DROP CONSTRAINT IF EXISTS loans_plan_cadence_check;
ALTER TABLE public.loans
  ADD CONSTRAINT loans_plan_cadence_check
  CHECK (plan_cadence IS NULL OR plan_cadence IN ('weekly','fortnightly','four_weekly','monthly'));