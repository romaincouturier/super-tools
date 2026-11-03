# Revue adversariale : ARCHITECTURE-SPINE super-tools (2026-09-24)

Lentille : construire des paires d'unités qui respectent chaque AD à la lettre et produisent pourtant un système incohérent. Chaque paire est ancrée dans le code à `fea1468`+ (état du dépôt au 24/09/2026). Chaque paire est un trou ; la section « Règle proposée » donne le texte exact à ajouter ou durcir.

## Verdict

La spine verrouille bien le **qui a le droit** (AD-1 à AD-4) et le **par où on passe** (AD-5 à AD-7), mais ne dit jamais **qui possède** une entité, un effet de bord ou un vocabulaire. Résultat : deux unités parfaitement conformes peuvent créer le même participant, programmer le même email, changer la même adresse ou calculer le même montant de deux façons incompatibles, et le code actuel le fait déjà. Six trous, dont deux critiques.

| # | Trou | Sévérité | AD à créer / durcir |
| --- | --- | --- | --- |
| T1 | Plusieurs créateurs de `training_participants`, effets de bord divergents | Critique | AD-11 (nouveau) |
| T2 | Emails : trois files, trois vocabulaires, deux sémantiques d'annulation | Critique | AD-12 (nouveau) |
| T3 | Identité apprenant : deux chemins de changement d'adresse, trois définitions du staff | Haute | AD-2 (durci) |
| T4 | Valeur d'opportunité dérivée d'un journal, HT et TTC mélangés, trois écrivains | Haute | AD-13 (nouveau) |
| T5 | Règles métier jumelles front / edge sans contrôle d'égalité | Moyenne | AD-14 (nouveau, généralise [057]) |
| T6 | Lovable contre Claude : schéma et jobs hors dépôt, contrôles non bloquants sur `main` | Moyenne | AD-8 et AD-10 (durcis) |

---

## T1 : Deux (en fait quatre) propriétaires de `training_participants` [Critique]

### Paire

- **Unité A** : `supabase/functions/add-training-participant/index.ts`, appelée par `src/hooks/useAddParticipant.ts:69` et par `supertilt-webhook/index.ts:561`. Edge function authentifiée (AD-4 respecté), service role côté serveur (AD-3), appelée par `useEdgeFunction`/hook (AD-5), email normalisé `trim().toLowerCase()` (l. 284, [059]).
- **Unité B** : `src/services/bulkParticipants.ts:27-80` (`insertParticipantsWithQuestionnaires`), appelée depuis `BulkAddParticipantsDialog.tsx:56`. Passe par un service (AD-5 respecté), insert sous RLS staff (AD-1), email en minuscules via `useParticipantParser.ts:85` ([059] respecté).
- Unités C et D : `submit-devis-signature/index.ts:78-120` (lien public à token, AD-4 respecté) et `src/services/participants.ts:51` `createParticipant` (plus appelée que par ses tests).

### Pourquoi ça casse

Chaque chemin décide seul des effets de bord de la création :

| Effet | A (edge) | B (bulk front) | C (signature devis) |
| --- | --- | --- | --- |
| `questionnaire_besoins` | oui (l. 395) | oui | oui (l. 126) |
| `scheduled_emails` needs_survey + relance + « formation approche » | oui (l. 412-480) | needs_survey seul | aucun |
| Convocation welcome | voir ci-dessous | J-7 programmée | aucune |
| `trainer_summary` | oui (l. 506-528) | via `src/lib/workingDays.ts:139-160` | non |
| Compte apprenant `ensureLearnerAccount` | oui (l. 606) | non | non |
| Rattrapage mi-session [025] | oui | via le dialog | non |

Plus grave, la même règle « quand envoyer la convocation » existe deux fois et diverge :

- Front `src/lib/emailScheduling.ts:17-37` `getEmailMode` : plus de 7 jours avant le début rend `status: "programme"`.
- Edge `add-training-participant/index.ts:55-79` `computeEmailMode` : dès 2 jours avant le début rend `accueil_envoye` + `sendWelcomeNow: true`. `programme` n'est rendu que sans date.

