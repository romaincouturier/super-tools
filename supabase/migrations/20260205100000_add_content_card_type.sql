-- Add card_type to content_cards for distinguishing articles vs social media posts
CREATE TYPE content_card_type AS ENUM ('article', 'post');

ALTER TABLE content_cards
  ADD COLUMN card_type content_card_type NOT NULL DEFAULT 'article';
