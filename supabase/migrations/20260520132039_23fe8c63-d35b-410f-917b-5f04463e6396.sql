DROP INDEX IF EXISTS public.idx_order_items_unique_order_product;

CREATE UNIQUE INDEX idx_order_items_unique_order_product
ON public.order_items (woocommerce_order_id, wc_product_id);

COMMENT ON INDEX public.idx_order_items_unique_order_product IS
'Guarantees one visible order_items row per WooCommerce order and product so webhook routing upserts cannot silently fail.';