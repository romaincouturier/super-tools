-- Game authors (jeux board game creators)
CREATE TABLE public.game_authors (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL,
  email        TEXT,
  phone        TEXT,
  company      TEXT,
  royalty_rate NUMERIC(5,4) NOT NULL DEFAULT 0.10
                           CHECK (royalty_rate BETWEEN 0 AND 1),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Games catalog
CREATE TABLE public.games (
  id                     UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id              UUID    REFERENCES public.game_authors(id) ON DELETE SET NULL,
  title                  TEXT    NOT NULL,
  description            TEXT,
  woocommerce_product_id INTEGER UNIQUE,
  cover_url              TEXT,
  status                 TEXT    NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'inactive')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales imported from WooCommerce
CREATE TABLE public.game_sales (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id              UUID        REFERENCES public.games(id) ON DELETE SET NULL,
  woocommerce_order_id TEXT        NOT NULL UNIQUE,
  customer_name        TEXT,
  customer_email       TEXT,
  quantity             INTEGER     NOT NULL DEFAULT 1,
  unit_price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  royalty_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  sale_date            TIMESTAMPTZ NOT NULL,
  status               TEXT        NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'paid')),
  raw_order            JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.game_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sales   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage game_authors"
  ON public.game_authors FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated can manage games"
  ON public.games FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated can manage game_sales"
  ON public.game_sales FOR ALL TO authenticated USING (true);

-- Triggers
CREATE TRIGGER game_authors_updated_at
  BEFORE UPDATE ON public.game_authors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
