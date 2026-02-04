# PRD SuperTools

## 1. Vue d'ensemble

**SuperTools** est une application web interne destinée aux formateurs et consultants de **SuperTilt**. Elle centralise la gestion commerciale (CRM), la gestion des formations professionnelles, le suivi des missions, la création de contenu marketing, et automatise les tâches répétitives liées à l'activité.

### 1.1 Objectifs principaux

- **Gestion commerciale** : Pipeline CRM avec extraction IA des opportunités
- **Gain de temps** : Automatiser les communications (emails, rappels, relances)
- **Conformité Qualiopi** : Garantir la traçabilité des actions de formation
- **Qualité** : Collecter et analyser les retours participants
- **Centralisation** : Un point d'entrée unique pour toutes les opérations

### 1.2 Stack technique

- **Frontend** : React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend** : Supabase (PostgreSQL, Edge Functions, Auth, Storage)
- **Emails** : Resend API avec signatures HTML Signitic
- **PDF** : jsPDF (côté client), PDFMonkey (certificats)
- **IA** : Google Gemini (extraction, analyse, amélioration de contenu)
- **Drag & Drop** : dnd-kit (Kanban boards)
- **Rich Text** : TipTap editor

---

## 2. Architecture fonctionnelle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            DASHBOARD                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │   CRM    │ │Formations│ │ Missions │ │ Contenu  │ │  Emails  │       │
│  │          │ │          │ │          │ │          │ │ entrants │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Micro-   │ │Évaluations│ │Certificats│ │Améliora- │ │Historique│      │
│  │ devis    │ │          │ │          │ │tions     │ │          │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                                  │
│  │Statistiq.│ │ Chatbot  │ │Paramètres│                                  │
│  │          │ │  Admin   │ │          │                                  │
│  └──────────┘ └──────────┘ └──────────┘                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Modules disponibles

| Module | Route | Description |
|--------|-------|-------------|
| **CRM** | `/crm` | Pipeline commercial Kanban avec IA |
| **Formations** | `/formations` | Gestion complète des sessions de formation |
| **Missions** | `/missions` | Suivi des missions consulting (Kanban) |
| **Contenu** | `/contenu` | Gestion du contenu marketing avec workflow de review |
| **Emails entrants** | `/emails` | Boîte de réception des emails Resend |
| **Micro-devis** | `/micro-devis` | Génération rapide de devis PDF |
| **Évaluations** | `/evaluations` | Analyse des retours participants |
| **Certificats** | `/certificates` | Génération de certificats de réalisation |
| **Améliorations** | `/ameliorations` | Suivi des axes d'amélioration |
| **Historique** | `/historique` | Journal de toutes les actions |
| **Statistiques** | `/statistiques` | Tableau de bord analytique |
| **Chatbot Admin** | `/chatbot-admin` | Gestion de la base de connaissances IA |
| **Paramètres** | `/parametres` | Configuration de l'application |

---

## 3. Module : CRM (Gestion Commerciale)

### 3.1 Vue d'ensemble

Pipeline commercial de type Kanban pour gérer les opportunités de vente, de la qualification jusqu'à la signature.

### 3.2 Structure du Kanban

#### Colonnes
- Colonnes personnalisables (ex: Qualification, Premier contact, Proposition, Négociation, Gagné)
- Réorganisation par drag & drop
- Archivage de colonnes (masque sans supprimer)
- Affichage du nombre de cartes et valeur totale par colonne

#### Cartes (Opportunités)
- **Informations contact** : Prénom, Nom, Entreprise, Email, Téléphone, LinkedIn, Site web
- **Détails opportunité** : Titre, Description (HTML), Type de service (Formation/Mission), Valeur estimée
- **Statuts** :
  - Opérationnel : `TODAY` | `WAITING`
  - Commercial : `OPEN` | `WON` | `LOST` | `CANCELED`
- **Programmation d'actions** : Date + texte de l'action à effectuer
- **Questions brief** : Questions générées par l'IA nécessitant réponse
- **Liaison mission** : Lien vers une mission du module Missions

### 3.3 Fonctionnalités IA

