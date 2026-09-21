CREATE OR REPLACE FUNCTION public.decay_watch_relevance()
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.watch_items
  SET relevance_score = GREATEST(
        0,
        100 - (EXTRACT(EPOCH FROM (now() - updated_at)) / 86400.0) * 0.5
      );
$$;

REVOKE ALL ON FUNCTION public.decay_watch_relevance() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decay_watch_relevance() FROM anon;
REVOKE ALL ON FUNCTION public.decay_watch_relevance() FROM authenticated;

SELECT cron.unschedule('decay-watch-relevance')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'decay-watch-relevance');

SELECT cron.schedule(
  'decay-watch-relevance',
  '40 3 * * *',
  $$SELECT public.decay_watch_relevance();$$
);