-- FAQ items for the learner help page
create table if not exists faq_items (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table faq_items enable row level security;

-- Admins (authenticated users) can manage FAQ items
create policy "authenticated_full_access" on faq_items
  for all to authenticated using (true) with check (true);

-- Learners read active FAQ items via the learner portal function (no direct RLS needed)
-- The learner_portal_data function already has security definer

-- Add learner_category to support_tickets for learner-submitted requests
alter table support_tickets
  add column if not exists learner_category text;

-- Seed a few default FAQ items
insert into faq_items (question, answer, position) values
  ('Je n''arrive pas à accéder à ma formation', 'Vérifiez que vous utilisez bien l''adresse e-mail avec laquelle vous vous êtes inscrit à SuperTilt. Si le problème persiste, contactez-nous : nous serons ravis de vous aider.', 0),
  ('Je n''ai pas reçu le lien de connexion', 'Pensez à vérifier vos spams ou courriers indésirables. Si vous ne trouvez toujours pas l''e-mail, contactez-nous et nous vous le renverrons.', 1),
  ('Je veux modifier mon adresse e-mail', 'Rendez-vous dans Mon compte (en haut à droite) pour modifier vos informations personnelles. Si vous avez besoin d''aide, envoyez-nous une demande.', 2),
  ('Je ne sais pas où déposer mon travail', 'Dans l''espace "Mes travaux", vous trouverez toutes les sessions de dépôt ouvertes pour vos formations en cours.', 3),
  ('Je veux partager ou repasser un travail en privé', 'Depuis "Mes travaux", cliquez sur le travail concerné et utilisez le menu de visibilité pour le passer en mode privé.', 4),
  ('Je ne trouve pas le lien du live', 'Le lien du live est disponible dans votre formation, dans la section du module correspondant. Si vous ne le trouvez pas, envoyez-nous une demande.', 5),
  ('Je rencontre un problème avec une vidéo', 'Essayez de rafraîchir la page ou de vider le cache de votre navigateur. Si le problème persiste, précisez le nom de la vidéo dans votre demande de support.', 6)
on conflict do nothing;
