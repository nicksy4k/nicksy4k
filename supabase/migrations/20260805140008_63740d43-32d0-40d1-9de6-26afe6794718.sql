
GRANT SELECT ON public.feedback TO authenticated;
GRANT INSERT ON public.feedback TO authenticated, anon;
GRANT ALL ON public.feedback TO service_role;
