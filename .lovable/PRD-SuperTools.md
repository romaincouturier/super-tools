# PRD SuperTools

## 1. Vue d'ensemble

**SuperTools** est une application web interne destinée aux formateurs de **SuperTilt**. Elle centralise la gestion administrative des formations professionnelles et automatise les tâches répétitives liées au suivi des participants, à la conformité Qualiopi et à l'amélioration continue.

### 1.1 Objectifs principaux

- **Gain de temps** : Automatiser les communications (emails de recueil des besoins, rappels, remerciements, demandes d'évaluation)
- **Conformité Qualiopi** : Garantir la traçabilité des actions de formation (émargement, évaluations, conservation 3 ans)
- **Qualité** : Collecter et analyser les retours participants pour amélioration continue
- **Centralisation** : Un point d'entrée unique pour toutes les opérations administratives

### 1.2 Stack technique

- **Frontend** : React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend** : Lovable Cloud (Supabase) - Base de données PostgreSQL, Edge Functions, Auth
- **Emails** : Resend API avec signatures HTML Signitic
- **PDF** : jsPDF (génération côté client), PDFMonkey (certificats)
- **IA** : Google Gemini (extraction d'objectifs, analyse d'évaluations)

---

## 2. Architecture fonctionnelle

```
┌─────────────────────────────────────────────────────────────────┐
│                        DASHBOARD                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Micro-   │ │Formations│ │Évaluations│ │Certificats│          │
│  │ devis    │ │          │ │          │ │          │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│  ┌──────────┐ ┌──────────┐                                      │
│  │Améliora- │ │Historique│                                      │
│  │tions     │ │          │                                      │
│  └──────────┘ └──────────┘                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Modules disponibles

| Module | Description |
|--------|-------------|
| **Micro-devis** | Génération de devis PDF rapides |
| **Formations** | Gestion complète des sessions de formation |
| **Évaluations** | Consultation et analyse des retours participants |
| **Certificats** | Génération de certificats de réalisation |
| **Améliorations** | Suivi des axes d'amélioration identifiés |
| **Historique** | Journal de toutes les actions effectuées |

---

## 3. Module : Micro-devis

### 3.1 Fonctionnalités

- Sélection d'une formation parmi les configurations enregistrées
- Saisie des informations client (entreprise, SIREN, contact)
- Génération automatique d'un PDF de devis
- Recherche SIREN via API pour auto-complétion

### 3.2 Gestion des formations

Les formations sont configurables via une interface CRUD :
- Nom de la formation
- Prix HT
- Durée en heures
- URL du programme
- Ordre d'affichage
- Statut par défaut

### 3.3 Règle spéciale "En ligne"

Si le nom de la formation contient "en ligne", le lieu est automatiquement défini à :
> "En ligne en accédant à son compte sur supertilt.fr"

---

## 4. Module : Gestion des Formations

### 4.1 Création d'une formation

#### Informations générales
- **Nom de la formation** : Sélection via combobox (formations existantes ou saisie libre)
- **Client** : Nom de l'entreprise cliente
- **Lieu** : Adresse de la formation
- **Format** : Présentiel / Distanciel / Hybride / Inter-entreprises
- **Formateur** : Nom du formateur

#### Planification
- **Dates** : Sélection multiple de jours
- **Horaires** : Heure de début et fin par jour
- Réplication automatique des horaires du premier jour
- Calcul automatique de l'heure de fin (+8h par défaut)
- **Multi-jours** : Toggle qui définit automatiquement la date de fin à J+1 si la date de début est définie

#### Commanditaire (Intra-entreprise)
- Prénom, Nom, Email
- Option tutoiement/vouvoiement (vouvoiement par défaut)
- Bouton de copie rapide de l'email

#### Financeur (Intra-entreprise)
- **Checkbox** : "Le financeur est le commanditaire"
- Si décoché : saisie du nom et URL du financeur
- **Email d'évaluation à froid** : Si le financeur est différent du commanditaire, un email est programmé pour romain@supertilt.fr à J+45 après l'envoi du mail de remerciement

#### Objectifs pédagogiques
- Saisie manuelle
- **Extraction IA** : Upload d'un PDF de programme → extraction automatique via Gemini

#### Prérequis
- Saisie manuelle des prérequis de la formation
- Extraction IA depuis le programme PDF

### 4.2 Formats de formation

#### Intra-entreprise (format par défaut)
- Commanditaire unique au niveau de la formation
- Financeur unique au niveau de la formation
- Email récapitulatif au commanditaire après l'ajout du dernier participant convoqué

#### Inter-entreprises
- **Gestion par participant** : Commanditaire et financeur gérés individuellement
- **Commanditaire optionnel** : L'assignation d'un commanditaire n'est pas obligatoire
- **Financeur par participant** :
  - Checkbox "Le financeur est le commanditaire"
  - Si décoché : nom et URL du financeur personnalisés
- **Emails d'évaluation à froid** : Programmés uniquement pour les participants ayant un commanditaire assigné ET un financeur différent
- **Mise en copie** : Lors de l'envoi de la convocation, le commanditaire du participant est mis en CC

### 4.3 Gestion des participants

#### Ajout de participants
- **Unitaire** : Email, Prénom, Nom, Entreprise
- **En lot** : Parsing de texte (format flexible)

##### Format d'ajout en lot - Intra-entreprise
```
email@example.com
Prénom Nom email@example.com, Société
```

##### Format d'ajout en lot - Inter-entreprises
```
Prénom Nom email@example.com, Société | Prénom_Cmd Nom_Cmd email_cmd@example.com
email@example.com, Société | email_commanditaire@example.com
```
Le symbole `|` sépare les informations du participant de celles du commanditaire.

#### Informations participant
- Email (obligatoire)
- Prénom, Nom (optionnels)
- Entreprise
- **Inter-entreprises uniquement** :
  - Commanditaire (prénom, nom, email) - optionnel
  - Financeur (même logique que pour l'intra)
  - Facturation (URL facture)

### 4.4 Emails automatisés

#### Règles de programmation selon la proximité

| Proximité | Comportement |
|-----------|--------------|
| Formation passée | Aucun email envoyé (statut `non_envoye`) |
| J < 2 jours | Mode manuel uniquement |
| J-7 à J-2 | Email d'accueil/convocation immédiat |
| J > 7 jours | Processus standard programmé |

#### Convocation (Email d'accueil)
- **Objet** : "Convocation - Formation [Nom de la formation]"
- **Contenu** : Mention "Ce mail constitue votre convocation à la formation" mise en évidence
- **Intra-entreprise** : Email récapitulatif au commanditaire après le dernier ajout
- **Inter-entreprises** : Commanditaire du participant mis en CC

#### Séquence automatique (J > 7)

| Délai | Email | Description |
|-------|-------|-------------|
| J+1 (après ajout) | Recueil des besoins | Invitation à remplir le questionnaire |
| J-7 | Rappel logistique | Informations pratiques sur la formation |
| J-1 | Synthèse formateur | Résumé des besoins collectés pour le formateur |

#### Emails post-formation

| Délai | Email | Condition |
|-------|-------|-----------|
| J+2 (après remerciement) | Relance évaluation 1ère | Évaluation non soumise |
| J+5 (après remerciement) | Relance évaluation 2ème | Évaluation non soumise |
| J+45 (après remerciement) | Évaluation à froid financeur | Financeur ≠ commanditaire, envoyé à romain@supertilt.fr |

#### Actions manuelles disponibles
- Envoi du recueil des besoins (si J-2 ou moins)
- Envoi des documents administratifs
- Envoi de l'email de remerciement avec lien d'évaluation
- Relance des participants n'ayant pas répondu au questionnaire

### 4.5 Questionnaire de recueil des besoins

#### Page publique : `/questionnaire/:token`

Formulaire accessible par les participants sans authentification.

#### Champs collectés
- Informations personnelles (nom, prénom, email, fonction, société)
- Niveau actuel (échelle 1-5)
- Expérience sur le sujet (aucune, courte, longue, certification)
- Compétences actuelles et visées
- Lecture du programme (complète, partielle, non)
- Contraintes organisationnelles
- Besoins d'accessibilité
- Niveau de motivation (échelle 1-5)
- Consentement RGPD

#### Fonctionnalités
- Sauvegarde automatique (autosave)
- Restauration en cas de fermeture accidentelle
- Synchronisation de l'entreprise avec la fiche participant
- Notification automatique des besoins d'accessibilité au formateur

### 4.6 Gestion documentaire

#### Documents gérés
- **Facture PDF** : Upload et envoi
- **Feuilles d'émargement** : PDF ou images, multiples fichiers possibles
- **Lien supports** : URL vers les ressources de formation

#### Envoi de documents
- Destinataire par défaut : commanditaire
- Possibilité d'envoi à une adresse personnalisée
- Email du commanditaire automatiquement en CC si envoi personnalisé
- BCC systématique à romain@supertilt.fr

### 4.6 Émargement électronique

#### Conformité eIDAS

Système de signature électronique simple légalement reconnue en France et dans l'UE.

#### Processus

1. **Déclenchement** : Bouton "Envoyer" dans le bloc émargement (jour J)
2. **Email envoyé** : Lien personnalisé par participant et demi-journée
3. **Page publique** : `/emargement/:token`
4. **Signature** : Canvas tactile/souris via `signature_pad`
5. **Stockage** : Image base64 + horodatage + IP + User-Agent

#### Preuves légales conservées
- Horodatage précis de signature
- Adresse IP du signataire
- User-Agent (navigateur/appareil)
- Date d'envoi et d'ouverture de l'email

#### Export PDF
- Feuille d'émargement complète par session
- Export individuel par participant

### 4.7 Interface utilisateur

#### Page détail (FormationDetail.tsx)
Structure en deux colonnes :
- **Gauche** : Informations générales, Objectifs, Prérequis
- **Droite** : Participants, Communication, Émargement

#### Pages création/édition
- Grille à deux colonnes
- En-tête sticky avec boutons d'action (Enregistrer, Annuler)
- Horaires affichés à côté de chaque date

---

## 5. Module : Évaluations

### 5.1 Formulaire d'évaluation

#### Page publique : `/evaluation/:token`

Accessible via le lien personnalisé envoyé après la formation.

#### Échelle de notation
Inversée : 5 (très satisfait) → 1 (insatisfait)

#### Sections évaluées
- Appréciation générale
- Évaluation des objectifs pédagogiques (dynamique selon la formation)
- Équilibre théorie/pratique
- Rythme de la formation
- Qualification de l'intervenant
- Adaptation au public
- Conditions d'information
- Recommandation (NPS)
- Axes d'amélioration suggérés
- Commentaires libres

### 5.2 Workflow post-soumission

#### Actions automatiques immédiates
1. **Génération du certificat** : PDFMonkey (Template 6593BDA5-6890-45E8-804F-77488D64BEDF)
2. **Stockage Google Drive** : Archivage automatique
3. **Envoi au participant** : Certificat en pièce jointe
4. **Code "FG4FREE"** : Envoyé automatiquement pour les formations "Facilitation graphique"

#### Emails de suivi programmés

| Délai | Email | Objectif |
|-------|-------|----------|
| J+1 | Demande avis Google | Collecte d'avis publics |
| J+7 | Demande témoignage vidéo | Collecte de témoignages |
| J+20 | Évaluation à froid | Mesure de l'impact à moyen terme |

### 5.3 Analyse IA des évaluations

- **Synthèse automatique** : Résumé des retours par formation
- **Points forts identifiés** : Ce qui fonctionne bien
- **Points faibles** : Ce qui peut être amélioré
- **Recommandations** : Actions concrètes suggérées

---

## 6. Module : Certificats

### 6.1 Génération de certificats

#### Informations incluses
- Nom du participant
- Intitulé de la formation
- Dates de la formation
- Durée en heures
- Objectifs pédagogiques atteints

#### Template
PDFMonkey Template ID : `6593BDA5-6890-45E8-804F-77488D64BEDF`

### 6.2 Livraison

- **Email au participant** : PDF individuel
- **Email au commanditaire** (optionnel) :
  - ZIP si plusieurs certificats
  - PDF brut si un seul
- **BCC** : romain@supertilt.fr
- **Délai** : 1 seconde entre chaque email (rate limit Resend)

---

## 7. Module : Améliorations

### 7.1 Sources des améliorations

- **Analyses IA** : Recommandations issues des évaluations
- **Saisie manuelle** : Actions identifiées par le formateur

### 7.2 Catégories

- Contenu pédagogique
- Logistique
- Communication
- Outils et supports
- Autre

### 7.3 Statuts

- **À faire** : Action identifiée
- **En cours** : Travail en cours
- **Terminé** : Action réalisée

### 7.4 Affichage Dashboard

Top 3 des améliorations prioritaires affiché sur la page d'accueil.

---

## 8. Module : Historique

### 8.1 Événements tracés

- Créations (formations, participants, emails...)
- Modifications
- Suppressions
- Envois d'emails (avec objet et contenu consultables)

### 8.2 Recherche avancée

- Filtrage par email destinataire
- Recherche dans les détails (JSONB)
- Filtrage par plage de dates

### 8.3 Consultation des emails

Vue détaillée permettant de consulter :
- Expéditeur
- Destinataire
- Objet
- Contenu complet du message

---

## 9. Tableau de bord

### 9.1 Statistiques affichées

- Graphiques hebdomadaires sur 12 mois :
  - Nombre de micro-devis générés
  - Nombre de formations réalisées
  - Nombre d'évaluations reçues
- Note moyenne globale des évaluations
- Top 3 des améliorations prioritaires

### 9.2 Navigation

Grille de modules avec icônes et descriptions.

---

## 10. Standards techniques

### 10.1 Emails

- **Expéditeur** : romain@supertilt.fr
- **Signature HTML** : API Signitic
- **BCC systématique** : romain@supertilt.fr
- **Boutons calendrier** : Google Calendar + Outlook
- **Ton** : Tutoiement pour les communications participants

### 10.2 Conformité

| Norme | Application |
|-------|-------------|
| **Qualiopi** | Conservation 3 ans, validation prérequis, traçabilité |
| **RGPD** | Consentement explicite, droit à l'oubli |
| **RGAA** | Accessibilité niveau AA |
| **eIDAS** | Signature électronique simple |

### 10.3 Sécurité

- Authentification obligatoire (email + mot de passe)
- RLS (Row Level Security) sur toutes les tables
- Tokens uniques pour les pages publiques
- Changement de mot de passe forcé si nécessaire

---

## 11. Pages publiques (sans authentification)

| Route | Usage |
|-------|-------|
| `/questionnaire/:token` | Recueil des besoins participant |
| `/evaluation/:token` | Évaluation post-formation |
| `/emargement/:token` | Signature électronique de présence |
| `/politique-confidentialite` | Politique de confidentialité |

---

## 12. Évolutions prévues

### 12.1 Corrections et améliorations

| Priorité | Évolution | Description |
|----------|-----------|-------------|
| 🔴 Haute | **Correction de l'émargement électronique** | Debug et stabilisation du système de signature |

### 12.2 Nouvelles fonctionnalités - Gestion financière

| Priorité | Évolution | Description |
|----------|-----------|-------------|
| ✅ Fait | **Gestion financeur intra-entreprise** | Champ financeur au niveau formation avec email d'évaluation à froid |
| ✅ Fait | **Gestion financeur inter-entreprises** | Champ financeur par participant avec email d'évaluation à froid individuel |
| 🟠 Moyenne | **Export automatique du BPF** | Génération automatique du Bilan Pédagogique et Financier |
| 🟡 Basse | **Synthèse actions manquantes BPF** | Tableau de bord des éléments manquants par formation pour le BPF |

### 12.3 Nouvelles fonctionnalités - Prospection et réseau

| Priorité | Évolution | Description |
|----------|-----------|-------------|
| 🟡 Basse | **Recherche LinkedIn participants** | Recherche automatique du profil LinkedIn de chaque participant pour faciliter la connexion post-formation |

### 12.4 Nouvelles fonctionnalités - Offre de formation

| Priorité | Évolution | Description |
|----------|-----------|-------------|
| 🟠 Moyenne | **Créer une formation à venir** | Ajout de nouvelles formations au catalogue (ex: URSSAF) |
| 🟠 Moyenne | **Ajout de formations en ligne** | Support complet des formations 100% distancielles avec spécificités (accès plateforme, etc.) |

### 12.5 Nouvelles fonctionnalités - Évaluations

| Priorité | Évolution | Description |
|----------|-----------|-------------|
| 🟠 Moyenne | **Évaluations embarquées formations en ligne** | Support des évaluations intégrées directement dans les formations e-learning, anonymes par défaut |
| ✅ Fait | **Relance automatique des évaluations** | Emails de relance automatiques à J+2 et J+5 pour les participants n'ayant pas encore soumis leur évaluation |
| 🟡 Basse | **Désactiver les Zaps de collecte de commentaires** | Supprimer ou désactiver les intégrations Zapier qui collectent les commentaires (migration vers solution native) |

### 12.6 Nouvelles fonctionnalités - Logistique

| Priorité | Évolution | Description |
|----------|-----------|-------------|
| 🟡 Basse | **Bouton réservation salle Paris/Lyon** | Intégration d'un bouton pour déclencher une demande de réservation de salle |
| 🟡 Basse | **Réservation restaurant (sessions inter)** | Pour les formations inter-entreprises, gestion de la réservation du restaurant pour les pauses déjeuner |

### 12.7 Conformité et maintenance

| Priorité | Évolution | Description |
|----------|-----------|-------------|
| 🔴 Haute | **Nettoyage des données RGPD** | Mise en place d'un processus automatique de purge des données personnelles après la durée de conservation légale (3 ans Qualiopi) |

---

## 13. Annexes

### 13.1 Tables de la base de données

| Table | Description |
|-------|-------------|
| `trainings` | Formations |
| `training_participants` | Participants aux formations (inclut commanditaire et financeur pour inter-entreprises) |
| `training_schedules` | Planification des jours de formation |
| `training_evaluations` | Évaluations des participants |
| `attendance_signatures` | Signatures électroniques d'émargement |
| `questionnaire_besoins` | Réponses au recueil des besoins |
| `scheduled_emails` | File d'attente des emails programmés |
| `improvements` | Axes d'amélioration |
| `evaluation_analyses` | Analyses IA des évaluations |
| `formation_configs` | Configuration des formations (micro-devis) |
| `activity_logs` | Journal des actions |
| `email_templates` | Templates d'emails personnalisables |
| `trainers` | Formateurs |
| `profiles` | Profils utilisateurs |
| `app_settings` | Paramètres de l'application (délais, jours ouvrés, etc.) |

### 13.2 Colonnes clés - training_participants

| Colonne | Description |
|---------|-------------|
| `sponsor_first_name` | Prénom du commanditaire (inter-entreprises) |
| `sponsor_last_name` | Nom du commanditaire (inter-entreprises) |
| `sponsor_email` | Email du commanditaire (inter-entreprises) |
| `financeur_same_as_sponsor` | Boolean - Le financeur est le commanditaire |
| `financeur_name` | Nom du financeur (si différent) |
| `financeur_url` | URL du financeur/OPCO (si différent) |
| `invoice_file_url` | URL de la facture (inter-entreprises) |

### 13.2 Edge Functions

| Fonction | Rôle |
|----------|------|
| `send-needs-survey` | Envoi du questionnaire de besoins |
| `send-needs-survey-reminder` | Relance questionnaire |
| `send-welcome-email` | Email d'accueil J-7 |
| `send-training-documents` | Envoi des documents administratifs |
| `send-thank-you-email` | Remerciement + lien évaluation |
| `send-attendance-signature-request` | Demande de signature émargement |
| `send-accessibility-needs` | Notification besoins accessibilité |
| `send-questionnaire-confirmation` | Confirmation soumission questionnaire |
| `generate-certificates` | Génération des certificats PDFMonkey |
| `generate-attendance-pdf` | Export PDF émargement |
| `generate-micro-devis` | Génération devis PDF |
| `analyze-evaluations` | Analyse IA des évaluations |
| `extract-objectives-from-pdf` | Extraction objectifs/prérequis via IA |
| `summarize-needs-survey` | Synthèse des besoins pour formateur |
| `process-evaluation-submission` | Workflow post-évaluation |
| `force-send-scheduled-email` | Envoi forcé d'un email programmé |
| `onboard-collaborator` | Création de compte collaborateur |
| `search-siren` | Recherche entreprise par SIREN |

---

*Document mis à jour le 2 février 2026*
*Version : 1.1*

### Historique des versions

| Version | Date | Modifications |
|---------|------|---------------|
| 1.0 | 30 janvier 2026 | Version initiale |
| 1.1 | 2 février 2026 | Ajout gestion financeur intra/inter-entreprises, relances évaluation J+2/J+5 |
