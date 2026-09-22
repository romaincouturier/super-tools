# Red Team Assessment super-tools

Audit offensif autorise (preuve statique, aucune exfiltration ni destruction reelle). Cible : le repo super-tools, opere par son proprietaire. Complement de `THREAT_MODEL.md` (profils + strategie) et `SECURITY.md`.

Methode : 3 audits paralleles ancres sur (1) RLS + SECURITY DEFINER + storage (748 migrations), (2) auth des 227 edge functions publiques + CORS + webhooks + secrets, (3) portail apprenant + routes tokenisees + frontend + agent IA/RAG. Etat FINAL des migrations verifie (redefinitions et DROP posterieurs pris en compte).

Rappel de sequencement : `supabase/migrations-apres-front/` est un lot **prepare mais non applique au push** (deferral delibere en attente de la bascule du front). Le correctif du finding le plus critique (F1) y dort. Ne pas l'appliquer sans la bascule front correspondante.

---

## Resume executif

1. **Usurpation d'identite apprenant par en-tete HTTP** (F1, CRITIQUE) : un anonyme lit/ecrit les donnees de ~22 tables du portail apprenant de n'importe quelle victime. Correctif prepare mais differe.
2. **Open relay + exfiltration d'emails** (E1, CRITIQUE) : `resend-logged-email` renvoyait n'importe quel email historique (reset password, factures, PII) a l'adresse d'un anonyme. **CORRIGE cette PR.**
3. **Relais d'email de masse / phishing depuis le domaine verifie** (E2-E5, HAUT) : plusieurs fonctions d'envoi sans garde. 2 corrigees cette PR (broadcast, content), les autres a decider.
4. **Fuite storage de documents clients et attestations** (F3/F4, HAUT) : buckets `mission-documents` et `certificates` lisibles/ecrivables par anon.
5. **Lecture transverse des missions clients** (F2, HAUT) : policy `USING(true)` jamais supprimee.
6. **Deni de portefeuille** (E6, MOYEN) : ~12 fonctions IA payantes declenchables par anon.
7. **Classe systemique RLS** (F5, HAUT) : ~50 tables `authenticated` sans garde `is_staff_user()`.
8. **Injection de prompt indirecte -> ecritures agent** (D3, MOYEN) : l'agent indexe des emails entrants et peut ecrire en base sans confirmation.
9. Bons points : aucune table sans RLS, aucun secret en clair (bundle/logs), agent-chat re-verifie l'auth serveur, `query_database` agent read-only verrouille, webhooks Stripe/Resend/Woo signes, tokens de flux a 122 bits.

---

## Corrige (branche courante)

| ID | Finding | Fichier | Correctif applique |
|----|---------|---------|--------------------|
| E1 | `resend-logged-email` open relay + exfil emails (CRITIQUE) | `supabase/functions/resend-logged-email/index.ts` | `verifyAuth` en tete de handler, 401 si anon |
| E4 | `send-broadcast-email` mailing de masse (HAUT) | `supabase/functions/send-broadcast-email/index.ts` | `verifyAuth` en tete de handler |
| E5 | `send-content-notification` relais (HAUT) | `supabase/functions/send-content-notification/index.ts` | `verifyAuth` en tete de handler |
| C2 | XSS stocke `WpArticleDetailDialog` (FAIBLE/MOYEN) | `src/components/transcripts/WpArticleDetailDialog.tsx:94` | `DOMPurify.sanitize()` sur le contenu WP |
| F2 | `missions` lecture/ecriture par anon + authenticated non-staff (HAUT) | `supabase/migrations/20260922120000_hardening_rls_missions_certificates.sql` | DROP des policies permissives (`USING(true)`, `auth.uid() IS NOT NULL`) + `missions_org_isolation` re-borne a `is_staff_user()` |
| F4 | Bucket `certificates` : ecrasement d'attestations par tout authenticated (HAUT) | idem migration ci-dessus | Ecriture INSERT/UPDATE restreinte a `is_staff_user()` (lecture publique laissee, voir plus bas) |
| B1 | `generate-attendance-pdf` fuite signatures + PII (MOYEN) | `supabase/functions/generate-attendance-pdf/index.ts` | garde `isInternalOrAuthenticated` |
| E2 | `send-action-reminder` relais (delegue par cron) | `supabase/functions/send-action-reminder/index.ts` | garde `isInternalOrAuthenticated` |
| E7 | `force-send-scheduled-email`, `cleanup-pending-email-drafts` sans garde | ces 2 fonctions | garde `isInternalOrAuthenticated` |

