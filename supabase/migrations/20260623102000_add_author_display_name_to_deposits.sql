-- Urgent — Ne jamais exposer l'adresse e-mail d'un apprenant sur ses travaux partages.
-- Les apprenants ne peuvent pas lire le profil des autres (RLS), on denormalise donc
-- un nom d'affichage au moment du depot (comme practice_post_comments.author_display_name).
ALTER TABLE public.lms_work_deposits
  ADD COLUMN IF NOT EXISTS author_display_name text;
