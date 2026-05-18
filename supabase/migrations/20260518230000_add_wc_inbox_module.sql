-- Add 'wc_inbox' to app_module enum for WooCommerce inbox access control
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'wc_inbox';
