-- group_matching_configs: un par post, créé quand le staff active la mise en relation
CREATE TABLE public.group_matching_configs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID        NOT NULL UNIQUE REFERENCES public.practice_posts(id) ON DELETE CASCADE,
  group_size  INTEGER     NOT NULL DEFAULT 2 CHECK (group_size >= 2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- group_matching_registrations: une inscription par apprenant par post
CREATE TABLE public.group_matching_registrations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID        NOT NULL REFERENCES public.practice_posts(id) ON DELETE CASCADE,
  learner_email TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, learner_email)
);

-- group_matching_groups: un groupe par vague
CREATE TABLE public.group_matching_groups (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID        NOT NULL REFERENCES public.practice_posts(id) ON DELETE CASCADE,
  wave          INTEGER     NOT NULL DEFAULT 1,
  email_sent_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- group_matching_members: membres d'un groupe
CREATE TABLE public.group_matching_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID        NOT NULL REFERENCES public.group_matching_groups(id) ON DELETE CASCADE,
  registration_id UUID        NOT NULL UNIQUE REFERENCES public.group_matching_registrations(id),
  learner_email   TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.group_matching_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_matching_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_matching_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_matching_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage group matching configs"
  ON public.group_matching_configs FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage group matching registrations"
  ON public.group_matching_registrations FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage group matching groups"
  ON public.group_matching_groups FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage group matching members"
  ON public.group_matching_members FOR ALL TO authenticated USING (true);
