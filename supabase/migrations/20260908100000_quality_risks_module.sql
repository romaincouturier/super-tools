-- Module « Risques qualité » : rendre le droit d'accès effectif.
--
-- `quality_risks` était lisible par le module `formations`, faute d'écran
-- dédié. L'écran existe maintenant sous sa propre entrée de navigation, dont
-- la clé est `risques` : sans cette policy, un utilisateur à qui l'on accorde
-- ce module verrait le menu et une page vide, la RLS refusant chaque ligne.
--
-- Additive : le droit par `formations` est conservé, personne ne perd l'accès.
-- Idempotente : DROP POLICY IF EXISTS avant création. Réversible en rétablissant
-- la policy précédente, sans toucher aux données.

DROP POLICY IF EXISTS quality_risks_manage ON public.quality_risks;
CREATE POLICY quality_risks_manage ON public.quality_risks
  FOR ALL TO authenticated
  USING (
    has_module_access(auth.uid(), 'risques')
    OR has_module_access(auth.uid(), 'formations')
    OR is_admin(auth.uid())
  )
  WITH CHECK (
    has_module_access(auth.uid(), 'risques')
    OR has_module_access(auth.uid(), 'formations')
    OR is_admin(auth.uid())
  );
