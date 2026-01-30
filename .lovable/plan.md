

# Plan d'implementation - Module de Gestion des Formations SuperTools

## Vue d'ensemble

Ce module ajoute une gestion complete des formations avec un systeme sophistique de recueil des besoins individuels conforme Qualiopi et RGPD.

---

## Architecture globale

```text
+------------------+     +-------------------+     +------------------+
|   Dashboard      | --> |  /formations      | --> | /formations/:id  |
|   (existant)     |     |  Listing          |     | Detail + Partici |
+------------------+     +-------------------+     +------------------+
                                   |                       |
                                   v                       v
                         +-------------------+     +------------------+
                         | /formations/new   |     | Gestion emails   |
                         | Creation          |     | automatiques     |
                         +-------------------+     +------------------+
                                                          |
                                                          v
                                                  +------------------+
                                                  | /besoins/:token  |
                                                  | Formulaire public|
                                                  +------------------+
```

---

## Phase 1 : Schema de base de donnees

### 1.1 Table `trainings` - Formations

| Colonne | Type | Requis | Description |
|---------|------|--------|-------------|
| id | uuid | PK | Identifiant unique |
| start_date | date | Oui | Date de debut |
| end_date | date | Non | Date de fin (si multi-jours) |
| training_name | text | Oui | Nom de la formation |
| location | text | Oui | Lieu |
| client_name | text | Oui | Nom du client |
| evaluation_link | text | Oui | Lien vers l'evaluation |
| program_file_url | text | Non | URL du programme uploade |
| prerequisites | text[] | Non | Liste des prerequis |
| format_formation | text | Non | 'intra', 'inter-entreprises', 'classe_virtuelle' |
| created_by | uuid | Oui | FK auth.users |
| created_at | timestamp | Oui | Date creation |
| updated_at | timestamp | Oui | Date modification |

### 1.2 Table `training_schedules` - Horaires par journee

| Colonne | Type | Requis | Description |
|---------|------|--------|-------------|
| id | uuid | PK | Identifiant unique |
| training_id | uuid | FK | Vers trainings |
| day_date | date | Oui | Date du jour |
| start_time | time | Oui | Heure de debut |
| end_time | time | Oui | Heure de fin |

### 1.3 Table `training_participants` - Participants

| Colonne | Type | Requis | Description |
|---------|------|--------|-------------|
| id | uuid | PK | Identifiant unique |
| training_id | uuid | FK | Vers trainings |
| first_name | text | Non | Prenom (optionnel) |
| last_name | text | Non | Nom (optionnel) |
| email | text | Oui | Email (obligatoire) |
| company | text | Non | Societe |
| needs_survey_token | text | Unique | Token JWT/UUID pour formulaire |
| needs_survey_status | text | Oui | 'non_envoye', 'envoye', 'en_cours', 'complete', 'valide_formateur', 'expire' |
| needs_survey_sent_at | timestamp | Non | Date d'envoi du recueil |
| added_at | timestamp | Oui | Date d'ajout |

### 1.4 Table `questionnaire_besoins` - Formulaire de recueil complet