#### Extraction automatique d'opportunité
- Coller un texte brut (email, notes)
- L'IA extrait : titre, contact, entreprise, type de service, questions clés
- Révision avant création

#### Analyse stratégique
- Analyse du contexte de l'opportunité
- Recommandations d'actions
- Identification des points clés

#### Génération de devis
- Génération automatique de descriptif de devis
- Basé sur les informations de l'opportunité

### 3.4 Emails depuis le CRM

#### Éditeur riche
- Formatage : gras, italique, souligné, listes, liens
- **Snippets d'emails** : Blocs de texte pré-configurés par catégorie
- Amélioration IA du sujet et du corps
- Styles inline pour compatibilité email

#### Workflow
1. Sélection du destinataire (pré-rempli depuis la carte)
2. Rédaction avec snippets et formatage
3. Amélioration optionnelle par IA
4. Envoi avec signature Signitic
5. Historisation dans l'opportunité

### 3.5 Animation de célébration

Quand une opportunité passe en statut "Gagné" :
- Animation de confettis colorés (3 secondes)
- Explosion initiale au centre + jets continus des côtés
- Couleurs : or, orange, rouge, vert, bleu, violet

### 3.6 Création de formation

Pour les opportunités de type "Formation" gagnées :
- Dialog de confirmation pour créer la session
- Pré-remplissage automatique des champs (client, contact, titre, valeur)
- Navigation vers `/formations/new` avec paramètres

### 3.7 Rapports CRM

Page `/crm/reports` avec :
- **KPIs** : Pipeline ouvert, Ventes gagnées, Ventes perdues, Taux de conversion
- **Graphiques** : Répartition par colonne, Répartition par catégorie de tag
- **Tableau récapitulatif** des métriques

### 3.8 Tables de données

| Table | Description |
|-------|-------------|
| `crm_columns` | Colonnes du pipeline |
| `crm_cards` | Opportunités |
| `crm_tags` | Tags personnalisés |
| `crm_card_tags` | Relations cartes-tags |
| `crm_comments` | Commentaires sur les cartes |
| `crm_attachments` | Pièces jointes |
| `crm_activity_log` | Journal d'activité |
| `crm_card_emails` | Emails envoyés |
| `email_snippets` | Snippets d'emails pré-configurés |

---

## 4. Module : Missions

### 4.1 Vue d'ensemble

Kanban de suivi des missions consulting avec gestion financière (TJM, jours facturés).

### 4.2 Structure

#### Colonnes (statuts fixes)
| Statut | Label | Couleur |
|--------|-------|---------|
| `not_started` | À démarrer | Gris |
| `in_progress` | En cours | Bleu |
| `completed` | Terminée | Vert |
| `cancelled` | Annulée | Rouge |

#### Propriétés d'une mission
- **Titre** (obligatoire)
- **Client** : Nom et contact
- **Dates** : Début et fin
- **Financier** : TJM (€/jour), Nombre de jours, Montant total (calculé)
- **Tags** : Étiquettes personnalisées
- **Couleur** : Bordure visuelle (9 couleurs disponibles)
- **Description** : Notes détaillées

### 4.3 Intégration CRM

- Les opportunités de type "Mission" peuvent être liées à une mission
- Recherche et sélection depuis le détail de l'opportunité CRM
- Suivi bout-en-bout : prospection → exécution

---

## 5. Module : Contenu (Content Board)

### 5.1 Vue d'ensemble

Système de gestion de contenu marketing avec workflow de création et validation.

### 5.2 Structure Kanban

#### Colonnes
- **Idées** : Colonne initiale pour les nouvelles idées
- **Colonnes personnalisées** : En rédaction, En review, Prêt à publier, etc.
- **Archive** : Contenu publié ou abandonné

#### Cartes de contenu
- Titre
- Description (éditeur riche TipTap)
- Image de couverture
- Tags de catégorisation
- Statut de review

### 5.3 Workflow de review

#### Statuts de review
| Statut | Description |
|--------|-------------|
| `none` | Pas de review demandée |
| `pending` | Review demandée, en attente |
| `in_review` | Reviewer a soumis des commentaires |
| `approved` | Review validée |
| `changes_requested` | Modifications demandées |

