ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_kanban_status_check;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_kanban_status_check CHECK (kanban_status IN (
  'to_validate','received','to_ship','dropshipping','location_pending','location_active','processed','blocked','quote_draft'
));

DROP INDEX IF EXISTS public.uniq_active_devis_order_per_card;
CREATE UNIQUE INDEX uniq_active_devis_order_per_card
  ON public.woocommerce_orders(crm_card_id)
  WHERE source = 'devis' AND cancelled_at IS NULL AND wc_status <> 'draft';

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
   WHERE crm_card_id = v_card AND source = 'devis' AND cancelled_at IS NULL AND wc_status <> 'draft' LIMIT 1;
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

CREATE OR REPLACE FUNCTION public.create_game_quote(p_quote jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card uuid := nullif(p_quote->>'crm_card_id', '')::uuid;
  v_year int := extract(year from (now() AT TIME ZONE 'Europe/Paris'))::int;
  v_num int;
  v_wc int;
  v_number text;
  v_id uuid;
  v_activity_id uuid;
  v_comment_id uuid;
  v_item jsonb;
  v_idx int := 0;
  v_actor text := coalesce(nullif(auth.jwt()->>'email', ''), 'mcp');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff_user()
     OR NOT (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping')) THEN
    RAISE EXCEPTION 'Accès dropshipping requis' USING ERRCODE = '42501';
  END IF;
  IF p_quote IS NULL OR jsonb_typeof(p_quote) <> 'object'
     OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Devis ou lignes invalides';
  END IF;
  IF nullif(btrim(p_quote->>'customer_email'), '') IS NULL
     OR jsonb_typeof(p_quote->'billing_address') <> 'object'
     OR jsonb_typeof(p_quote->'shipping_address') <> 'object' THEN
    RAISE EXCEPTION 'Client ou adresses invalides';
  END IF;
  IF (p_quote->>'total_ht')::numeric < 0 OR (p_quote->>'total_tax')::numeric < 0
     OR (p_quote->>'total_ttc')::numeric < 0 OR (p_quote->>'shipping_total')::numeric < 0
     OR coalesce((p_quote->>'admin_fee')::numeric, 0) < 0 THEN
    RAISE EXCEPTION 'Montants invalides';
  END IF;
  IF v_card IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.crm_cards WHERE id = v_card) THEN
    RAISE EXCEPTION 'Opportunité CRM introuvable';
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR nullif(v_item->>'game_id', '') IS NULL
       OR (v_item->>'quantity')::integer <= 0
       OR (v_item->>'unit_price')::numeric <= 0
       OR (v_item->>'line_total')::numeric < 0 THEN
      RAISE EXCEPTION 'Ligne de devis invalide';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = (v_item->>'game_id')::uuid AND status = 'active') THEN
      RAISE EXCEPTION 'Jeu introuvable ou inactif';
    END IF;
  END LOOP;

  INSERT INTO public.activity_logs(action_type, recipient_email, user_id, details)
  VALUES ('game_devis_draft', p_quote->>'customer_email', auth.uid(), p_quote->'activity_details')
  RETURNING id INTO v_activity_id;

  INSERT INTO public.devis_order_counters(year, last_value) VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = devis_order_counters.last_value + 1
  RETURNING last_value INTO v_num;
  v_number := 'DV-' || v_year || '-' || lpad(v_num::text, 4, '0');
  v_wc := -nextval('public.devis_order_wc_id_seq')::int;

  INSERT INTO public.woocommerce_orders(
    wc_order_id, order_number, wc_status, date_created,
    customer_first_name, customer_last_name, customer_email, billing_address, shipping_address,
    total_ttc, total_ht, total_tax, shipping_total, payment_method, payment_method_title,
    line_items, raw_order, processed_at, source, devis_activity_log_id, crm_card_id, created_by
  ) VALUES (
    v_wc, v_number, 'draft', now(),
    p_quote->>'customer_first_name', p_quote->>'customer_last_name', p_quote->>'customer_email',
    p_quote->'billing_address', p_quote->'shipping_address',
    (p_quote->>'total_ttc')::numeric, (p_quote->>'total_ht')::numeric, (p_quote->>'total_tax')::numeric,
    (p_quote->>'shipping_total')::numeric, 'devis', 'Devis brouillon — non facturé',
    p_items, p_quote || jsonb_build_object('order_number', v_number, 'source', 'devis', 'quote_status', 'draft'),
    NULL, 'devis', v_activity_id, v_card, auth.uid()
  ) RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_idx := v_idx + 1;
    INSERT INTO public.order_items(
      woocommerce_order_id, wc_order_id, wc_product_id, wc_variation_id, product_name,
      game_id, game_type, quantity, unit_price, line_total, kanban_status, validation_status, raw_line_item, block_reason
    ) VALUES (
      v_id, v_wc, coalesce((v_item->>'wc_product_id')::int, -v_idx), nullif(v_item->>'wc_variation_id', '')::int,
      v_item->>'product_name', (v_item->>'game_id')::uuid, v_item->>'game_type',
      (v_item->>'quantity')::int, (v_item->>'unit_price')::numeric, (v_item->>'line_total')::numeric,
      'quote_draft', 'pending', v_item, NULL
    );
  END LOOP;

  IF v_card IS NOT NULL THEN
    INSERT INTO public.crm_comments(card_id, author_email, content)
    VALUES (v_card, v_actor, p_quote->>'crm_comment')
    RETURNING id INTO v_comment_id;
    INSERT INTO public.crm_activity_log(card_id, action_type, new_value, actor_email, metadata) VALUES
      (v_card, 'comment_added', left(p_quote->>'crm_comment', 200), v_actor,
       jsonb_build_object('via', 'mcp', 'quote_id', v_id, 'quote_number', v_number)),
      (v_card, 'game_devis_draft', v_number, v_actor,
       jsonb_build_object('via', 'mcp', 'quote_id', v_id, 'activity_log_id', v_activity_id,
         'total_ht', (p_quote->>'total_ht')::numeric, 'total_ttc', (p_quote->>'total_ttc')::numeric));
  END IF;

  RETURN jsonb_build_object(
    'id', v_id, 'order_number', v_number, 'activity_log_id', v_activity_id,
    'crm_comment_id', v_comment_id, 'status', 'draft'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.create_game_quote(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game_quote(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_game_quote(jsonb, jsonb) TO service_role;