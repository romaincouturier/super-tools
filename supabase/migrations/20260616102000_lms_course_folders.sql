-- Folders for organizing LMS courses (max 2 levels: folder > subfolder)

CREATE TABLE lms_course_folders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  parent_id  UUID REFERENCES lms_course_folders(id) ON DELETE SET NULL,
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lms_course_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lms_course_folders_staff_all" ON lms_course_folders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add folder_id to courses (null = root level)
ALTER TABLE lms_courses ADD COLUMN folder_id UUID REFERENCES lms_course_folders(id) ON DELETE SET NULL;
