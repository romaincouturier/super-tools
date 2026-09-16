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
  v_child jsonb;
  v_type text;
  v_kind text;
  v_child_type text;
  v_new_id uuid;
  v_child_position integer;
  v_allowed_content_types text[] := ARRAY[
    'text','table','callout','key_points','bullet_list','checklist','summary',
    'accordion','timeline','flip_cards','code','exercise','self_assessment',
    'fill_blanks','drag_words','quiz','assignment','work_deposit',
    'video','image','gallery','file','image_hotspot','before_after',
    'button','cta','html_embed','shortcode'
  ];
  v_allowed_layout_types text[] := ARRAY['section','row','container','reveal','divider','spacer'];
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

  -- Le payload décrit l'intégralité du corps de la leçon : on remplace tous les
  -- blocs de premier niveau (les enfants partent en cascade via parent_block_id).
  DELETE FROM public.lms_lesson_blocks
  WHERE lesson_id = p_lesson_id AND parent_block_id IS NULL;

  FOR v_block IN SELECT * FROM jsonb_array_elements(p_blocks)
  LOOP
    v_type := v_block->>'type';
    v_kind := COALESCE(v_block->>'kind', 'content');

    IF v_kind NOT IN ('content','layout') THEN
      RAISE EXCEPTION 'Block kind % is not allowed', v_kind;
    END IF;

    IF v_type IS NULL
       OR (v_kind = 'content' AND NOT (v_type = ANY (v_allowed_content_types)))
       OR (v_kind = 'layout' AND NOT (v_type = ANY (v_allowed_layout_types))) THEN
      RAISE EXCEPTION 'Block type % is not allowed', COALESCE(v_type, 'null');
    END IF;

    INSERT INTO public.lms_lesson_blocks (lesson_id, type, kind, parent_block_id, position, hidden, content)
    VALUES (
      p_lesson_id,
      v_type,
      v_kind,
      NULL,
      v_position,
      COALESCE((v_block->>'hidden')::boolean, false),
      COALESCE(v_block->'content', '{}'::jsonb)
    )
    RETURNING id INTO v_new_id;

    IF v_kind = 'layout' AND jsonb_typeof(v_block->'children') = 'array' THEN
      v_child_position := 0;
      FOR v_child IN SELECT * FROM jsonb_array_elements(v_block->'children')
      LOOP
        v_child_type := v_child->>'type';
        IF v_child_type IS NULL OR NOT (v_child_type = ANY (v_allowed_content_types)) THEN
          RAISE EXCEPTION 'Child block type % is not allowed', COALESCE(v_child_type, 'null');
        END IF;

        INSERT INTO public.lms_lesson_blocks (lesson_id, type, kind, parent_block_id, position, hidden, content)
        VALUES (
          p_lesson_id,
          v_child_type,
          'content',
          v_new_id,
          v_child_position,
          COALESCE((v_child->>'hidden')::boolean, false),
          COALESCE(v_child->'content', '{}'::jsonb)
        );

        v_child_position := v_child_position + 1;
      END LOOP;
    END IF;

    v_position := v_position + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_lesson_restructure(uuid, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_lesson_restructure(uuid, text, jsonb, text) TO authenticated, service_role;