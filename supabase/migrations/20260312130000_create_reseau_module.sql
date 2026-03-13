-- Module Réseau v0.1: tables for network contacts, positioning, and AI conversations

-- Network contacts
CREATE TABLE IF NOT EXISTS network_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  context TEXT,
  warmth TEXT NOT NULL DEFAULT 'warm' CHECK (warmth IN ('hot', 'warm', 'cold')),
  linkedin_url TEXT,
  last_contact_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_network_contacts_user ON network_contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_network_contacts_warmth ON network_contacts (user_id, warmth);

ALTER TABLE network_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'network_contacts' AND policyname = 'Users can manage own contacts') THEN
    CREATE POLICY "Users can manage own contacts"
      ON network_contacts FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Network actions (prepared for v0.2)
CREATE TABLE IF NOT EXISTS network_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES network_contacts(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  message_draft TEXT,
  scheduled_week DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'skipped')),
  result TEXT,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_network_actions_user ON network_actions (user_id);
CREATE INDEX IF NOT EXISTS idx_network_actions_contact ON network_actions (contact_id);

ALTER TABLE network_actions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'network_actions' AND policyname = 'Users can manage own actions') THEN
    CREATE POLICY "Users can manage own actions"
      ON network_actions FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- User positioning (pitch, skills, target client)
CREATE TABLE IF NOT EXISTS user_positioning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pitch_one_liner TEXT,
  key_skills TEXT[] DEFAULT '{}',
  target_client TEXT,
  onboarding_completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_positioning_user ON user_positioning (user_id);

ALTER TABLE user_positioning ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_positioning' AND policyname = 'Users can manage own positioning') THEN
    CREATE POLICY "Users can manage own positioning"
      ON user_positioning FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Network conversation history (onboarding + cartography phases)
CREATE TABLE IF NOT EXISTS network_conversation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('onboarding', 'cartography')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_network_conversation_user_phase ON network_conversation (user_id, phase, created_at);

ALTER TABLE network_conversation ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'network_conversation' AND policyname = 'Users can manage own conversations') THEN
    CREATE POLICY "Users can manage own conversations"
      ON network_conversation FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
