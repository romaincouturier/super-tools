-- Stage 1 of ST-2026-0060 — Page Builder for lessons.
--
-- Extends lms_lesson_blocks with the structural fields needed for a
-- nested layout/content block tree:
--   • parent_block_id : self-FK so blocks can be nested inside layout
--     containers (section, row, container).
--   • kind            : discriminates layout blocks (organisational, can
--     contain children) from content blocks (leaves: text, video, …).
--
-- This migration is purely additive. Existing rows produced by the
-- ST-2026-0040 backfill stay valid: parent_block_id defaults to NULL
-- (top-level) and kind defaults to 'content' (they were all content
-- blocks). Nested DnD wiring lands in a follow-up PR.

-- ── Columns ──────────────────────────────────────────────────────────
ALTER TABLE public.lms_lesson_blocks
  ADD COLUMN IF NOT EXISTS parent_block_id UUID
    REFERENCES public.lms_lesson_blocks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'content';

-- Constrain kind to the two known values. Use DO block so re-running
-- the migration on an environment where the constraint already exists
-- is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lms_lesson_blocks_kind_check'
  ) THEN
    ALTER TABLE public.lms_lesson_blocks
      ADD CONSTRAINT lms_lesson_blocks_kind_check
      CHECK (kind IN ('layout', 'content'));
  END IF;
END $$;

COMMENT ON COLUMN public.lms_lesson_blocks.parent_block_id IS
  'Optional parent layout block. NULL for top-level blocks. Children are ordered by `position` within their parent.';
COMMENT ON COLUMN public.lms_lesson_blocks.kind IS
  'layout = structural container (section, row, column, container, divider, spacer); content = leaf (text, video, quiz, …).';

-- ── Indexes ──────────────────────────────────────────────────────────
-- Top-level lookup: blocks of a lesson with no parent, ordered.
CREATE INDEX IF NOT EXISTS lms_lesson_blocks_lesson_toplevel_idx
  ON public.lms_lesson_blocks (lesson_id, position)
  WHERE parent_block_id IS NULL;

-- Children lookup: blocks under a given parent, ordered.
CREATE INDEX IF NOT EXISTS lms_lesson_blocks_parent_position_idx
  ON public.lms_lesson_blocks (parent_block_id, position)
  WHERE parent_block_id IS NOT NULL;

-- ── Same-lesson invariant ────────────────────────────────────────────
-- A child block must belong to the same lesson as its parent. Enforced
-- via a BEFORE INSERT/UPDATE trigger because PostgreSQL does not allow
-- subqueries in CHECK constraints.
CREATE OR REPLACE FUNCTION public.lms_lesson_blocks_check_parent_lesson()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_lesson_id UUID;
  v_parent_kind TEXT;
BEGIN
  IF NEW.parent_block_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT lesson_id, kind
    INTO v_parent_lesson_id, v_parent_kind
  FROM public.lms_lesson_blocks
  WHERE id = NEW.parent_block_id;

  IF v_parent_lesson_id IS NULL THEN
    RAISE EXCEPTION 'parent_block_id % does not exist', NEW.parent_block_id;
  END IF;

  IF v_parent_lesson_id <> NEW.lesson_id THEN
    RAISE EXCEPTION
      'parent_block_id % belongs to lesson %, but block is on lesson %',
      NEW.parent_block_id, v_parent_lesson_id, NEW.lesson_id;
  END IF;

  IF v_parent_kind <> 'layout' THEN
    RAISE EXCEPTION
      'parent_block_id % is a content block; only layout blocks can have children',
      NEW.parent_block_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lms_lesson_blocks_check_parent ON public.lms_lesson_blocks;
CREATE TRIGGER lms_lesson_blocks_check_parent
  BEFORE INSERT OR UPDATE OF parent_block_id, lesson_id
  ON public.lms_lesson_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.lms_lesson_blocks_check_parent_lesson();