Helper ajoute : `supabase/functions/_shared/cron-auth.ts` -> `isInternalOrAuthenticated(req)` accepte un appel interne (service_role en Bearer, `x-internal-secret`, `x-cron-secret`) OU un JWT staff valide ; bloque uniquement l'anonyme. A reutiliser pour les crons restants (E8) apres verification que chacun envoie bien un secret interne.

**Faux positif corrige de l'audit** : F3 (`mission-documents` `SELECT TO public`) etait deja ferme a `20260804142210:44` (DROP + remplacement par `mission_files_missions_access`, staff only). Aucune fuite. Aucune action.

Ces 4 fonctions n'ont que des appelants frontend staff authentifies (verifie) ; `verifyAuth` bloque exactement l'attaquant anonyme sans casser l'usage. Typecheck src OK, check-rules 81/81 OK.

---

## Findings a decider (risque de casse ou sequencement)

Non appliques : ils touchent des parcours publics vivants, la RLS de prod, des buckets storage (passer prive casse les URLs publiques), ou dependent de la bascule front. A trancher par toi.

### Priorite 1 - Identite apprenant (le plus critique)
- **F1 / A1 (CRITIQUE, anon)** `get_learner_email()` fait confiance a l'en-tete `x-learner-email` quand le JWT est absent. Etat final : `supabase/migrations/20260918160000_demolition_lien_magique.sql:76-82`. ~22 tables protegees seulement par `learner_email = get_learner_email()` (learner_notifications, lms_work_deposits, lms_messages, lms_submissions, practice_*, depots_portfolio...). Un apprenant deja connecte ne peut plus usurper (le JWT prime), mais un anonyme avec la cle publishable du bundle le peut.
  - Correctif : appliquer `supabase/migrations-apres-front/20260915120000_lot6c_fermeture_entete_apprenant.sql` (retourne NULL sans JWT) APRES bascule du front sur des comptes apprenants authentifies. **Decision de sequencement, deja planifiee cote equipe.**
