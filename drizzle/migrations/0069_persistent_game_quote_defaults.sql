CREATE TABLE public.game_quote_defaults (
  key text PRIMARY KEY,
  amount numeric NOT NULL CHECK (amount >= 0 AND amount <= 10000000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.game_quote_defaults TO authenticated;
GRANT ALL ON public.game_quote_defaults TO service_role;
ALTER TABLE public.game_quote_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY game_quote_defaults_read ON public.game_quote_defaults FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'dropshipping'));

CREATE OR REPLACE FUNCTION public.save_game_quote_default(p_key text, p_amount numeric, p_only_missing boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before numeric; v_game uuid; v_option uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(),'dropshipping')) THEN
    RAISE EXCEPTION 'Accès dropshipping requis' USING ERRCODE='42501';
  END IF;
  IF p_key IS NULL OR p_amount IS NULL OR p_amount < 0 OR p_amount > 10000000 OR p_amount::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Montant invalide';
  END IF;
  IF p_key NOT IN ('shipping','admin') THEN
    IF p_key !~ '^price:[0-9a-f-]{36}:[0-9a-f-]{0,36}$' THEN RAISE EXCEPTION 'Clé invalide'; END IF;
    v_game := split_part(p_key,':',2)::uuid;
    v_option := nullif(split_part(p_key,':',3),'')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.games WHERE id=v_game) OR
       (v_option IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.game_price_options WHERE id=v_option AND game_id=v_game)) THEN
      RAISE EXCEPTION 'Jeu ou option invalide';
    END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('game_quote_default:' || p_key));
  SELECT amount INTO v_before FROM public.game_quote_defaults WHERE key=p_key;
  IF (FOUND AND p_only_missing) OR v_before IS NOT DISTINCT FROM p_amount THEN RETURN; END IF;
  INSERT INTO public.game_quote_defaults(key,amount,updated_by) VALUES(p_key,p_amount,auth.uid())
  ON CONFLICT(key) DO UPDATE SET amount=excluded.amount,updated_at=now(),updated_by=excluded.updated_by;
  INSERT INTO public.activity_logs(action_type,recipient_email,user_id,details)
  VALUES('game_quote_default_saved',coalesce(auth.jwt()->>'email','mcp'),auth.uid(),jsonb_build_object('key',p_key,'before',v_before,'after',p_amount));
END $$;
REVOKE ALL ON FUNCTION public.save_game_quote_default(text,numeric,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_game_quote_default(text,numeric,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.remember_confirmed_game_quote_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_item jsonb;
BEGIN
  IF NEW.source='devis' AND NEW.wc_status='draft' AND auth.uid() IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.line_items) LOOP
      PERFORM public.save_game_quote_default('price:' || (v_item->>'game_id') || ':' || coalesce(v_item->>'price_option_id',''), (v_item->>'unit_price')::numeric);
    END LOOP;
    PERFORM public.save_game_quote_default('shipping',NEW.shipping_total);
    PERFORM public.save_game_quote_default('admin',coalesce((NEW.raw_order->>'admin_fee')::numeric,0));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER remember_confirmed_game_quote_defaults AFTER INSERT ON public.woocommerce_orders
FOR EACH ROW EXECUTE FUNCTION public.remember_confirmed_game_quote_defaults();