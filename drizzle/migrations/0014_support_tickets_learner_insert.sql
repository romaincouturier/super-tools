-- Les apprenants connectés peuvent créer un ticket de support rattaché à
-- leur propre compte, et relire leurs propres tickets. Les droits staff
-- (policies support_tickets_insert/select/update existantes) sont inchangés.

CREATE POLICY support_tickets_insert_learner
ON public.support_tickets
FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_access_level() = 'learner'
  AND submitted_by = auth.uid()
  AND lower(submitted_by_email) = lower(auth.jwt() ->> 'email')
);

-- Nécessaire aussi pour que l'INSERT ... RETURNING du client aboutisse.
CREATE POLICY support_tickets_select_own
ON public.support_tickets
FOR SELECT TO authenticated
USING (submitted_by = auth.uid());