Conséquence mesurable dans le code : la branche « Convocation J-7 » (l. 483-501, condition `emailStatus === "programme"`) est **morte** dès qu'une date existe, et un participant ajouté à J-30 via l'unité A reçoit sa convocation immédiatement (l. 535-541), alors que le même participant ajouté via l'unité B l'aurait reçue à J-7. Le commentaire l. 483 (« uniquement quand la formation est à plus de 7 j (status "programme") ») prouve que l'auteur croyait appliquer la sémantique front.

Côté base, deux triggers ajoutent leurs propres effets sans concertation : `trg_auto_enroll_participant_lms` (M20260421120000:44-56, `lower(NEW.email)` sans `trim`, sur INSERT seulement) et `trg_sync_learner_profile_name` (M20260918123152:31, `lower(trim(...))`, sur INSERT et UPDATE). `_shared/reconcile-welcomes.ts` existe précisément pour rattraper les chemins qui n'ont pas programmé la convocation.

Aucune AD n'est violée : AD-5 dit « par un hook », pas « par le propriétaire ».

### Règle proposée

> ### AD-11 : Une entité à cycle de vie a un seul propriétaire d'écriture [NOUVEAU]
>
> - **Binds:** all
> - **Prevents:** deux chemins de création ou de transition d'une même entité qui déclenchent des effets de bord différents.
> - **Rule:** Toute entité dont la création ou le changement d'état déclenche des effets de bord (emails, inscriptions, documents, comptes) a **un seul propriétaire**, déclaré dans la table « Propriétaires » de cette spine : une edge function ou une fonction SQL `SECURITY DEFINER`. Tous les points d'entrée (dialog unitaire, import en masse, webhook, lien public, MCP, agent) appellent ce propriétaire ; aucun n'écrit la table en direct. Les effets de bord vivent dans le propriétaire ou dans un trigger de la table, jamais chez l'appelant. La policy RLS `INSERT` de la table est retirée au rôle `authenticated` pour que le front ne puisse pas contourner le propriétaire. Vérification : `check-rules.sh` refuse tout `.from("<table>").insert|upsert` hors du fichier propriétaire.
>
> | Entité | Propriétaire création | Propriétaire transitions |
> | --- | --- | --- |
> | `training_participants` | `add-training-participant` (mode unitaire et lot) | idem ; adresse : `change_learner_email()` (AD-2) |
> | `scheduled_emails` | voir AD-12 | voir AD-12 |
> | `quotes` / micro-devis / devis jeu | à trancher (T4) | idem |
> | `crm_cards.estimated_value` | `recompute_opportunity_estimated_value()` | idem |

Correctifs induits : `bulkParticipants.ts` appelle `add-training-participant` en mode lot ; `submit-devis-signature` aussi ; `createParticipant` supprimée ; `computeEmailMode` et `getEmailMode` fusionnent côté serveur (voir T5).

---

## T2 : Emails, trois files et trois vocabulaires [Critique]

### Paire 2a : deux sémantiques d'annulation

- **Unité A** : `src/components/formations/ScheduledEmailsSummary.tsx:530-533` et `LiveMeetingsSection.tsx` annulent un email programmé par `DELETE` (existant, toléré par le ratchet AD-5).
- **Unité B** : `supabase/functions/force-send-scheduled-email/index.ts` annule par `update({ status: "cancelled" })` (4 occurrences).
- **Unité C** : `monitor_missing_evaluation_reminders()` (M20260428181041:1-60) recrée `evaluation_reminder_1` et `_2` quand `NOT EXISTS` une ligne de ce type.

Avec A, un rappel supprimé par l'utilisateur est recréé par C au prochain passage ; avec B, il ne l'est pas. Même action métier, deux effets. (Le `cron.schedule` de C n'est pas dans `supabase/migrations/`, cf. T6 : le comportement réel dépend d'un job invisible depuis le dépôt.)

### Paire 2b : trois vocabulaires pour « la convention est partie »

