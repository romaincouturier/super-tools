CREATE POLICY "Service role can manage health data"
  ON public.edge_function_health FOR ALL
  TO service_role USING (true) WITH CHECK (true);