#### Commentaires de review
- **Types** : Fond (contenu) ou Forme (style/grammaire)
- **Actions auteur** : Accepter, Refuser, Corriger
- **Pièces jointes** : Images/screenshots (max 5 Mo)
- **Corrections proposées** : Suggestions de texte

### 5.4 Assistance IA

- **Reformuler** : Rephrase le contenu
- **Adapter pour Blog** : Format article
- **Adapter pour LinkedIn** : Style professionnel
- **Adapter pour Instagram** : Style casual/visuel
- **Recherche sémantique** : Trouver du contenu similaire

### 5.5 Notifications

- Notifications temps réel pour les reviews
- Emails aux reviewers
- Badge de compteur non lu

---

## 6. Module : Emails Entrants

### 6.1 Vue d'ensemble

Boîte de réception pour les emails reçus via Resend (webhook).

### 6.2 Fonctionnalités

#### Affichage
- Liste des emails avec expéditeur, sujet, aperçu
- Détail complet (HTML ou texte brut)
- Pièces jointes avec taille

#### Gestion
- **Statuts** : Reçu, Traité, Archivé, Spam
- Recherche par email, sujet, expéditeur
- Filtrage par statut
- Actions : Marquer traité, Archiver, Supprimer

#### Intégration
- Liaison possible avec une formation (`linked_training_id`)
- Liaison possible avec un participant (`linked_participant_id`)
- Notes personnalisées

---

## 7. Module : Micro-devis

### 7.1 Fonctionnalités

- **Mode Intra/Inter-entreprises** :
  - **Intra** : Formation et dates en saisie libre
  - **Inter** : Sélection catalogue et dates prédéfinies
- Sélection d'une formation parmi les configurations enregistrées
- Saisie des informations client (entreprise, SIREN, contact)
- Recherche SIREN via API pour auto-complétion
- Génération automatique d'un PDF de devis
- **Persistance des champs** en sessionStorage
- **Historique des devis** avec recherche

### 7.2 Signature électronique de devis

- Page publique `/signature-devis/:token`
- Signature tactile/souris
- Horodatage et métadonnées légales

### 7.3 Règle spéciale "En ligne"

Si le nom contient "en ligne", le lieu est automatiquement :
> "En ligne en accédant à son compte sur supertilt.fr"

---

## 8. Module : Gestion des Formations

### 8.1 Création d'une formation

#### Informations générales
- **Nom** : Sélection via combobox ou saisie libre
- **Client** : Entreprise cliente
- **Lieu** : Lieux prédéfinis ou saisie libre
- **Format** : Présentiel / Distanciel / Hybride / Inter-entreprises
- **Formateur** : Sélection parmi les formateurs

#### Planification
- Sélection multiple de jours
- Horaires par jour avec réplication automatique
- Toggle multi-jours (J+1 automatique)

#### Commanditaire (Intra)
- Prénom, Nom, Email
- Option tutoiement/vouvoiement

#### Financeur
- Checkbox "Le financeur est le commanditaire"
- Si différent : nom et URL du financeur
- Email d'évaluation à froid programmé à J+45

#### Objectifs et prérequis
- Saisie manuelle
- **Extraction IA** depuis PDF de programme

### 8.2 Formats de formation

#### Intra-entreprise
- Commanditaire unique au niveau formation
- Email récapitulatif après dernier participant convoqué

#### Inter-entreprises
- Commanditaire par participant (optionnel)
- Financeur par participant
- Mise en CC du commanditaire lors de la convocation

### 8.3 Gestion des participants

#### Ajout
- **Unitaire** : Email, Prénom, Nom, Entreprise
- **En lot** : Parsing de texte flexible
- Symbole `|` pour séparer participant et commanditaire (inter)

#### Modification
- Édition inline de tous les champs
- Pour inter : modification commanditaire/financeur

### 8.4 Emails automatisés

| Proximité | Comportement |
|-----------|--------------|
| Formation passée | Aucun email |
| J < 2 jours | Mode manuel uniquement |
| J-7 à J-2 | Email immédiat |
| J > 7 jours | Séquence programmée |

