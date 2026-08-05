
DROP POLICY IF EXISTS debts_update_own ON public.debts;
CREATE POLICY debts_update_own ON public.debts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS feedback_select_admin ON public.feedback;
CREATE POLICY feedback_select_admin ON public.feedback FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS feedback_attach_select_own ON storage.objects;
CREATE POLICY feedback_attach_select_own ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-attachments'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS feedback_attach_delete_own ON storage.objects;
CREATE POLICY feedback_attach_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'feedback-attachments'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );
