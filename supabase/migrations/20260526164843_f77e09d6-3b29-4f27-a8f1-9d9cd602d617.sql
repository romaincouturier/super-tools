ALTER TABLE public.practice_post_comments DROP CONSTRAINT IF EXISTS practice_post_comments_post_id_fkey;
ALTER TABLE public.practice_post_comments ADD CONSTRAINT practice_post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.practice_posts(id) ON DELETE CASCADE;
ALTER TABLE public.practice_post_reactions DROP CONSTRAINT IF EXISTS practice_post_reactions_post_id_fkey;
ALTER TABLE public.practice_post_reactions ADD CONSTRAINT practice_post_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.practice_posts(id) ON DELETE CASCADE;