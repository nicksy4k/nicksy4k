-- Shareable read-only loan statement links.
CREATE TABLE IF NOT EXISTS public.loan_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  note text,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Data API access. No anon grant: the public page reads through a
-- server-side privileged client after validating the token.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_shares TO authenticated;
GRANT ALL ON public.loan_shares TO service_role;

ALTER TABLE public.loan_shares ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS loan_shares_loan_id_idx ON public.loan_shares (loan_id);
CREATE INDEX IF NOT EXISTS loan_shares_user_id_idx ON public.loan_shares (user_id);

CREATE POLICY "Users can view their own loan shares"
  ON public.loan_shares FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own loan shares"
  ON public.loan_shares FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own loan shares"
  ON public.loan_shares FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own loan shares"
  ON public.loan_shares FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
