CREATE TABLE IF NOT EXISTS public.lms_lesson_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'app',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lms_lesson_snapshots_lookup
  ON public.lms_lesson_snapshots(lesson_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.lms_lesson_snapshots TO authenticated;
GRANT ALL ON public.lms_lesson_snapshots TO service_role;

ALTER TABLE public.lms_lesson_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_select_snapshots"
  ON public.lms_lesson_snapshots
  FOR SELECT TO authenticated
  USING (is_staff_user());

CREATE POLICY "staff_insert_snapshots"
  ON public.lms_lesson_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (is_staff_user());

CREATE POLICY "staff_delete_snapshots"
  ON public.lms_lesson_snapshots
  FOR DELETE TO authenticated
  USING (is_staff_user());

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

  SELECT COALESCE(
    md5(string_agg(id::text || ':' || updated_at::text, ';' ORDER BY position, id)),
    ''
  )
  INTO v_current_fingerprint
  FROM public.lms_lesson_blocks
  WHERE lesson_id = p_lesson_id AND parent_block_id IS NULL;

  IF v_current_fingerprint IS DISTINCT FROM p_fingerprint THEN
    RAISE EXCEPTION 'Fingerprint mismatch: lesson has changed since the proposal';
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
    IF NOT (v_type = ANY(v_allowed_types)) THEN
      RAISE EXCEPTION 'Block type "%" is not allowed for restructuring', v_type;
    END IF;
    INSERT INTO public.lms_lesson_blocks (
      lesson_id, type, kind, parent_block_id, position, hidden, content
    ) VALUES (
      p_lesson_id,
      v_type,
      CASE
        WHEN v_type IN ('section','row','container','reveal','divider','spacer') THEN 'layout'
        ELSE 'content'
      END,
      NULL,
      v_position,
      COALESCE((v_block->>'hidden')::boolean, false),
      v_block->'content'
    );
    v_position := v_position + 1;
  END LOOP;

  UPDATE public.lms_lessons SET updated_at = now() WHERE id = p_lesson_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_lesson_version(p_snapshot_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_lesson_id uuid;
  v_blocks jsonb;
  v_block jsonb;
  v_old_id text;
  v_id_map jsonb := '{}'::jsonb;
  v_new_id uuid;
  v_parent_new uuid;
BEGIN
  IF NOT (is_staff_user() OR current_user = 'service_role') THEN
    RAISE EXCEPTION 'Permission denied: only staff can restore lesson versions';
  END IF;

  SELECT lesson_id, blocks INTO v_lesson_id, v_blocks
  FROM public.lms_lesson_snapshots
  WHERE id = p_snapshot_id;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Snapshot not found';
  END IF;

  INSERT INTO public.lms_lesson_snapshots (lesson_id, blocks, source, created_by)
  SELECT
    v_lesson_id,
    COALESCE(jsonb_agg(to_jsonb(b.*) ORDER BY COALESCE(b.parent_block_id::text, ''), b.position), '[]'::jsonb),
    'restore',
    auth.uid()
  FROM public.lms_lesson_blocks b
  WHERE b.lesson_id = v_lesson_id;

  DELETE FROM public.lms_lesson_blocks WHERE lesson_id = v_lesson_id;

  FOR v_block IN SELECT * FROM jsonb_array_elements(v_blocks)
  LOOP
    v_old_id := v_block->>'id';
    v_new_id := gen_random_uuid();
    v_id_map := v_id_map || jsonb_build_object(v_old_id, v_new_id::text);
    INSERT INTO public.lms_lesson_blocks (
      id, lesson_id, type, kind, parent_block_id, position, hidden, content, created_at, updated_at
    ) VALUES (
      v_new_id,
      v_lesson_id,
      v_block->>'type',
      v_block->>'kind',
      NULL,
      COALESCE((v_block->>'position')::integer, 0),
      COALESCE((v_block->>'hidden')::boolean, false),
      v_block->'content',
      COALESCE((v_block->>'created_at')::timestamptz, now()),
      COALESCE((v_block->>'updated_at')::timestamptz, now())
    );
  END LOOP;

  FOR v_block IN SELECT * FROM jsonb_array_elements(v_blocks)
  LOOP
    v_old_id := v_block->>'id';
    IF v_block->>'parent_block_id' IS NOT NULL THEN
      v_parent_new := (v_id_map->>(v_block->>'parent_block_id'))::uuid;
      UPDATE public.lms_lesson_blocks
      SET parent_block_id = v_parent_new
      WHERE id = (v_id_map->>v_old_id)::uuid;
    END IF;
  END LOOP;

  UPDATE public.lms_lessons SET updated_at = now() WHERE id = v_lesson_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_lesson_restructure(uuid, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_lesson_restructure(uuid, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_lesson_version(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_lesson_version(uuid) TO service_role;