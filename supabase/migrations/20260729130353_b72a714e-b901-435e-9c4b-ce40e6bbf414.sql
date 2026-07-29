
-- Feedback table for beta testers
CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  type TEXT NOT NULL CHECK (type IN ('bug','idea','general')),
  severity TEXT CHECK (severity IN ('low','medium','high')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  email TEXT,
  app_version TEXT,
  route TEXT,
  user_agent TEXT,
  attachment_path TEXT,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT INSERT ON public.feedback TO authenticated, anon;
GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Signed-in users can insert their own feedback
CREATE POLICY "feedback_insert_authenticated"
ON public.feedback FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Anonymous users (e.g., login page) can submit with no user_id but must include an email
CREATE POLICY "feedback_insert_anon"
ON public.feedback FOR INSERT TO anon
WITH CHECK (user_id IS NULL AND email IS NOT NULL AND length(email) > 3);

-- No SELECT policy: only service_role can read submissions (via GRANT ALL above).

-- Storage policies for the private feedback-attachments bucket
CREATE POLICY "feedback_attach_insert_auth"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'feedback-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "feedback_attach_insert_anon"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'feedback-attachments'
  AND (storage.foldername(name))[1] = 'anon'
);