| Colonne | Type | Requis | Description |
|---------|------|--------|-------------|
| id | uuid | PK | Identifiant unique |
| training_id | uuid | FK | Vers trainings |
| participant_id | uuid | FK | Vers training_participants |
| token | varchar(255) | Unique | Token d'acces securise |
| etat | varchar(50) | Oui | Etat du formulaire |
| **Section 1 - Identification** |||
| email | varchar(255) | Oui | Email |
| nom | varchar(100) | Oui | Nom |
| prenom | varchar(100) | Oui | Prenom |
| societe | varchar(150) | Oui | Societe |
| fonction | varchar(100) | Oui | Fonction |
| **Section 2 - Positionnement** |||
| experience_sujet | varchar(50) | Oui | 'aucune', 'courte', 'longue', 'certification' |
| experience_details | text | Non | Details experience |
| lecture_programme | varchar(50) | Oui | 'complete', 'partielle', 'non' |
| prerequis_validation | varchar(50) | Oui | 'oui', 'partiellement', 'non' |
| prerequis_details | text | Conditionnel | Obligatoire si != 'oui' |
| niveau_actuel | int | Oui | 0-10, slider |
| competences_actuelles | text | Non | Max 1000 car |
| **Section 3 - Objectifs** |||
| competences_visees | text | Oui | Max 1000 car |
| lien_mission | text | Oui | Max 1000 car |
| niveau_motivation | int | Oui | 1-5 |
| **Section 4 - Adaptation** |||
| modalites_preferences | jsonb | Non | Array de strings |
| besoins_accessibilite | text | Non | Max 1000 car |
| contraintes_orga | text | Non | Max 500 car |
| **Section 5 - Commentaires** |||
| commentaires_libres | text | Non | Max 2000 car |
| **Section 6 - RGPD** |||
| consentement_rgpd | boolean | Oui | Obligatoire pour soumettre |
| date_consentement_rgpd | timestamp | Non | Date du consentement |
| **Flags metier** |||
| necessite_validation_formateur | boolean | Non | Si prerequis non valides |
| necessite_amenagement | boolean | Non | Si besoins accessibilite |
| **Audit** |||
| date_envoi | timestamp | Non | Date envoi formulaire |
| date_premiere_ouverture | timestamp | Non | Premiere visite |
| date_derniere_sauvegarde | timestamp | Non | Derniere sauvegarde auto |
| date_soumission | timestamp | Non | Date soumission finale |
| date_validation_formateur | timestamp | Non | Validation formateur |
| created_at | timestamp | Oui | Creation |
| updated_at | timestamp | Oui | Modification |

### 1.5 Table `questionnaire_events` - Logs d'evenements

| Colonne | Type | Requis | Description |
|---------|------|--------|-------------|
| id | uuid | PK | Identifiant |
| questionnaire_id | uuid | FK | Vers questionnaire_besoins |
| type_evenement | varchar(50) | Oui | Type d'evenement |
| metadata | jsonb | Non | Donnees contextuelles |
| created_at | timestamp | Oui | Date evenement |

Types d'evenements: 'envoi_initial', 'premiere_ouverture', 'sauvegarde_auto', 'sauvegarde_manuelle', 'soumission', 'validation_formateur', 'email_confirmation_envoye', 'email_notification_envoye', 'expiration'

### 1.6 Table `scheduled_emails` - File d'attente emails

| Colonne | Type | Requis | Description |
|---------|------|--------|-------------|
| id | uuid | PK | Identifiant |
| training_id | uuid | FK | Vers trainings |
| participant_id | uuid | FK nullable | Vers participants |
| email_type | text | Oui | 'needs_survey', 'reminder_j7', 'needs_summary', 'thank_you' |
| scheduled_for | timestamp | Oui | Date/heure prevue |
| status | text | Oui | 'pending', 'sent', 'failed', 'cancelled' |
| sent_at | timestamp | Non | Date envoi effectif |
| error_message | text | Non | Message d'erreur si echec |

### 1.7 Table `program_files` - Bibliotheque programmes

| Colonne | Type | Requis | Description |
|---------|------|--------|-------------|
| id | uuid | PK | Identifiant |
| file_name | text | Oui | Nom du fichier |
| file_url | text | Oui | URL de stockage |
| uploaded_by | uuid | FK | Utilisateur |
| uploaded_at | timestamp | Oui | Date upload |

### 1.8 Politiques RLS

**trainings, training_schedules, training_participants, scheduled_emails, program_files:**
- SELECT/INSERT/UPDATE/DELETE pour utilisateurs authentifies

**questionnaire_besoins:**
- SELECT/INSERT/UPDATE pour acces public via token valide (formulaire)
- SELECT/UPDATE pour utilisateurs authentifies (dashboard formateur)

**questionnaire_events:**
- INSERT public (via token)
- SELECT pour utilisateurs authentifies

---

## Phase 2 : Stockage fichiers

