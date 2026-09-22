-- Durcissement RLS : missions (F2) et storage certificates (F4).
-- Contexte : audit red team (RED_TEAM_ASSESSMENT.md). Le self-signup Supabase
-- est ouvert, donc "authenticated" n'est PAS synonyme de "staff" : toute policy
-- permissive sur authenticated est exploitable par un compte auto-inscrit.

-- ── F2. missions ─────────────────────────────────────────────────────────────
-- Policies permissives historiques jamais supprimees, qui neutralisent les
-- policies staff (missions_select/insert/update/delete = is_staff_user) :
--   - "Users can view all missions"  : FOR SELECT, role PUBLIC, USING(true)
--     => lecture de toutes les missions clients par anon ET authenticated.
--   - "Users can create/update/delete missions" : USING(auth.uid() IS NOT NULL)
--     => ecriture/suppression par tout compte authentifie.
--   - "missions_org_isolation" : FOR ALL authenticated, USING(true) en
--     mono-tenant (multi_tenant_enabled off) => tout authentifie a acces total.
-- Les ecritures legitimes passent par les edge functions (service_role, qui
-- ignore la RLS) ou par du staff (is_staff_user). On restreint donc au staff.

DROP POLICY IF EXISTS "Users can view all missions" ON public.missions;
DROP POLICY IF EXISTS "Users can create missions" ON public.missions;
DROP POLICY IF EXISTS "Users can update missions" ON public.missions;
DROP POLICY IF EXISTS "Users can delete missions" ON public.missions;

-- Re-borne l'isolation org au staff (conserve la logique multi-tenant future).
DROP POLICY IF EXISTS "missions_org_isolation" ON public.missions;
CREATE POLICY "missions_org_isolation" ON public.missions
  FOR ALL TO authenticated
  USING (
    public.is_staff_user()
    AND (
      NOT public.is_feature_enabled('multi_tenant_enabled')
      OR org_id = public.get_user_org_id(auth.uid())
    )
  )
  WITH CHECK (
    public.is_staff_user()
    AND (
      NOT public.is_feature_enabled('multi_tenant_enabled')
      OR org_id = public.get_user_org_id(auth.uid())
    )
  );

-- Etat final missions : missions_select/insert/update/delete + missions_org_isolation,
-- toutes gardees par public.is_staff_user(). Anon et authenticated non-staff : aucun acces.

-- ── F4. storage certificates ─────────────────────────────────────────────────
-- Les policies d'ecriture nommees "Service role can ..." etaient en realite
-- FOR ... TO authenticated avec pour seul predicat bucket_id='certificates'
-- (la redefinition censee les durcir a ete avalee par EXCEPTION duplicate_object).
-- => tout utilisateur authentifie (dont un compte auto-inscrit) pouvait
--    televerser/ecraser une attestation nominative. Les uploads legitimes se
--    font en service_role (edge function generate-certificates), qui ignore la RLS.
-- On restreint l'ecriture au staff. La lecture publique est laissee en l'etat
-- (servie par getPublicUrl cote front) ; sa fermeture via URLs signees est un
-- chantier separe suivi dans RED_TEAM_ASSESSMENT.md.

DROP POLICY IF EXISTS "Service role can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update certificates" ON storage.objects;

CREATE POLICY "Staff can upload certificates" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificates' AND public.is_staff_user());

CREATE POLICY "Staff can update certificates" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'certificates' AND public.is_staff_user())
  WITH CHECK (bucket_id = 'certificates' AND public.is_staff_user());
