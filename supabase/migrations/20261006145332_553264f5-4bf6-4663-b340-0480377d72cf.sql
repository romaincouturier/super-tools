-- Shared work deposits are mirrored as community posts (practice_posts.deposit_id).
-- Copy the comments/likes stored on the deposit side onto the community post so
-- every screen reads one single thread. Originals are kept untouched.
INSERT INTO public.practice_post_comments (post_id, author_email, content, created_at, updated_at, is_staff_reply, author_display_name)
SELECT p.id,
       lower(c.author_email),
       c.content,
       c.created_at,
       c.updated_at,
       pr.user_id IS NOT NULL,
       CASE WHEN pr.user_id IS NOT NULL THEN NULLIF(trim(concat_ws(' ', pr.first_name, pr.last_name)), '') END
FROM public.lms_deposit_comments c
JOIN public.practice_posts p ON p.deposit_id = c.deposit_id
LEFT JOIN public.profiles pr ON lower(pr.email) = lower(c.author_email)
WHERE c.status = 'published'
  AND NOT EXISTS (
    SELECT 1 FROM public.practice_post_comments x
    WHERE x.post_id = p.id AND lower(x.author_email) = lower(c.author_email) AND x.content = c.content
  );

INSERT INTO public.practice_post_reactions (post_id, author_email, reaction_type, created_at)
SELECT p.id, lower(r.author_email), '👍', r.created_at
FROM public.lms_deposit_reactions r
JOIN public.practice_posts p ON p.deposit_id = r.deposit_id
ON CONFLICT (post_id, author_email, reaction_type) DO NOTHING;

UPDATE public.practice_posts p
SET is_staff_treated = true
WHERE p.deposit_id IS NOT NULL
  AND p.is_staff_treated = false
  AND EXISTS (SELECT 1 FROM public.practice_post_comments x WHERE x.post_id = p.id AND x.is_staff_reply);