- `sent_emails_log.email_type = "convention"` (`send-convention-email/index.ts:309`, via `_emailType`).
- `activity_logs.action_type = "convention_email_sent"` (`send-convention-email/index.ts:320`, lu par `check-convention-status/index.ts:74`).
- `scheduled_emails.email_type = "convention_email"` (CHECK de M20260428193252:5-15).

Une unité qui programme (`convention_email`), une qui vérifie l'envoi (`convention_email_sent`) et une qui audite Qualiopi (`convention`) ne peuvent pas se joindre. 13 fonctions appellent `sendEmail()` sans `_emailType` : leurs envois sont dans `sent_emails_log` sans type, donc invisibles pour toute règle qui, comme `monitor_missing_evaluation_reminders`, déduit l'état d'un participant de `sent_emails_log.email_type`.

### Paire 2c : deux files programmées, une sans consommateur

- `scheduled_emails` : consommée par `process-scheduled-emails` et `force-send-scheduled-email`.
- `crm_scheduled_emails` : produite par `src/components/crm/card-detail/CardDetailCommunication.tsx:112` (insert depuis un composant, erreur Supabase non lue, toast « Email programmé » même en échec), créée deux fois (M20260224170200 et M20260714102508, la seconde par Lovable). **Aucune edge function ni job du dépôt ne la lit** (`grep crm_scheduled_emails supabase/functions` ne trouve que les listes de backup).
- `okr_scheduled_emails` (M20260204240000:95) : aucune référence dans le code.

### Paire 2d : dédoublonnage par lecture-puis-écriture

`scheduled_emails` n'a aucun index unique (seuls `idx_scheduled_emails_pending` et `idx_scheduled_emails_training`, M20260130095417:165-166). Au moins six écrivains dédoublonnent par `select` puis `insert` : `add-training-participant` (trainer_summary l. 509-520), `src/lib/workingDays.ts:139-157`, `bulkParticipants.ts:127/156`, `_shared/reconcile-welcomes.ts`, `_shared/reconcile-needs-survey.ts`, `monitor_missing_evaluation_reminders()`. Deux appels concurrents programment deux convocations.

Toutes ces unités respectent AD-6 (le transport Resend est bien unique dans `_shared/resend.ts`). AD-6 ne couvre que le dialogue avec le tiers, pas la file, le type ni le journal.

### Règle proposée

> ### AD-12 : Un email métier = un type, une file, un journal [NOUVEAU]
>
> - **Binds:** supabase/functions, supabase/migrations, src
> - **Prevents:** des emails envoyés deux fois, jamais, ou impossibles à tracer, parce que chaque module a sa file et son vocabulaire.
> - **Rule:**
>   - Les types d'email vivent dans une seule table de référence `email_types` (ou un enum Postgres) ; `scheduled_emails.email_type`, `sent_emails_log.email_type` et tout `activity_logs.action_type` d'envoi y font référence par clé étrangère. `sendEmail()` rend `_emailType` obligatoire (type TypeScript non optionnel).
>   - Un email différé passe par la seule file `scheduled_emails`, consommée par `process-scheduled-emails`. Toute nouvelle file `*_scheduled_emails` est interdite ; une file existante sans consommateur dans le dépôt est une violation.
>   - La file a un index unique partiel `(training_id, participant_id, email_type) WHERE status = 'pending'` ; les écrivains font `insert ... on conflict do nothing`, jamais `select` puis `insert`.
>   - Une annulation est une transition `status = 'cancelled'`, jamais un `DELETE` ; tout rattrapage automatique (`reconcile-*`, `monitor_*`) ignore les lignes `cancelled`.
>   - L'état « envoyé » d'un email se lit dans `sent_emails_log` uniquement ; `activity_logs` est un journal d'affichage, aucune règle ne s'y adosse.
>   - Vérification : `check-rules.sh` refuse `CREATE TABLE .*scheduled_emails` hors `scheduled_emails`, `.from("scheduled_emails").delete(`, et tout appel `sendEmail({` sans `_emailType`.

---

## T3 : Identité apprenant, deux chemins de changement d'adresse [Haute]

### Paire

