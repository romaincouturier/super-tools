-- Ajout du type d'emoji sur les réactions aux posts de la communauté.
-- Les réactions existantes reçoivent le type par défaut '👍'.

ALTER TABLE public.practice_post_reactions
  ADD COLUMN IF NOT EXISTS reaction_type text NOT NULL DEFAULT '👍';

-- Remplacement de la contrainte unique (post_id, author_email) par
-- (post_id, author_email, reaction_type) pour permettre plusieurs
-- types de réaction par utilisateur par post.
ALTER TABLE public.practice_post_reactions
  DROP CONSTRAINT IF EXISTS practice_post_reactions_post_id_author_email_key;

ALTER TABLE public.practice_post_reactions
  ADD CONSTRAINT practice_post_reactions_post_id_author_email_type_key
  UNIQUE (post_id, author_email, reaction_type);
