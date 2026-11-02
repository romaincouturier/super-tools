# Refonte des demandes d'avis / témoignages : de l'email automatique au signal

## 1. Analyse d'impact (état constaté le 15/10/2026)

### Ce qui alimente « Emails à valider »
- Une seule table : `mission_email_drafts`. Ni `scheduled_emails` ni `crm_scheduled_emails` n'y apparaissent.
- Un seul producteur : la fonction quotidienne `process-mission-testimonials` (cron 05h15). Elle crée des brouillons `google_review` (J+2 après fin de mission), puis `video_testimonial` (J+4 après l'avis).
- Contenu actuel : 21 avis Google à traiter (18 en attente, 3 programmés au 01/09/2026), 3 rejetés, 12 avis et 5 témoignages vidéo déjà envoyés.
- Conclusion : le module ne sert qu'aux demandes d'avis/témoignages des **missions**. Il peut être décommissionné.

### Circuit séparé, côté formations (important)
Les formations n'utilisent PAS ce module. `send-thank-you-email` programme dans `scheduled_emails` des emails `google_review` et `video_testimonial` (J+N jours ouvrés), envoyés **sans validation** par `process-scheduled-emails` / `force-send-scheduled-email`. Historique : 78 avis et 70 vidéos envoyés ; **8 témoignages vidéo encore en attente d'envoi**. Ce circuit doit aussi être coupé pour respecter le point 2.

### Ce qui dépend du mécanisme
- Fonctions : `process-mission-testimonials` (+ cron), `send-mission-email-draft`, `cleanup-pending-email-drafts` (+ cron 03h00), branches `google_review` / `video_testimonial` de `force-send-scheduled-email` et de `send-thank-you-email`.
- Récap quotidien : `generate-daily-actions` (action pointant vers `/emails-a-valider`), `process-logistics-reminders` (liste des brouillons), `daily-data-fetchers.ts` (lecture de `mission_email_drafts`).
- Écran : page `EmailsAValider`, `EmailDraftsList`, `useMissionEmailDrafts`, badge `useEmailDraftsAlert`, entrée de menu dans `AppSidebar`, route dans `App.tsx`.
- Missions : `missions.testimonial_status` (32 pending, 12 google_review_draft, 2 video_testimonial_draft, 6 completed) et `testimonial_last_sent_at`, utilisés par le kanban missions (`MissionsKanbanBoard`).
- Réglages : 4 délais (`delay_google_review_days`, `delay_video_testimonial_days`, `delay_mission_*`) dans Paramètres > Délais.
- Modèles : `google_review_tu/vous`, `video_testimonial_tu/vous` (+ variantes `mission_google_review*` côté code).
- Formations : `ScheduledEmailsSummary` et `EmailTimelineComputed` affichent ces emails dans la chronologie.
- Sauvegarde : `scheduled-backup` / `backup-export` listent `mission_email_drafts`.

### Ce qu'il ne faut surtout pas toucher (Qualiopi)
Ces envois sont dans `scheduled_emails` et restent inchangés :
- évaluations à chaud et relances (`evaluation_reminder_*`) ;
- **évaluations à froid** (`cold_evaluation`, 2 en attente) et évaluations commanditaires ;
- `follow_up_news` (25 en attente), remerciement et certificats ;
- appréciations des parties prenantes et réclamations (circuits distincts).
Les avis Google / témoignages vidéo sont du marketing, pas une preuve Qualiopi : leur suppression ne retire aucun indicateur.

## 2. Plan de migration

**Étape 1 — Arrêter les envois automatiques (aucune perte)**
- Désactiver les crons `process-mission-testimonials-daily` et `cleanup-pending-email-drafts`.
- `send-thank-you-email` ne programme plus `google_review` / `video_testimonial`.
- Les 8 `video_testimonial` en attente dans `scheduled_emails` passent en `cancelled` avec motif, au lieu d'être envoyés.

**Étape 2 — Créer les signaux**
- Nouvelle table `testimonial_requests` : mission ou formation, contact (mission_contact ou participant), type (avis / recommandation / témoignage écrit / vidéo), statut (à faire, fait, abandonné), date faite, note, origine.
- Création automatique d'un signal à la fin d'une mission (par contact principal) et après la formation (par commanditaire / participants selon règle à valider), au lieu des emails.
- Récap quotidien : section « Demander un avis / témoignage à [contact] (mission/formation X) » avec liens vers la mission ou la formation et le contact, intégrée aux actions quotidiennes et cochable comme faite.
- Outils MCP : `list_testimonial_requests` et `mark_testimonial_request` pour que l'assistant lise le contexte et clôture.

**Étape 3 — Vider la file actuelle**
- Les 21 brouillons `google_review` pending/scheduled deviennent 21 signaux « à faire » (contact et mission repris), brouillon passé en `converted` : rien n'est supprimé.
- `missions.testimonial_status` : `*_draft` ramenés à `pending` puis remplacés par le statut du signal.

**Étape 4 — Décommissionner**
- Retirer la page, le menu, le badge, la route et les hooks « Emails à valider ».
- Supprimer `process-mission-testimonials`, `send-mission-email-draft`, `cleanup-pending-email-drafts` et les branches avis/vidéo de `force-send-scheduled-email`.
- Retirer les 4 délais des Paramètres et les lignes avis/vidéo de la chronologie formation.
- Archiver (désactiver, pas supprimer) les 4 modèles d'emails.
- Garder `mission_email_drafts` en lecture seule (historique, sauvegarde), suppression éventuelle plus tard.

## Points à valider
1. Côté formations, un signal par commanditaire, par participant, ou seulement pour les participants très satisfaits ?
2. Délai d'apparition du signal (reprise des délais actuels J+2 mission / J+N formation, ou immédiat) ?
3. Un seul signal « avis / témoignage » par contact, ou un par type (Google, recommandation, vidéo) ?

## Détails techniques
- Migration : table + RLS (staff via `is_staff_user()` / module missions et formations), GRANTs, migration de données des 21 brouillons, contrainte `status` sur `mission_email_drafts` étendue à `converted`.
- Dé-programmation des crons via `cron.unschedule` en SQL.
- Mise à jour règle de contrôle si une règle référence `/emails-a-valider`.
- Aucun email envoyé pendant la migration ; vérification par requêtes de comptage avant/après.
