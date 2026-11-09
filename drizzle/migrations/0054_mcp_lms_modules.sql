CREATE OR REPLACE FUNCTION public.mcp_save_lms_module(p_course_id uuid,p_module_id uuid,p_patch jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $function$
DECLARE previous jsonb; saved jsonb; target integer; old_position integer; total integer; actual_course uuid; result_id uuid;
BEGIN
 IF NOT public.is_staff_user() THEN RAISE EXCEPTION 'Accès personnel requis' USING ERRCODE='42501'; END IF;
 IF p_patch IS NULL OR jsonb_typeof(p_patch)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN ('title','description','position')) THEN RAISE EXCEPTION 'Champs interdits'; END IF;
 IF p_module_id IS NULL THEN actual_course:=p_course_id; ELSE SELECT course_id INTO actual_course FROM public.lms_modules WHERE id=p_module_id; END IF;
 IF actual_course IS NULL OR (p_course_id IS NOT NULL AND p_course_id<>actual_course) THEN RAISE EXCEPTION 'Cours ou module introuvable'; END IF;
 PERFORM 1 FROM public.lms_courses WHERE id=actual_course FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cours introuvable'; END IF;
 SELECT count(*) INTO total FROM public.lms_modules WHERE course_id=actual_course;
 IF p_module_id IS NOT NULL THEN SELECT to_jsonb(m),position INTO previous,old_position FROM public.lms_modules m WHERE id=p_module_id; END IF;
 IF p_patch ? 'title' AND (jsonb_typeof(p_patch->'title')<>'string' OR length(btrim(p_patch->>'title')) NOT BETWEEN 1 AND 255) THEN RAISE EXCEPTION 'Titre invalide'; END IF;
 IF p_patch ? 'description' AND p_patch->'description'<>'null'::jsonb AND (jsonb_typeof(p_patch->'description')<>'string' OR length(p_patch->>'description')>10000) THEN RAISE EXCEPTION 'Description invalide'; END IF;
 IF p_patch ? 'position' AND (jsonb_typeof(p_patch->'position')<>'number' OR (p_patch->>'position') !~ '^[0-9]+$') THEN RAISE EXCEPTION 'Position invalide'; END IF;
 IF p_module_id IS NULL OR p_patch ? 'position' THEN
  WITH ranked AS (SELECT id,(row_number() OVER(ORDER BY position,id)-1)::integer AS pos FROM public.lms_modules WHERE course_id=actual_course) UPDATE public.lms_modules m SET position=r.pos FROM ranked r WHERE m.id=r.id AND m.position<>r.pos;
  IF p_module_id IS NOT NULL THEN SELECT position INTO old_position FROM public.lms_modules WHERE id=p_module_id; END IF;
 END IF;
 target:=COALESCE((p_patch->>'position')::integer,CASE WHEN p_module_id IS NULL THEN total ELSE old_position END);
 IF target<0 OR target>(CASE WHEN p_module_id IS NULL THEN total ELSE total-1 END) THEN RAISE EXCEPTION 'Position hors limites'; END IF;
 IF p_module_id IS NULL THEN
  IF NOT p_patch ? 'title' THEN RAISE EXCEPTION 'Titre requis'; END IF;
  UPDATE public.lms_modules SET position=position+1 WHERE course_id=actual_course AND position>=target;
  INSERT INTO public.lms_modules(course_id,title,description,position) VALUES(actual_course,btrim(p_patch->>'title'),p_patch->>'description',target) RETURNING id INTO result_id;
 ELSE
  result_id:=p_module_id;
  IF p_patch ? 'position' THEN UPDATE public.lms_modules SET position=CASE WHEN target<old_position THEN position+1 ELSE position-1 END WHERE course_id=actual_course AND id<>p_module_id AND ((target<old_position AND position>=target AND position<old_position) OR (target>old_position AND position>old_position AND position<=target)); END IF;
  UPDATE public.lms_modules SET title=CASE WHEN p_patch ? 'title' THEN btrim(p_patch->>'title') ELSE title END,description=CASE WHEN p_patch ? 'description' THEN p_patch->>'description' ELSE description END,position=target WHERE id=p_module_id;
 END IF;
 SELECT to_jsonb(m) INTO saved FROM public.lms_modules m WHERE id=result_id;
 INSERT INTO public.activity_logs(action_type,recipient_email,user_id,details) VALUES('mcp_lms_module_saved',COALESCE(auth.jwt()->>'email','mcp'),auth.uid(),jsonb_build_object('before',previous,'after',saved));
 RETURN jsonb_build_object('before',previous,'after',saved);
END;
$function$;
REVOKE ALL ON FUNCTION public.mcp_save_lms_module(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mcp_save_lms_module(uuid,uuid,jsonb) TO authenticated;