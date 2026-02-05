-- Remove author-only restrictions on review_comments UPDATE and DELETE
-- Allow any user with contenu module access to update/delete any comment

DROP POLICY IF EXISTS "Users with contenu access can update own comments" ON public.review_comments;
DROP POLICY IF EXISTS "Users with contenu access can delete own comments" ON public.review_comments;

CREATE POLICY "Users with contenu access can update comments"
  ON public.review_comments FOR UPDATE
  USING (public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users with contenu access can delete comments"
  ON public.review_comments FOR DELETE
  USING (public.has_module_access(auth.uid(), 'contenu'));
