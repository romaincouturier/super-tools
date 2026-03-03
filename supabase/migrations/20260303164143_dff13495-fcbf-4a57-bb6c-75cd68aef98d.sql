CREATE POLICY "Authenticated users can delete formation configs"
ON public.formation_configs
FOR DELETE
TO authenticated
USING (true);