#### Séquence automatique
| Délai | Email |
|-------|-------|
| J+1 (ajout) | Recueil des besoins |
| J-7 | Rappel logistique |
| J-1 | Synthèse formateur |

#### Post-formation
| Délai | Email | Condition |
|-------|-------|-----------|
| J+2 | Relance évaluation | Non soumise |
| J+5 | 2ème relance | Non soumise |
| J+45 | Évaluation à froid | Financeur ≠ commanditaire |

### 8.5 Questionnaire de recueil des besoins

Page publique `/questionnaire/:token` :
- Informations personnelles
- Niveau actuel et expérience
- Compétences visées
- Contraintes et accessibilité
- Motivation
- Sauvegarde automatique

### 8.6 Émargement électronique

#### Conformité eIDAS
Signature électronique simple légalement reconnue.

#### Processus
1. Envoi du lien par email
2. Page `/emargement/:token`
3. Signature canvas tactile/souris
4. Stockage : image + horodatage + IP + User-Agent

#### Preuves conservées
- Horodatage précis
- Adresse IP
- User-Agent
- Date d'envoi/ouverture

### 8.7 Interface utilisateur

#### Liste des formations
- **Compteur J-X** : Badge orange si J-2 ou moins
- Colonnes : Date, Client, Formation, Lieu
- Tri sur toutes les colonnes
- Pagination

#### Page détail
- Deux colonnes : Infos générales / Participants & Communication
- Onglets : Participants, Émargement, Documents

---

## 9. Module : Évaluations

### 9.1 Formulaire d'évaluation

Page publique `/evaluation/:token` :
- Appréciation générale (échelle 5→1)
- Évaluation des objectifs pédagogiques
- Équilibre théorie/pratique
- Qualification intervenant
- NPS (recommandation)
- Axes d'amélioration
- Commentaires libres

### 9.2 Workflow post-soumission

1. **Génération certificat** via PDFMonkey
2. **Archivage Google Drive**
3. **Envoi au participant**
4. **Code promo** (si "Facilitation graphique")

#### Emails de suivi
| Délai | Email |
|-------|-------|
| J+1 | Demande avis Google |
| J+7 | Demande témoignage vidéo |
| J+20 | Évaluation à froid |

### 9.3 Analyse IA

- Synthèse automatique des retours
- Points forts identifiés
- Points d'amélioration
- Recommandations d'actions

---

## 10. Module : Certificats

### 10.1 Génération

- Template PDFMonkey : `6593BDA5-6890-45E8-804F-77488D64BEDF`
- Informations : Nom, Formation, Dates, Durée, Objectifs

### 10.2 Livraison

- Email individuel au participant
- Email groupé au commanditaire (ZIP si plusieurs)
- BCC systématique
- Rate limit : 1s entre envois

---

## 11. Module : Améliorations

### 11.1 Sources

- Analyses IA des évaluations
- Saisie manuelle

### 11.2 Catégories

- Contenu pédagogique
- Logistique
- Communication
- Outils et supports
- Autre

### 11.3 Statuts

- À faire
- En cours
- Terminé

### 11.4 Dashboard

Top 3 des améliorations prioritaires affiché sur l'accueil.

---

## 12. Module : Historique

### 12.1 Événements tracés

- Créations, Modifications, Suppressions
- Envois d'emails (contenu consultable)

### 12.2 Recherche

- Filtrage par email destinataire
- Recherche dans les détails JSONB
- Filtrage par plage de dates

---

## 13. Module : Statistiques

### 13.1 Métriques

- **Graphiques hebdomadaires** (12 mois) :
  - Micro-devis générés
  - Formations réalisées
  - Évaluations reçues
- **Note moyenne** des évaluations
- **Top 3 améliorations** prioritaires

### 13.2 Sources de données

| Donnée | Table | Champ |
|--------|-------|-------|
| Micro-devis | `activity_logs` | action_type = "micro_devis_generated" |
| Formations | `trainings` | start_date |
| Évaluations | `training_evaluations` | date_soumission |
| Note moyenne | `training_evaluations` | appreciation_generale |
| Améliorations | `improvements` | status = "pending" |

