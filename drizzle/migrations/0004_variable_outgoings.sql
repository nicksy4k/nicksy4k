ALTER TABLE public.commitments ADD COLUMN IF NOT EXISTS variable_amount boolean NOT NULL DEFAULT false;
