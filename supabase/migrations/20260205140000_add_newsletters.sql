-- Newsletters table
CREATE TABLE newsletters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Junction table: newsletter <-> content_cards
CREATE TABLE newsletter_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id uuid NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES content_cards(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(newsletter_id, card_id)
);

-- Indexes
CREATE INDEX idx_newsletter_cards_newsletter ON newsletter_cards(newsletter_id);
CREATE INDEX idx_newsletter_cards_card ON newsletter_cards(card_id);
CREATE INDEX idx_newsletters_status ON newsletters(status);
CREATE INDEX idx_newsletters_scheduled_date ON newsletters(scheduled_date);

-- RLS
ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage newsletters"
  ON newsletters FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage newsletter_cards"
  ON newsletter_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);
