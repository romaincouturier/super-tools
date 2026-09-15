CREATE OR REPLACE FUNCTION public.lms_lesson_fingerprint(p_lesson_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    md5(string_agg(id::text || ':' || updated_at::text, ';' ORDER BY position, id)),
    ''
  )
  FROM public.lms_lesson_blocks
  WHERE lesson_id = p_lesson_id AND parent_block_id IS NULL;
$$;

REVOKE ALL ON FUNCTION public.lms_lesson_fingerprint(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lms_lesson_fingerprint(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.lms_lesson_fingerprints(p_lesson_ids uuid[])
RETURNS TABLE (lesson_id uuid, fingerprint text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT l AS lesson_id, public.lms_lesson_fingerprint(l) AS fingerprint
  FROM unnest(p_lesson_ids) AS l;
$$;

REVOKE ALL ON FUNCTION public.lms_lesson_fingerprints(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lms_lesson_fingerprints(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_lesson_restructure(
  p_lesson_id uuid,
  p_fingerprint text,
  p_blocks jsonb,
  p_source text DEFAULT 'mcp'
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current_fingerprint text;
  v_block jsonb;
  v_type text;
  v_allowed_types text[] := ARRAY[
    'text','callout','key_points','bullet_list','checklist',
    'exercise','code','accordion','summary','timeline','flip_cards'
  ];
  v_position integer := 0;
BEGIN
  IF NOT (is_staff_user() OR current_user = 'service_role') THEN
    RAISE EXCEPTION 'Permission denied: only staff can restructure lessons';
  END IF;

  v_current_fingerprint := public.lms_lesson_fingerprint(p_lesson_id);

  IF v_current_fingerprint IS DISTINCT FROM p_fingerprint THEN
    RAISE EXCEPTION 'Fingerprint mismatch: lesson has changed since the proposal (expected %, got %)',
      v_current_fingerprint, p_fingerprint;
  END IF;

  INSERT INTO public.lms_lesson_snapshots (lesson_id, blocks, source, created_by)
  SELECT
    p_lesson_id,
    COALESCE(jsonb_agg(to_jsonb(b.*) ORDER BY COALESCE(b.parent_block_id::text, ''), b.position), '[]'::jsonb),
    p_source,
    auth.uid()
  FROM public.lms_lesson_blocks b
  WHERE b.lesson_id = p_lesson_id;

  DELETE FROM public.lms_lesson_blocks
  WHERE lesson_id = p_lesson_id AND parent_block_id IS NULL AND kind = 'content';

  FOR v_block IN SELECT * FROM jsonb_array_elements(p_blocks)
  LOOP
    v_type := v_block->>'type';
    IF v_type IS NULL OR NOT (v_type = ANY (v_allowed_types)) THEN
      RAISE EXCEPTION 'Block type % is not allowed', COALESCE(v_type, 'null');
    END IF;

    INSERT INTO public.lms_lesson_blocks (lesson_id, type, kind, parent_block_id, position, hidden, content)
    VALUES (
      p_lesson_id,
      v_type,
      'content',
      NULL,
      v_position,
      COALESCE((v_block->>'hidden')::boolean, false),
      COALESCE(v_block->'content', '{}'::jsonb)
    );

    v_position := v_position + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_lesson_restructure(uuid, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_lesson_restructure(uuid, text, jsonb, text) TO authenticated, service_role;