### Bucket `training-programs`
- Type: Public (lecture pour liens emails)
- Upload: Utilisateurs authentifies uniquement
- Organisation: `/{training_id}/{filename}`

---

## Phase 3 : Pages Frontend

### 3.1 Modifications Dashboard (`/`)
- Ajouter carte "Formations" avec icone Calendar
- Navigation vers `/formations`

### 3.2 Page Listing Formations (`/formations`)

**Interface:**
- Tableau avec colonnes: Date, Formation, Lieu, Client
- Filtres: A venir / Passees
- Bouton "Ajouter une formation"
- Clic sur ligne = navigation vers detail

**Composants:**
- `FormationsTable.tsx` - Tableau avec tri/filtres
- `FormationRow.tsx` - Ligne avec actions rapides

### 3.3 Page Creation/Edition Formation (`/formations/new`, `/formations/:id/edit`)

**Formulaire:**
- Date de debut (calendrier)
- Date de fin (optionnel, calendrier)
- Nom de la formation
- Lieu
- Client
- Lien evaluation
- Prerequis (liste editable)
- Format formation (intra/inter/virtuel)

**Gestion des horaires:**
- Section horaires par journee
- Premier jour: saisie complete
- Jours suivants: replication automatique avec possibilite de modifier

**Gestion du programme:**
- Upload nouveau fichier OU
- Selection depuis bibliotheque existante
- Previsualisation PDF

**Composants:**
- `FormationForm.tsx` - Formulaire principal
- `ScheduleEditor.tsx` - Editeur d'horaires multi-jours
- `ProgramSelector.tsx` - Selection/upload programme
- `PrerequisitesEditor.tsx` - Gestion liste prerequis

### 3.4 Page Detail Formation (`/formations/:id`)

**Sections:**
1. **Informations formation** (modifiables)
   - Dates, lieu, client, evaluation
   - Modification dates = recalcul emails

2. **Liste des participants**
   - Tableau: Nom, Prenom, Email, Statut recueil
   - Icone statut cliquable pour voir details
   - Actions: Ajouter, Supprimer

3. **Synthese des besoins**
   - Vue consolidee des reponses
   - Flags d'alerte (prerequis, accessibilite, motivation)
   - Export PDF/Excel

**Composants:**
- `ParticipantList.tsx` - Liste avec statuts
- `AddParticipantDialog.tsx` - Ajout unitaire
- `BulkAddParticipantsDialog.tsx` - Ajout en lot
- `NeedsSummaryPanel.tsx` - Synthese des besoins
- `ParticipantNeedsDetail.tsx` - Detail individuel

### 3.5 Page Formulaire Public Besoins (`/besoins/:token`)

**Caracteristiques:**
- Accessible sans authentification
- Mobile-first, responsive
- Sauvegarde automatique toutes les 30s
- 6 sections avec progression visuelle
- Validation temps reel

**Section 1 - Identification:**
- Champs pre-remplis modifiables
- Email, Nom, Prenom, Societe, Fonction

**Section 2 - Positionnement pedagogique:**
- Experience prealable (choix + texte optionnel)
- Lecture programme (avec bouton "Consulter")
- Validation prerequis (affichage liste + choix)
- Auto-evaluation niveau (slider 0-10)
- Competences actuelles (texte optionnel)

**Section 3 - Objectifs:**
- Competences visees (obligatoire)
- Lien avec mission (obligatoire)
- Niveau motivation (1-5 avec etoiles)

**Section 4 - Adaptation:**
- Modalites preferences (cases a cocher)
- Besoins accessibilite (encart referent handicap)
- Contraintes organisationnelles (conditionnel)

**Section 5 - Commentaires:**
- Zone libre (2000 car max)

**Section 6 - Validation:**
- Consentement RGPD (obligatoire)
- Boutons: Enregistrer brouillon / Soumettre

**Post-soumission:**
- Ecran de confirmation personnalise
- Email recapitulatif avec PDF

