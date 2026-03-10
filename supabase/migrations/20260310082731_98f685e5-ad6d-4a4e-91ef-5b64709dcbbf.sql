CREATE TABLE public.edge_function_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'unknown',
  response_time_ms integer NOT NULL DEFAULT 0,
  checked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.edge_function_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read health data"
  ON public.edge_function_health FOR SELECT
  TO authenticated USING (true);