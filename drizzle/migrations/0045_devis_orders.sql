ALTER TABLE public.woocommerce_orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'woocommerce',
  ADD COLUMN IF NOT EXISTS devis_activity_log_id uuid,
  ADD COLUMN IF NOT EXISTS crm_card_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

ALTER TABLE public.woocommerce_orders
  ADD CONSTRAINT woocommerce_orders_source_check CHECK (source IN ('woocommerce','devis'));
ALTER TABLE public.woocommerce_orders
  ADD CONSTRAINT woocommerce_orders_devis_negative_id CHECK (source <> 'devis' OR wc_order_id < 0);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_devis_order_per_card
  ON public.woocommerce_orders(crm_card_id)
  WHERE source = 'devis' AND cancelled_at IS NULL;

CREATE SEQUENCE IF NOT EXISTS public.devis_order_wc_id_seq START 1;

CREATE TABLE IF NOT EXISTS public.devis_order_counters (
  year integer PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.devis_order_counters TO service_role;
ALTER TABLE public.devis_order_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_devis_order(p_order jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card uuid := (p_order->>'crm_card_id')::uuid;
  v_existing record;
  v_year int := extract(year from (now() AT TIME ZONE 'Europe/Paris'))::int;
  v_num int;
  v_wc int;
  v_number text;
  v_id uuid;
  v_item jsonb;
  v_idx int := 0;
BEGIN
  IF v_card IS NULL THEN RAISE EXCEPTION 'crm_card_id requis'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('devis_order:' || v_card::text));
  SELECT id, order_number INTO v_existing FROM woocommerce_orders
   WHERE crm_card_id = v_card AND source = 'devis' AND cancelled_at IS NULL LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('id', v_existing.id, 'order_number', v_existing.order_number, 'existing', true);
  END IF;

  INSERT INTO devis_order_counters(year, last_value) VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = devis_order_counters.last_value + 1
  RETURNING last_value INTO v_num;
  v_number := 'DV-' || v_year || '-' || lpad(v_num::text, 4, '0');
  v_wc := -nextval('devis_order_wc_id_seq')::int;

  INSERT INTO woocommerce_orders(wc_order_id, order_number, wc_status, date_created,
    customer_first_name, customer_last_name, customer_email, billing_address, shipping_address,
    total_ttc, total_ht, total_tax, shipping_total, payment_method, payment_method_title,
    line_items, raw_order, processed_at, source, devis_activity_log_id, crm_card_id, created_by)
  VALUES (v_wc, v_number, 'processing', now(),
    p_order->>'customer_first_name', p_order->>'customer_last_name', p_order->>'customer_email',
    p_order->'billing_address', p_order->'shipping_address',
    (p_order->>'total_ttc')::numeric, (p_order->>'total_ht')::numeric, (p_order->>'total_tax')::numeric,
    (p_order->>'shipping_total')::numeric, 'devis', 'Facturation directe (devis)',
    p_items, p_order || jsonb_build_object('order_number', v_number, 'source', 'devis'), now(), 'devis',
    nullif(p_order->>'devis_activity_log_id','')::uuid, v_card, nullif(p_order->>'created_by','')::uuid)
  RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_idx := v_idx + 1;
    INSERT INTO order_items(woocommerce_order_id, wc_order_id, wc_product_id, wc_variation_id, product_name,
      game_id, game_type, quantity, unit_price, line_total, kanban_status, validation_status, raw_line_item, block_reason)
    VALUES (v_id, v_wc, COALESCE((v_item->>'wc_product_id')::int, -v_idx), nullif(v_item->>'wc_variation_id','')::int,
      v_item->>'product_name', (v_item->>'game_id')::uuid, v_item->>'game_type',
      (v_item->>'quantity')::int, (v_item->>'unit_price')::numeric, (v_item->>'line_total')::numeric,
      v_item->>'kanban_status', 'validated', v_item, NULL);
  END LOOP;

  INSERT INTO crm_activity_log(card_id, action_type, new_value, actor_email, metadata)
  SELECT v_card, 'devis_order_created', v_number, p_order->>'actor_email',
         jsonb_build_object('order_id', v_id, 'order_number', v_number);

  RETURN jsonb_build_object('id', v_id, 'order_number', v_number, 'existing', false);
END;
$$;
REVOKE ALL ON FUNCTION public.create_devis_order(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_devis_order(jsonb, jsonb) TO service_role;