---

## 14. Module : Chatbot Admin

### 14.1 Assistant IA

Chatbot d'aide intégré à l'application pour guider les utilisateurs.

### 14.2 Base de connaissances

#### Catégories
- `fonctionnalite` : Fonctionnalités
- `workflow` : Processus
- `regle_metier` : Règles métier
- `qualiopi` : Conformité Qualiopi
- `email` : Emails
- `documents` : Documents
- `faq` : FAQ

#### Gestion
- CRUD complet des entrées
- Activation/désactivation
- Priorité (0-100)
- Recherche et filtrage

### 14.3 Sécurité

- Accès réservé aux administrateurs
- Vérification via RPC `is_admin()`

---

## 15. Standards techniques

### 15.1 Emails

- **Expéditeur** : romain@supertilt.fr
- **Signature HTML** : API Signitic
- **BCC systématique** : romain@supertilt.fr + nocrm.io
- **Boutons calendrier** : Google Calendar + Outlook
- **Styles inline** : Compatibilité tous clients email

### 15.2 Conformité

| Norme | Application |
|-------|-------------|
| **Qualiopi** | Conservation 3 ans, traçabilité |
| **RGPD** | Consentement explicite, droit à l'oubli |
| **RGAA** | Accessibilité niveau AA |
| **eIDAS** | Signature électronique simple |

### 15.3 Sécurité

- Authentification obligatoire
- RLS sur toutes les tables
- Tokens uniques pour pages publiques
- Changement de mot de passe forcé si nécessaire

---

## 16. Pages publiques (sans authentification)

| Route | Usage |
|-------|-------|
| `/questionnaire/:token` | Recueil des besoins |
| `/evaluation/:token` | Évaluation post-formation |
| `/emargement/:token` | Signature de présence |
| `/signature-devis/:token` | Signature de devis |
| `/formation-info/:trainingId` | Récapitulatif formation participant |
| `/politique-confidentialite` | Politique de confidentialité |

---

## 17. Évolutions prévues

### 17.1 Priorité haute

| Évolution | Description | Statut |
|-----------|-------------|--------|
| Stabilisation émargement | Debug du système de signature électronique | 🔴 En attente |
| Nettoyage RGPD | Purge automatique après 3 ans | 🔴 En attente |

### 17.2 Priorité moyenne

| Évolution | Description | Statut |
|-----------|-------------|--------|
| Export BPF automatique | Génération du Bilan Pédagogique et Financier | 🟠 En attente |
| Synthèse BPF | Tableau des éléments manquants par formation | 🟠 En attente |
| Évaluations e-learning | Support évaluations intégrées formations en ligne | 🟠 En attente |

### 17.3 Priorité basse

| Évolution | Description | Statut |
|-----------|-------------|--------|
| Recherche LinkedIn participants | Lien LinkedIn auto depuis les formations | 🟡 En attente |
| Réservation salle Paris/Lyon | Bouton de demande de réservation | 🟡 En attente |
| Réservation restaurant | Gestion repas formations inter | 🟡 En attente |

---

## 18. Annexes

### 18.1 Tables principales

| Table | Description |
|-------|-------------|
| `trainings` | Formations |
| `training_participants` | Participants aux formations |
| `training_schedules` | Planification des jours |
| `training_evaluations` | Évaluations |
| `attendance_signatures` | Signatures d'émargement |
| `questionnaire_besoins` | Réponses recueil des besoins |
| `scheduled_emails` | File d'attente emails programmés |
| `improvements` | Axes d'amélioration |
| `evaluation_analyses` | Analyses IA |
| `formation_configs` | Configuration formations (micro-devis) |
| `activity_logs` | Journal des actions |
| `email_templates` | Templates d'emails |
| `trainers` | Formateurs |
| `profiles` | Profils utilisateurs |
| `app_settings` | Paramètres application |
| `crm_columns` | Colonnes CRM |
| `crm_cards` | Opportunités CRM |
| `crm_tags` | Tags CRM |
| `crm_card_emails` | Emails CRM |
| `crm_activity_log` | Journal CRM |
| `missions` | Missions consulting |
| `content_columns` | Colonnes contenu |
| `content_cards` | Cartes contenu |
| `content_reviews` | Reviews contenu |
| `review_comments` | Commentaires review |
| `content_notifications` | Notifications contenu |
| `inbound_emails` | Emails reçus |
| `chatbot_knowledge_base` | Base de connaissances chatbot |
| `email_snippets` | Snippets emails pré-configurés |

