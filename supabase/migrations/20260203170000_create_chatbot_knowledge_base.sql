-- Chatbot Knowledge Base table
CREATE TABLE IF NOT EXISTS chatbot_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for full-text search
CREATE INDEX idx_knowledge_base_search ON chatbot_knowledge_base
USING GIN (to_tsvector('french', title || ' ' || content));

-- Index for category filtering
CREATE INDEX idx_knowledge_base_category ON chatbot_knowledge_base(category);

-- Index for keywords
CREATE INDEX idx_knowledge_base_keywords ON chatbot_knowledge_base USING GIN(keywords);

-- Chatbot conversations history (optional, for analytics)
CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources UUID[] DEFAULT '{}',
  feedback TEXT CHECK (feedback IN ('helpful', 'not_helpful')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for user conversations
CREATE INDEX idx_chatbot_conversations_user ON chatbot_conversations(user_id);

-- Enable RLS
ALTER TABLE chatbot_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_conversations ENABLE ROW LEVEL SECURITY;

-- Policies for knowledge base (read by all authenticated, write by admins)
CREATE POLICY "Knowledge base readable by authenticated users"
  ON chatbot_knowledge_base FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Knowledge base manageable by admins"
  ON chatbot_knowledge_base FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid() AND email = 'romain@supertilt.fr'
    )
  );

-- Policies for conversations
CREATE POLICY "Users can view their own conversations"
  ON chatbot_conversations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can create conversations"
  ON chatbot_conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update feedback on their conversations"
  ON chatbot_conversations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON chatbot_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
