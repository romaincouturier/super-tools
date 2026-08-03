UPDATE public.tender_opportunities
SET status = 'expired', updated_at = now()
WHERE status IN ('raw', 'to_review', 'shortlisted')
  AND datelimitereponse IS NOT NULL
  AND datelimitereponse < now();