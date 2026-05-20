
-- 1) Backfill
UPDATE public.order_items oi
SET validation_status = 'validated',
    kanban_status = 'received',
    block_reason = COALESCE(oi.block_reason, '') || ' — Auto-validée : participant déjà inscrit'
FROM public.woocommerce_orders wo,
     public.formation_formulas ff,
     public.trainings t,
     public.training_participants tp
WHERE oi.woocommerce_order_id = wo.id
  AND oi.validation_status = 'pending'
  AND oi.game_type = 'formation'
  AND ff.woocommerce_product_id = oi.wc_product_id
  AND t.catalog_id = ff.formation_config_id
  AND tp.training_id = t.id
  AND lower(tp.email) = lower(wo.customer_email);

-- 2) Trigger function
CREATE OR REPLACE FUNCTION public.auto_validate_woocommerce_formation_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR NEW.training_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.order_items oi
  SET validation_status = 'validated',
      kanban_status = 'received',
      block_reason = COALESCE(oi.block_reason, '') || ' — Auto-validée : participant inscrit'
  FROM public.woocommerce_orders wo,
       public.trainings t,
       public.formation_formulas ff
  WHERE oi.woocommerce_order_id = wo.id
    AND lower(wo.customer_email) = lower(NEW.email)
    AND oi.game_type = 'formation'
    AND oi.validation_status = 'pending'
    AND t.id = NEW.training_id
    AND ff.formation_config_id = t.catalog_id
    AND ff.woocommerce_product_id = oi.wc_product_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_validate_wc_formation ON public.training_participants;
CREATE TRIGGER trg_auto_validate_wc_formation
AFTER INSERT ON public.training_participants
FOR EACH ROW
EXECUTE FUNCTION public.auto_validate_woocommerce_formation_items();
