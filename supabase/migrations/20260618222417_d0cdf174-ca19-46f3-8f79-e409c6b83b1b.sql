
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS installment_dates jsonb NOT NULL DEFAULT '[]'::jsonb;