- **Unité A** : `manage-learner-account/index.ts:164` appelle `change_learner_email()` (M20260915100000_lot6_adresse_indicateurs.sql:49-107), qui déplace l'adresse dans 27 tables (participants, questionnaires, évaluations, `lms_*`, `practice_*`, `group_matching_*`...) et invalide les liens magiques. Testé par `supabase/tests/changement-adresse.test.ts`.
- **Unité B** : `src/hooks/useEditParticipant.ts:242/291` → `src/services/participants.ts:325-333` `updateParticipant()` écrit `email: v.email.trim().toLowerCase()` directement dans `training_participants` (auto-save).

Les deux normalisent ([059] respecté), les deux passent par hook/service ou edge (AD-5), les deux sont sous RLS (AD-1). Mais B déplace l'adresse dans **une** table : `lms_enrollments`, `lms_progress`, `questionnaire_besoins`... restent sur l'ancienne, et le trigger `trg_sync_learner_profile_name` (M20260918123152:31) crée un **second** `learner_profiles` pour la nouvelle adresse. L'apprenant se connecte avec la nouvelle adresse et perd sa progression, sans erreur, exactement le cas décrit par [059].

La liste des 27 tables de `change_learner_email()` est tenue à la main. Aujourd'hui elle couvre toutes les tables porteuses de `learner_email`/`author_email` sauf `crm_comments` et `mission_page_comments` (staff), mais rien n'empêche une nouvelle table LMS d'être oubliée.

### Paire annexe : trois définitions du staff

