CREATE OR REPLACE FUNCTION public.sync_daily_quality_actions(_user_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := coalesce(_user_id,auth.uid()); r record; item jsonb; targets jsonb := '[]'::jsonb; keeper uuid; active_ids uuid[] := '{}'::uuid[]; changed integer := 0; n integer; today date := (now() AT TIME ZONE 'Europe/Paris')::date;
BEGIN
 IF u IS NULL OR (auth.role() <> 'service_role' AND u IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('daily-quality:'||u::text,0));
 IF public.is_admin(u) THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('category','qualiopi','entity_type','qualiopi_check','entity_id',f->>'checkId','title','Indicateur '||(f->>'indicator')||' : '||(f->>'label'),'description',f->>'detail','link',coalesce(f->>'fixHref','/audit-blanc'))),'[]'::jsonb) INTO targets FROM jsonb_array_elements(coalesce((SELECT findings FROM public.audit_runs WHERE notes LIKE 'Passage automatique%' ORDER BY started_at DESC LIMIT 1),'[]'::jsonb)) f;
 END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE user_id=u AND lower(email)='romain@supertilt.fr') THEN
  SELECT targets || coalesce(jsonb_agg(jsonb_build_object('category',CASE status WHEN 'proposed' THEN 'watch_sources_validate' ELSE 'watch_sources_subscribe' END,'entity_type','watch_source','entity_id',id::text,'title',CASE status WHEN 'proposed' THEN name ELSE 'M''abonner à '||name END,'description',concat_ws(E'\n',url,why,how_to_follow),'link',url)),'[]'::jsonb) INTO targets FROM public.watch_sources WHERE status IN ('proposed','to_subscribe');
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(targets) LOOP
  keeper := NULL;
  SELECT id INTO keeper FROM public.daily_actions WHERE user_id=u AND category=item->>'category' AND entity_type=item->>'entity_type' AND entity_id=item->>'entity_id' ORDER BY action_date DESC,created_at DESC,id DESC LIMIT 1;
  IF keeper IS NULL THEN
   INSERT INTO public.daily_actions(user_id,action_date,category,entity_type,entity_id,title,description,link) VALUES(u,today,item->>'category',item->>'entity_type',item->>'entity_id',item->>'title',item->>'description',item->>'link') RETURNING id INTO keeper;
   changed := changed+1;
  ELSE
   UPDATE public.daily_actions SET title=item->>'title',description=item->>'description',link=item->>'link',is_completed=false,completed_at=NULL,auto_completed=false WHERE id=keeper AND (is_completed OR title IS DISTINCT FROM item->>'title' OR description IS DISTINCT FROM item->>'description' OR link IS DISTINCT FROM item->>'link');
   GET DIAGNOSTICS n=ROW_COUNT; changed:=changed+n;
  END IF;
  active_ids := array_append(active_ids,keeper);
 END LOOP;
 UPDATE public.daily_actions SET is_completed=true,completed_at=now(),auto_completed=true WHERE user_id=u AND category IN ('qualiopi','watch_sources_validate','watch_sources_subscribe') AND NOT is_completed AND NOT(id=ANY(active_ids));
 GET DIAGNOSTICS n=ROW_COUNT; changed:=changed+n;
 IF changed>0 THEN INSERT INTO public.activity_logs(user_id,recipient_email,action_type,details) VALUES(u,coalesce((SELECT email FROM public.profiles WHERE user_id=u LIMIT 1),''),'daily_quality_sync',jsonb_build_object('changed',changed,'active',cardinality(active_ids))); END IF;
END $$;
REVOKE ALL ON FUNCTION public.sync_daily_quality_actions(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_daily_quality_actions(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.decide_daily_watch_source(_source_id uuid,_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE before_row public.watch_sources;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid() AND lower(email)='romain@supertilt.fr') OR NOT public.is_staff_user() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 SELECT * INTO before_row FROM public.watch_sources WHERE id=_source_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Source introuvable'; END IF;
 IF NOT ((before_row.status='proposed' AND _status IN ('to_subscribe','dropped')) OR (before_row.status='to_subscribe' AND _status='followed')) THEN RAISE EXCEPTION 'Transition non autorisée'; END IF;
 UPDATE public.watch_sources SET status=_status WHERE id=_source_id;
 INSERT INTO public.activity_logs(user_id,recipient_email,action_type,details) VALUES(auth.uid(),'romain@supertilt.fr','watch_source_decision',jsonb_build_object('source_id',_source_id,'before',before_row.status,'after',_status));
 PERFORM public.sync_daily_quality_actions(auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.decide_daily_watch_source(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decide_daily_watch_source(uuid,text) TO authenticated;
ALTER TABLE public.audit_runs ADD COLUMN IF NOT EXISTS summary_email_sent_at timestamptz;
ALTER TABLE public.audit_runs ADD COLUMN IF NOT EXISTS summary_email_error text;