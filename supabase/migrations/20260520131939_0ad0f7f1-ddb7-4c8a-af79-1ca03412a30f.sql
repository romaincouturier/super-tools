CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_unique_order_product
ON public.order_items (woocommerce_order_id, wc_product_id)
WHERE woocommerce_order_id IS NOT NULL;

COMMENT ON INDEX public.idx_order_items_unique_order_product IS
'Guarantees one visible order_items row per WooCommerce order and product so webhook routing upserts cannot silently fail.';