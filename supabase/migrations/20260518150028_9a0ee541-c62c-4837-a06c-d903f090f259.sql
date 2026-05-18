-- Fix typo in WooCommerce product ID for Communauté formula (was 1668616686, should be 16686)
UPDATE public.formation_formulas
SET woocommerce_product_id = 16686
WHERE id = '50df798b-6897-43cc-8edc-b7e4abf0683e'
  AND woocommerce_product_id = 1668616686;

-- Remove the stuck inbox item so the webhook can re-route the order
DELETE FROM public.order_items
WHERE wc_order_id = 115873 AND wc_product_id = 16686 AND kanban_status = 'to_validate';