- `is_staff_user()` (M20260612154854:4-16) : `is_admin` ou ligne `user_module_access`.
- `SessionProvider.tsx:62-73` : `current_user_access_level()` via `fetchAccessLevel` (conforme AD-2).
- `src/hooks/useLearnerIdentity.ts:34-43` : « staff » = une ligne `profiles` existe. Un ancien collaborateur avec `profiles` mais sans module est staff pour ce hook (le paramètre `?email=` l'emporte sur la session, `resolveLearnerEmail` l. 13-21) et non-staff pour la base.

AD-2 dit d'où vient le statut mais n'interdit pas de le recalculer.

### Règle proposée (durcissement d'AD-2)

> Ajouter à **AD-2** :
>
> - L'adresse d'un apprenant ne change que par `change_learner_email()`. Aucun `update` de la colonne `email` de `training_participants`, `learner_profiles` ou d'une colonne `learner_email`/`author_email` n'est permis ailleurs ; le formulaire d'édition de participant appelle `manage-learner-account` quand l'adresse change. Un trigger `BEFORE UPDATE OF email` sur `training_participants` lève une exception hors de `change_learner_email()` (drapeau `set_config('app.email_move', 'on', true)`).
> - Toute colonne `learner_email` ou `author_email` créée en migration figure dans `change_learner_email()` ; `check-rules.sh` compare la liste des colonnes créées à la liste des `UPDATE` de la fonction.
> - La normalisation SQL est `lower(trim(x))`, jamais `lower(x)` seul, dans tout trigger ou fonction qui écrit une adresse (corrige `auto_enroll_participant_in_lms`).
> - Le statut staff/apprenant ne se recalcule jamais : côté front, `useSession().status` et `isStaff` ; côté base, `is_staff_user()` / `current_user_access_level()`. Une lecture de `profiles` pour déduire le statut est une violation (`useLearnerIdentity` à corriger).

---

## T4 : Valeur d'opportunité, trois écrivains et deux unités monétaires [Haute]

### Paire

- **Unité A** : `quotes_recompute_on_sent()` + `recompute_opportunity_estimated_value()` (M20260420120000, réécrite M20260701120000:30-80) calcule `crm_cards.estimated_value = MIN(quotes.total_ttc, activity_logs.details->>'total_amount' des micro_devis_sent, idem game_devis_sent)`.
- **Unité B** : `generate-micro-devis/index.ts:618-632` écrit `total_amount` = **HT** (« Compute total amount (HT) ») ; `generate-game-devis/index.ts:140-148` écrit `total_amount: totalHT`.
- **Unité C** : `src/hooks/crm/useUpdateCard.ts`, `useCreateCard.ts` et `_shared/crm-tools.ts:387` (MCP `update_opportunity`) écrivent `estimated_value` à la main.

La fonction compare un TTC à des HT et garde le plus petit : dès qu'une carte a un devis complet et un micro-devis, la valeur affichée est le HT du micro-devis, sous-estimée de 20 %. Et C peut écraser la valeur calculée, que A réécrira au prochain devis envoyé. L'état métier « montant proposé » est porté par un JSON d'`activity_logs` au lieu d'une table typée ; le micro-devis et le devis jeu ne sont pas dans `quotes`.

Chaque unité respecte AD-1 (RLS), AD-3, AD-4, AD-5. Aucune AD ne parle de colonnes dérivées ni d'unité monétaire.

### Règle proposée

> ### AD-13 : Une valeur dérivée a un seul calcul, un montant a une unité dans son nom [NOUVEAU]
>
> - **Binds:** supabase/migrations, supabase/functions, src
> - **Prevents:** une colonne calculée écrasée à la main, un HT comparé à un TTC, un état métier caché dans un journal.
> - **Rule:**
>   - Une colonne dérivée (ex. `crm_cards.estimated_value`) est écrite par une seule fonction SQL, déclarée en commentaire `COMMENT ON COLUMN ... IS 'derived: <fonction>'` ; aucun hook, service, outil MCP ou agent ne l'écrit. Si une saisie manuelle est voulue, elle vit dans une autre colonne (`estimated_value_manual`) et la règle de priorité est dans la fonction.
>   - Toute colonne ou clé JSON de montant porte son unité dans son nom : `_ht`, `_ttc`, `_cents`. `total_amount` sans suffixe est interdit dans une nouvelle migration ou un nouvel `insert`.
>   - Un état métier (devis émis, montant proposé, signature) vit dans une table typée ; `activity_logs.details` n'est jamais lu par une fonction SQL ou une policy.
>   - Vérification : `check-rules.sh` refuse `details->>` dans `supabase/migrations/` postérieures à la date d'adoption, et `estimated_value` dans un `update` hors migration.

---

## T5 : Règles métier jumelles front / edge [Moyenne]

### Paire

| Règle | Front | Edge | Divergence constatée |
| --- | --- | --- | --- |
| Mode de convocation | `src/lib/emailScheduling.ts:17` `getEmailMode` | `add-training-participant/index.ts:55` `computeEmailMode` | branche > 7 j absente côté edge (T1) |
| Jours ouvrés et récap formateur | `src/lib/workingDays.ts` (`scheduleTrainerSummaryIfNeeded`) | `_shared/working-days.ts` + `add-training-participant` l. 506 | API différente, dédoublonnage dupliqué |
| Transitions de signature | `src/lib/stateMachine.ts` | `_shared/state-machine.ts` (« Mirrors src/lib/stateMachine.ts ») | aucun contrôle d'égalité |
| Normalisation email | `normalizeEmail` | `normalizeLearnerEmail` | contrôlée par [059b], seul cas couvert |

[057] ne vérifie que les ids de modèles ; [059b] que les normaliseurs. Toute autre règle métier copiée entre les deux runtimes dérive en silence, et AD-6 (« un tiers, un adaptateur ») ne couvre pas la logique métier interne.

### Règle proposée

> ### AD-14 : Une règle métier s'exécute d'un seul côté [NOUVEAU]
>
> - **Binds:** src, supabase/functions
> - **Prevents:** deux implémentations d'une même règle (calendrier d'envoi, transitions d'état, calculs de délai) qui divergent entre le navigateur et les edge functions.
> - **Rule:** Une règle qui décide d'un effet de bord (envoi, programmation, transition d'état, montant) s'exécute côté serveur (edge function propriétaire ou SQL) ; le front n'en garde qu'un affichage indicatif, calculé par un appel au serveur ou par le même module importé. Quand une copie est inévitable (Deno et Vite ne partagent pas de module), les deux fichiers portent l'en-tête `// twin: <chemin de l'autre>` et un jeu de vecteurs de test commun (`*.twin.json`) est joué par les deux suites ; `check-rules.sh` refuse un en-tête `twin` sans vecteurs, et un commentaire « Mirrors » sans en-tête `twin`.