- **A2 (ELEVE, anon)** Policies RLS `to anon` toujours actives sur `practice_*` (`20260519190000_practice_feed.sql:22-32`, `20260526160000_...:22-116`), jamais DROP. Combine a F1 : publier/modifier/**supprimer** posts et commentaires au nom d'une victime.
  - Correctif : `DROP POLICY` des `anon_*_practice_*`, ne garder que les equivalents `to authenticated`. A coupler avec la bascule front.

### Priorite 2 - Fuite storage sans auth
- ~~**F3**~~ FAUX POSITIF : `mission-documents` deja ferme (cf. section Corrige). Aucune action.
- ~~**F4 ecriture**~~ CORRIGE : ecriture certificats restreinte au staff.
  - **Reste (MOYEN)** : la lecture du bucket `certificates` est encore publique (`getPublicUrl` cote front, `useDocumentsFetch.ts:144` ; `generate-certificates:732`). Une attestation nominative est telechargeable par qui connait le chemin `trainingId/fichier`. Fermeture = passer le bucket prive + URLs signees, chantier front+edge separe (pas fait pour ne pas casser l'affichage).
- **F6 (MOYEN, anon)** Bucket `learner-photos` : upload anon non borne + lecture publique (`20260519140000_learner_profiles.sql:45,48`). Meme correctif que B2 (identite = session/token, bucket prive). Couple a la bascule apprenant (F1).

### Priorite 3 - RLS metier
- ~~**F2**~~ CORRIGE : `missions` etait lisible par anon + tout authenticated (3 policies permissives non supprimees, dont une en role PUBLIC, plus `missions_org_isolation` en `USING(true)` mono-tenant, plus des writes en `auth.uid() IS NOT NULL`). Toutes re-bornees a `is_staff_user()`.
- **F5 (HAUT, authenticated non-staff)** : ~50 tables `authenticated` avec `USING(true)`, sans garde `is_staff_user()`.
  - **Precision de modele (verifiee)** : `is_staff_user()` est correctement defini depuis `20260612154854` : `auth.uid() IS NOT NULL AND (profiles.is_admin OR EXISTS user_module_access)`. Donc un compte auto-inscrit sur `/signup` (ni admin, ni acces module) et un apprenant (`role='learner'`, sans grant) sont bien NON staff. Le self-signup ne donne donc PAS un acces staff par lui-meme. La faille F5 est que ces tables precises ne consultent pas `is_staff_user()` du tout : tout `authenticated` (dont un auto-inscrit) y accede.
  - **Vague 1 CORRIGE** (`20260922130000_hardening_rls_f5_wave1.sql`) : `document_embeddings` (corpus RAG), `transcripts`, `testimonials`, `indexation_queue` re-bornes a `is_staff_user()`. Aucun parcours apprenant/public ne les lit (verifie) ; writes en service_role inchanges.
  - **Reste : essentiellement DEJA REMEDIE (verifie en etat final).** La liste "~50 tables" de l'audit est en tres grande majorite composee de faux positifs : ces tables ont ete durcies par les sweeps systematiques `20260529110000_fix_open_authenticated_policies.sql`, `20260701102838` et `20260709162851`, `20260729104403`. Verifie table par table en etat final :
    - CRM (`crm_cards`, `crm_comments`, `crm_activity_log`, `crm_card_emails`, `crm_attachments`) : gardes par `has_crm_access(auth.uid())`.
    - Financier / tokens (`game_sales`, `game_expenses`, `order_items`, `partner_payments`, `partner_access_tokens`) : gardes par "Staff/Admin manage".
    - `evaluation_analyses`, `improvements`, `ideas`, `coaching_summaries` : gardes par `is_staff_user()` / "staff_all".
    - `coaching_bookings` : `staff_all` + `learner_own` (apprenant voit ses propres reservations).
  - **Ecritures** de ~50 tables staff deja bloquees aux non-staff par le garde RESTRICTIVE `staff_only_insert/update/delete` (`20260521140000_learner_write_guard.sql`). Ne restait que la lecture de quelques tables hors sweeps, traitee par la vague 1.
  - **Conclusion** : pas de gros lot F5 residuel. Toute table nouvellement creee doit naitre gardee (voir Ratchet).

### Priorite 4 - Edge functions restantes
- ~~**E2 `send-action-reminder`**~~ CORRIGE (garde `isInternalOrAuthenticated`).
- **E3 `send-support-notification` (HAUT)** : relais. Appele depuis `Support.tsx`, `LearnerPortal.tsx` ET `FeedbackForm.tsx` (`src/services/support.ts`). NON garde car la soumission de ticket peut venir d'un contexte apprenant/anonyme : garder casserait le support. Correctif cible : deriver le destinataire du DB (jamais du body), garder par type d'action (les branches copy/notification staff peuvent exiger le staff, la soumission reste ouverte).
- **E6 Deni de portefeuille (MOYEN)** : `summarize-needs-survey`, `analyze-needs-survey`, `enrich-idea` (ecrit aussi en base), `extract-objectives-from-pdf`, `generate-convention-formation` (PDFMonkey)... Correctif : `isInternalOrAuthenticated` pour les fonctions appelees par l'UI/cron ; pour celles derriere un formulaire public tokenise (evaluations, sondages), garder par token valide, PAS par auth.
- **E7 Ecriture/comptes service_role (MOYEN)** : ~~`cleanup-pending-email-drafts`, `force-send-scheduled-email`~~ CORRIGES (garde `isInternalOrAuthenticated`). Restent : `upload-learner-photo` (retirer `skipAuth`, identite = session/token, cf. B2), `create-academy-account` (rate-limit + captcha + reponse non-enumerante).
- **E8 Crons sans garde (BAS)** : ~25 fonctions `process-*` / `backfill-*`. Le helper `isInternalOrAuthenticated` est pret. Rollout : pour chaque fonction, confirmer que son cron/delegation envoie bien `Authorization: Bearer <service_role>` (pattern verifie sur cleanup, process-scheduled-emails, process-action-reminders) puis ajouter la garde. Ne pas garder les process-* qui seraient aussi declenches par un flux public.

### Priorite 5 - Durcissements cibles
- **D3 (MOYEN)** Injection de prompt indirecte : l'agent indexe `inbound_emails` / `crm_email` (contenu externe) et peut declencher `execute_action` (ecritures CRM/mission/ticket en service_role) sans confirmation. Correctif : delimiter le contenu recupere comme donnees non fiables, exiger une confirmation humaine avant tout `execute_action` mutant, restreindre les sources indexees exposees a l'agent.
- **F10 (BAS)** `agent_sql_query` a perdu son `SET search_path` (`20260728120000_...:15`, regression). Correctif minimal et sur : `ALTER FUNCTION public.agent_sql_query(...) SET search_path = pg_catalog, public;` (sans redefinir le corps). Idem F11 : `enqueue_indexation`, `recompute_opportunity_estimated_value`.
- **Webhooks statiques (BAS-MOYEN)** : `assemblyai-webhook:46`, `fireflies-webhook:103` utilisent un jeton statique (pas de HMAC lie au body, pas d'anti-rejeu), comparaison non constant-time. Durcir : HMAC du body + horodatage anti-rejeu + comparaison constant-time.
- ~~**B1 `generate-attendance-pdf`**~~ CORRIGE (garde `isInternalOrAuthenticated`).
- **B3 `book_share_links`** : pas d'expiration. Ajouter `expires_at`.
- **CORS** : `_shared/cors.ts:9` defaut `*`. Risque reel FAIBLE (auth Bearer, pas de cookie) mais amplificateur pour les fonctions non gardees. Fixer `APP_ORIGIN` en prod (variable d'env, pas de changement de code). Le vrai correctif reste les gardes d'auth.

---

## Chaines d'exploitation

1. **Vol de donnees apprenant (anon -> PII complete)** : F1 (en-tete `x-learner-email: victime`) + A2/tables portail (RLS `to anon` sur `learner_email = get_learner_email()`) = lecture de tous les depots, messages, notifications, soumissions de la victime, et ecriture/suppression au nom de la victime. Point d'entree : cle publishable du bundle. Impact : violation RGPD/Qualiopi.
2. **Exfiltration d'emails historiques (anon)** : E1 `resend-logged-email` avec un `logId` enumere + `recipientOverride` = recuperation de reset password, acces apprenant, factures. **Ferme cette PR.**
3. **Fuite de documents clients (anon)** : F3 bucket `mission-documents` `SELECT TO public` = telechargement direct via l'API storage de tout document de mission confidentiel.
4. **Deni de portefeuille (anon)** : E6, appel en boucle d'une fonction IA sans garde (`enrich-idea` batch 25) = facture IA + ecriture en base amplifiee.

---

## Paraît dangereux mais borne

- `mission_documents` (la TABLE) `SELECT to public` est bornee par `auth.role()='authenticated'` (`20260226100000:15`) : c'est le bucket storage (F3), pas la table, qui fuit.
- `content_cards/columns/reviews` `to public` bornes par `has_module_access(auth.uid(),'contenu')`, faux pour anon.
- `network_*/google_tokens/profiles` `to public` bornes par `auth.uid() = user_id`, anon exclu.
- `get_learner_portal_data(text)` : GRANT anon residuel mais le corps leve `RAISE EXCEPTION 'Authentification requise'` sans JWT (`20260914150000:56-59`). Le vecteur reel est l'acces direct aux tables (F1+A2), pas ce RPC.
- Secrets frontend : `rg VITE_ src` ne montre que URL + publishable key (anon, attendue) + Sentry DSN (public). Aucune service key cote client.
- `query_database` agent : SELECT/WITH seulement, allowlist de tables via EXPLAIN, colonnes masquees, LIMIT 100. Injection ne peut pas ecrire par ce canal.

---

## Angles morts (a tester en dynamique, sur staging, jamais la prod)

- Confirmer que le self-signup Supabase est desactive (mitige F5). Sinon, tester la creation d'un compte authenticated non-staff et la lecture de `document_embeddings`, `transcripts`, `crm_settings`.
- Confirmer en dynamique l'usurpation F1 avec un compte de test (en-tete `x-learner-email` d'un apprenant de test).
- Verifier le plumbing des crons (E8) : le SQL de chaque `cron.schedule` passe-t-il l'en-tete `x-cron-secret`/`x-internal-secret` avant d'ajouter `isInternalCall` ?
- Verifier les appelants anonymes possibles de `send-support-notification` (formulaire feedback public ?) avant de le garder.

---

## Ratchet (anti-regression)

Convention CLAUDE.md : chaque classe de faille corrigee devient un check dans `scripts/check-rules.sh`. Candidats :
- Une fonction d'envoi d'email (`send-*`, `notify-*`, `resend-*`) verify_jwt=false doit appeler `verifyAuth` ou `isInternalCall` en tete de handler.
- Aucun nouveau `dangerouslySetInnerHTML` sans `DOMPurify.sanitize`.
- Aucune policy `USING (true)` / `WITH CHECK (true)` sur une table ou un bucket sensible.
