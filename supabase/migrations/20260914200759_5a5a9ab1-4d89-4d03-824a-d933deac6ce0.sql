DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['commitments','debts','transactions','savings','loans'] LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t)
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
       ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;