**Composants:**
- `NeedsSurveyForm.tsx` - Formulaire principal
- `SurveySection.tsx` - Wrapper section repliable
- `ProgressIndicator.tsx` - Barre de progression
- `AutoSaveIndicator.tsx` - Indicateur sauvegarde
- `MotivationScale.tsx` - Composant etoiles
- `LevelSlider.tsx` - Slider niveau
- `RgpdConsent.tsx` - Case consentement

---

## Phase 4 : Edge Functions

### 4.1 `send-training-emails` - Processeur d'emails

**Declenchement:** pg_cron toutes les minutes

**Logique:**
```text
1. Recuperer scheduled_emails WHERE scheduled_for <= NOW() AND status = 'pending'
2. Pour chaque email:
   a. Construire contenu selon email_type
   b. Envoyer via Resend
   c. Mettre a jour status = 'sent' ou 'failed'
   d. Logger dans questionnaire_events si applicable
```

**Types d'emails:**
- `needs_survey`: Invitation recueil + programme PJ + lien formulaire
- `reminder_j7`: Rappel lieu/horaires 7 jours avant
- `needs_summary`: Synthese des besoins a romain@supertilt.fr
- `thank_you`: Remerciement post-formation (manuel)

### 4.2 `get-needs-survey` - Recuperation formulaire

**GET** `/get-needs-survey?token=xxx`

**Reponse:**
- Informations formation (nom, date, lieu, prerequis)
- Donnees pre-remplies
- Donnees sauvegardees (si reprise)
- Coordonnees referent handicap

### 4.3 `save-needs-survey` - Sauvegarde formulaire

**PATCH** `/save-needs-survey`

**Fonctionnalites:**
- Validation token
- Sauvegarde partielle autorisee
- Log evenement sauvegarde
- Rate limiting (max 10/minute/token)

### 4.4 `submit-needs-survey` - Soumission finale

**POST** `/submit-needs-survey`

**Validations:**
- Tous champs requis presents
- Consentement RGPD = true
- Token valide et non expire

**Actions declenchees:**
1. Passage etat = 'complete'
2. Evaluation flags (formateur, amenagement)
3. Envoi email confirmation apprenant
4. Envoi notifications selon flags
5. Log evenement soumission

### 4.5 `send-thank-you-email` - Email remerciement manuel

**POST** `/send-thank-you-email`

**Parametres:**
- training_id
- support_files_urls
- custom_message (optionnel)

---

## Phase 5 : Automatisations

### 5.1 Triggers base de donnees

**trigger_participant_added:**
```text
AFTER INSERT ON training_participants
-> INSERT INTO scheduled_emails (email_type='needs_survey', scheduled_for=NOW()+1 day)
-> INSERT INTO questionnaire_besoins avec token genere
```

**trigger_training_created:**
```text
AFTER INSERT ON trainings
-> INSERT INTO scheduled_emails (email_type='reminder_j7', scheduled_for=start_date-7 days)
-> INSERT INTO scheduled_emails (email_type='needs_summary', scheduled_for=start_date-1 day)
```

**trigger_training_date_updated:**
```text
AFTER UPDATE OF start_date ON trainings
-> UPDATE scheduled_emails SET scheduled_for = recalcule
   WHERE training_id = NEW.id AND status = 'pending'
```

### 5.2 Job pg_cron

```sql
SELECT cron.schedule(
  'process-training-emails',
  '* * * * *',  -- Chaque minute
  $$SELECT net.http_post(...send-training-emails...)$$
);
```

### 5.3 Relances automatiques

**Job quotidien J-7:**
```text
Filtre: etat IN ('envoye', 'en_cours') AND formation_date - 7 days <= TODAY()
Action: Email relance + alerte dashboard
```

---

## Phase 6 : Securite et conformite

### 6.1 Tokens formulaire
- Format: UUID v4 + hash SHA256
- Validite: 30 jours apres envoi
- Verification: Edge function + RLS

### 6.2 Rate limiting
- Sauvegarde auto: max 10/minute/token
- Protection CSRF: token dans formulaire