### 18.2 Edge Functions

#### Formations
| Fonction | Rôle |
|----------|------|
| `send-needs-survey` | Envoi questionnaire besoins |
| `send-needs-survey-reminder` | Relance questionnaire |
| `send-welcome-email` | Email d'accueil J-7 |
| `send-training-documents` | Envoi documents administratifs |
| `send-thank-you-email` | Remerciement + lien évaluation |
| `send-attendance-signature-request` | Demande signature émargement |
| `submit-attendance-signature` | Soumission signature |
| `send-accessibility-needs` | Notification besoins accessibilité |
| `send-questionnaire-confirmation` | Confirmation soumission questionnaire |
| `send-evaluation-reminder` | Relance évaluation J+2/J+5 |
| `send-training-calendar-invite` | Invitation calendrier |
| `generate-certificates` | Génération certificats PDFMonkey |
| `generate-attendance-pdf` | Export PDF émargement |
| `generate-convention-formation` | Génération convention |
| `analyze-evaluations` | Analyse IA évaluations |
| `extract-objectives-from-pdf` | Extraction objectifs/prérequis IA |
| `summarize-needs-survey` | Synthèse besoins pour formateur |
| `process-evaluation-submission` | Workflow post-évaluation |
| `force-send-scheduled-email` | Envoi forcé email programmé |
| `process-scheduled-emails` | Traitement file d'attente emails |
| `send-prerequis-warning` | Alerte prérequis non validés |
| `send-booking-reminder` | Rappel réservation |

#### CRM
| Fonction | Rôle |
|----------|------|
| `crm-extract-opportunity` | Extraction IA d'opportunité |
| `crm-ai-assist` | Analyse, génération devis, amélioration email |
| `crm-send-email` | Envoi email depuis opportunité |

#### Devis
| Fonction | Rôle |
|----------|------|
| `generate-micro-devis` | Génération devis PDF |
| `send-devis-signature-request` | Demande signature devis |
| `submit-devis-signature` | Soumission signature devis |

#### Contenu
| Fonction | Rôle |
|----------|------|
| `ai-content-assist` | Reformulation/adaptation IA |
| `search-content-ideas` | Recherche sémantique contenu |
| `send-content-notification` | Notifications review |

#### Système
| Fonction | Rôle |
|----------|------|
| `chatbot-query` | Requêtes chatbot assistant |
| `resend-inbound-webhook` | Réception emails entrants |
| `search-siren` | Recherche entreprise SIREN |
| `onboard-collaborator` | Création compte collaborateur |
| `send-password-reset` | Réinitialisation mot de passe |
| `check-login-attempt` | Vérification tentative connexion |
| `log-login-attempt` | Journalisation connexion |
| `improve-email-content` | Amélioration contenu email IA |
| `backup-export` | Export de sauvegarde |
| `backup-import` | Import de sauvegarde |
| `google-drive-auth` | Authentification Google Drive |
| `zapier-create-training` | Création formation via Zapier |
| `send-action-reminder` | Rappel action programmée |

---

*Document mis à jour le 4 février 2026*
*Version : 2.0*

### Historique des versions

| Version | Date | Modifications |
|---------|------|---------------|
| 1.0 | 30 janvier 2026 | Version initiale |
| 1.1 | 2 février 2026 | Ajout gestion financeur intra/inter-entreprises, relances évaluation |
| 1.2 | 3 février 2026 | Compteur J-X, édition participants, lieux prédéfinis, micro-devis intra/inter |
| 2.0 | 4 février 2026 | Ajout modules CRM, Missions, Contenu, Emails entrants, Chatbot Admin, Statistiques. Refonte complète du document avec toutes les edge functions. Animation confetti CRM, éditeur email riche avec snippets. |
