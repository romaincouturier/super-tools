CREATE TABLE public.backup_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Paris')::date,
  status TEXT NOT NULL DEFAULT 'running',
  phase TEXT NOT NULL DEFAULT 'db',
  cursor_index INTEGER NOT NULL DEFAULT 0,
  drive_folder_id TEXT,
  storage_folder_id TEXT,
  drive_file_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  table_row_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  chunks_done INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_backup_runs_status ON public.backup_runs (status, last_activity_at DESC);
CREATE INDEX idx_backup_runs_started ON public.backup_runs (started_at DESC);

GRANT SELECT ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view backup runs"
ON public.backup_runs FOR SELECT TO authenticated
USING (public.is_staff_user());

CREATE TRIGGER update_backup_runs_updated_at
BEFORE UPDATE ON public.backup_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();