### 6.3 Conservation donnees (Qualiopi)
- Duree: 3 ans minimum apres formation
- Archivage: Export JSON avant purge
- Purge: Autorisee apres 4 ans

### 6.4 RGPD
- Consentement explicite obligatoire
- Lien politique confidentialite
- Droit a l'oubli sur demande (sauf periode legale)

---

## Phase 7 : Accessibilite (RGAA AA)

- Navigation clavier complete (Tab, Shift+Tab)
- Labels explicites pour lecteurs d'ecran
- Contrastes texte >= 4.5:1
- Messages d'erreur associes (aria-describedby)
- Focus visible sur elements interactifs
- Police min 16px (eviter zoom iOS)
- Sliders tactiles >= 44px

---

## Structure des fichiers a creer

```text
src/pages/
  Formations.tsx              # Listing
  FormationCreate.tsx         # Creation
  FormationEdit.tsx           # Edition
  FormationDetail.tsx         # Detail + participants
  NeedsSurvey.tsx             # Formulaire public

src/components/formations/
  FormationForm.tsx           # Formulaire reutilisable
  FormationsTable.tsx         # Tableau listing
  ScheduleEditor.tsx          # Editeur horaires
  ProgramSelector.tsx         # Selection programme
  PrerequisitesEditor.tsx     # Gestion prerequis
  ParticipantList.tsx         # Liste participants
  AddParticipantDialog.tsx    # Ajout unitaire
  BulkAddParticipantsDialog.tsx # Ajout lot
  NeedsSummaryPanel.tsx       # Synthese besoins

src/components/needs-survey/
  NeedsSurveyForm.tsx         # Formulaire principal
  SurveySection.tsx           # Section repliable
  ProgressIndicator.tsx       # Progression
  AutoSaveIndicator.tsx       # Indicateur sauvegarde
  MotivationScale.tsx         # Echelle etoiles
  LevelSlider.tsx             # Slider niveau
  RgpdConsent.tsx             # Consentement

supabase/functions/
  send-training-emails/index.ts
  get-needs-survey/index.ts
  save-needs-survey/index.ts
  submit-needs-survey/index.ts
  send-thank-you-email/index.ts
```

---

## Ordre d'implementation recommande

### Sprint 1 - Fondations (1-2 semaines)
- [ ] Migrations DB (toutes les tables)
- [ ] Bucket storage training-programs
- [ ] Page listing formations basique
- [ ] Page creation formation (sans horaires complexes)

### Sprint 2 - Gestion formations (1 semaine)
- [ ] Formulaire creation complet avec horaires
- [ ] Upload/selection programmes
- [ ] Page detail formation
- [ ] Modification dates

### Sprint 3 - Participants (1 semaine)
- [ ] Ajout participants (unitaire + lot)
- [ ] Affichage statuts recueil
- [ ] Triggers creation questionnaire
- [ ] Generation tokens

### Sprint 4 - Formulaire besoins (2 semaines)
- [ ] Edge functions get/save/submit
- [ ] Formulaire public 6 sections
- [ ] Sauvegarde auto 30s
- [ ] Validation temps reel
- [ ] Post-soumission (confirmation + emails)

### Sprint 5 - Automatisations (1 semaine)
- [ ] Edge function envoi emails
- [ ] Configuration pg_cron
- [ ] Triggers programmation
- [ ] Alertes formateur/referent handicap

### Sprint 6 - Finitions (1 semaine)
- [ ] Email remerciement manuel
- [ ] Dashboard formateur (synthese, exports)
- [ ] Tests E2E
- [ ] Audit accessibilite

---

## Configuration requise

### Secrets existants utilises
- RESEND_API_KEY (emails transactionnels)

### Variables d'environnement
- REFERENT_HANDICAP_NAME = "Marie Martin" (a configurer)
- REFERENT_HANDICAP_EMAIL = "accessibilite@supertilt.fr"
- REFERENT_HANDICAP_PHONE = "+33 6 XX XX XX XX"
- FORMATEUR_EMAIL = "romain@supertilt.fr"

