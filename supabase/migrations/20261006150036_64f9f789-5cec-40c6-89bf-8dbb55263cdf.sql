UPDATE public.practice_posts p
SET is_staff_treated = true
WHERE p.deposit_id IS NOT NULL
  AND p.is_staff_treated = false
  AND EXISTS (
    SELECT 1 FROM public.practice_post_reactions r
    JOIN public.profiles pr ON lower(pr.email) = lower(r.author_email)
    WHERE r.post_id = p.id
  );