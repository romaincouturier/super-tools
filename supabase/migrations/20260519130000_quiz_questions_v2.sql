-- Extend lms_quiz_questions with richer metadata for the modern quiz player
ALTER TABLE lms_quiz_questions
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS hint TEXT,
  ADD COLUMN IF NOT EXISTS feedback_correct TEXT,
  ADD COLUMN IF NOT EXISTS feedback_incorrect TEXT,
  ADD COLUMN IF NOT EXISTS difficulty_level TEXT CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
  ADD COLUMN IF NOT EXISTS notion TEXT,
  ADD COLUMN IF NOT EXISTS multi_select BOOLEAN NOT NULL DEFAULT false;

-- Extend question_type to include situation and short_answer
ALTER TABLE lms_quiz_questions
  DROP CONSTRAINT IF EXISTS lms_quiz_questions_question_type_check;

ALTER TABLE lms_quiz_questions
  ADD CONSTRAINT lms_quiz_questions_question_type_check
  CHECK (question_type IN ('mcq', 'true_false', 'open', 'fill_blank', 'situation', 'short_answer'));
