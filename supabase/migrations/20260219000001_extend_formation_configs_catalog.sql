-- Extend formation_configs to serve as a full training catalog
-- Adds fields for objectives, prerequisites, e-learning config, and WooCommerce integration

ALTER TABLE public.formation_configs
ADD COLUMN IF NOT EXISTS objectives TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS prerequisites TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS supports_url TEXT,
ADD COLUMN IF NOT EXISTS elearning_duration NUMERIC,
ADD COLUMN IF NOT EXISTS elearning_access_email_content TEXT,
ADD COLUMN IF NOT EXISTS supertilt_link TEXT,
ADD COLUMN IF NOT EXISTS woocommerce_product_id INTEGER,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