---

## T6 : Lovable contre Claude, ce que la machine ne voit pas [Moyenne]

### Paire

- **Unité A (Lovable)** : 447 des 757 migrations portent un nom `AAAAMMJJhhmmss_<uuid>` (générées par Lovable). Exemple : M20260714102508 recrée `crm_scheduled_emails` déjà créée par M20260224170200 (autre auteur), avec des policies ciblant `TO authenticated` au lieu de sans rôle. Lovable pousse sur `main` sans PR (AGENTS.md), donc les checks d'AD-10 tournent après coup et ne bloquent rien. Lovable écrit aussi dans les composants (`CardDetailCommunication.tsx:92/112/132`, 23 casts `as unknown as { from ... }` dans `src/` pour contourner le typage).
- **Unité B (Claude)** : respecte `check-rules.sh` sur sa branche, mais sa PR rebase sur un `main` qui a déjà régressé.

Et le schéma réel n'est pas entièrement dans le dépôt : `monitor_missing_evaluation_reminders()` est révoquée/accordée (M20260915090829:24) mais aucun `cron.schedule` ne la déclenche dans `supabase/migrations/` (31 `cron.schedule` au total, aucun ne la vise). Soit elle ne tourne pas, soit elle est programmée à la main en base, contre AD-8. Une unité qui raisonne sur le dépôt et une qui raisonne sur la base voient deux systèmes.

### Règles proposées (durcissement d'AD-8 et AD-10)

> Ajouter à **AD-8** :
>
> - Une table n'a qu'un seul `CREATE TABLE` dans l'historique ; une migration qui répare une base divergente utilise `ALTER` et cite la migration d'origine. `check-rules.sh` refuse deux `CREATE TABLE [IF NOT EXISTS] <nom>` pour un même nom.
> - La liste des jobs `pg_cron` actifs en base est relevée par un script (`scripts/snapshot-cron.sql`) et comparée aux `cron.schedule` du dépôt ; un job présent en base et absent du dépôt est un écart à corriger par migration, pas une configuration.
>
> Ajouter à **AD-10** :
>
> - Les checks de `check-rules.sh` tournent aussi sur chaque push sur `main` (workflow `on: push: branches: [main]`) et ouvrent un ticket support quand un ratchet remonte ; la régression introduite par Lovable devient visible le jour même, pas au prochain rebase.
> - Les ratchets comptent aussi les casts `as unknown as { from` dans `src/` (contournement du typage généré, AD-8).

---

## Paires examinées sans trou retenu

- **Transport email** : un seul appel à `api.resend.com`, dans `_shared/resend.ts`. AD-6 tient.
- **Normalisation à l'entrée** : tous les chemins d'insertion de participants trouvés normalisent l'adresse ; le trou est dans les triggers SQL (T3) et dans les chemins de mise à jour, pas à l'entrée.
- **Couverture de `change_learner_email()`** : toutes les tables apprenant porteuses d'une adresse sont couvertes aujourd'hui ; le trou est l'absence de contrôle (T3).

## Actions dans l'ordre

1. T1 + T2 : corriger `computeEmailMode` (convocation immédiate à J-30), ajouter l'index unique partiel sur `scheduled_emails`, transformer les `DELETE` d'annulation en `cancelled`. Puis adopter AD-11 et AD-12.
2. T3 : router le changement d'adresse du formulaire participant vers `change_learner_email()`, corriger `lower()` sans `trim` dans `auto_enroll_participant_in_lms`.
3. T4 : aligner HT/TTC dans `recompute_opportunity_estimated_value()`.
4. T2c : décider du sort de `crm_scheduled_emails` (consommateur ou suppression de la fonctionnalité) et de `okr_scheduled_emails`.
5. T5, T6 : ajouter les checks.
