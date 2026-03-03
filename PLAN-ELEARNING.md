# Plan E-Learning - Sessions & Formules

## Contexte existant

L'application SuperTools gère déjà :
- **Formations** (`trainings`) avec `format_formation` incluant `e_learning`, `elearning_duration`, `elearning_access_email_content`
- **Catalogue** (`formation_configs`) avec `woocommerce_product_id`, `supertilt_link`, `elearning_duration`
- **Participants** (`training_participants`) avec questionnaire besoins, évaluations, émargement
- **Emails programmés** (`scheduled_emails`) avec 20+ types d'emails
- **Coupons WooCommerce** (`woocommerce_coupons`) + Edge Function `generate-woocommerce-coupon`
- **Email d'accès e-learning** (`send-elearning-access`) avec support coupon code
- **Pages publiques** : questionnaire besoins (`/questionnaire/:token`), évaluation (`/evaluation/:token`), évaluation commanditaire, évaluation formateur

## Modèle business à implémenter

### 3 formules de formation
| Formule | Contenu | Prix indicatif |
|---------|---------|---------------|
| **Solo** | Accès e-learning seul | - |
| **Communauté** | E-learning + lives collectifs programmés | - |
| **Coachée** | E-learning + lives collectifs + créneaux coaching individuels | - |

### Processus d'onboarding actuel (à conserver)
1. Zapier crée un code de réduction WooCommerce (100%)
2. Email envoyé au participant avec le code pour "acheter" la formation à 0€
3. WooCommerce crée les credentials d'accès LearnDash
4. Facture envoyée en parallèle à l'entreprise

→ L'Edge Function `generate-woocommerce-coupon` fait déjà les étapes 1-2 dans SuperTools. Le flux Zapier reste une option externe.

### Pages publiques (questionnaire/évaluation)
Pour le questionnaire besoins et l'évaluation, seuls le **nom de la formation** et l'**email** sont nécessaires (pas besoin de la formule).

---

## Phase 1 : Modèle de données

### 1a. Colonne `formula` sur `training_participants`

```sql
ALTER TABLE public.training_participants
ADD COLUMN formula TEXT CHECK (formula IN ('solo', 'communaute', 'coachee'));
```

- Nullable (null = formation classique présentielle, pas d'e-learning)
- Permet de gérer des participants avec des formules différentes au sein d'une même formation

### 1b. Table `training_live_meetings` (lives collectifs)

```sql
CREATE TABLE public.training_live_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  meeting_url TEXT,               -- lien Zoom/Teams/etc.
  description TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

- Les lives sont planifiés au niveau de la formation (pas par participant)
- Les participants Communauté et Coachée y ont accès

### 1c. Table `training_coaching_slots` (créneaux coaching individuel)

```sql
CREATE TABLE public.training_coaching_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.training_participants(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  meeting_url TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

- `participant_id` NULL = créneau disponible ; rempli = créneau réservé
- Seuls les participants Coachée peuvent réserver

### 1d. Extension de `scheduled_emails`

Ajouter de nouveaux types d'emails au check constraint :

```sql
-- Nouveaux types à ajouter
'live_reminder'          -- rappel avant un live collectif
'coaching_reminder'      -- rappel avant un coaching individuel
'coaching_booking_invite' -- invitation à réserver un créneau coaching
```

### 1e. Rendre `start_date` nullable sur `trainings`

```sql
ALTER TABLE public.trainings ALTER COLUMN start_date DROP NOT NULL;
```

Les formations e-learning permanentes (catalogue) n'ont pas de date de début fixe. La date est celle d'accès du participant.

---

## Phase 2 : UI - Gestion des sessions e-learning

### 2a. Formule dans AddParticipantDialog

- Ajouter un sélecteur de formule (Solo/Communauté/Coachée) dans le dialog d'ajout de participant
- Visible uniquement quand `format_formation === 'e_learning'`
- La formule conditionne les emails envoyés et les accès

### 2b. Affichage formule dans la liste des participants

- Badge coloré (Solo/Communauté/Coachée) sur chaque participant
- Filtre par formule dans la liste

### 2c. Section "Lives programmés" dans FormationDetail

- Tableau des lives avec date, heure, titre, lien, statut
- Bouton ajouter/modifier/supprimer un live
- Uniquement visible pour les formations e-learning

### 2d. Section "Coaching" dans FormationDetail

- Vue des créneaux de coaching
- Attribution à un participant Coachée
- Statut du créneau (disponible/réservé/complété)

### 2e. Emails automatiques pour les lives

- Programmer automatiquement un email de rappel J-1 et J-0 pour chaque live
- Destinataires : participants Communauté + Coachée
- Template avec les variables : titre, date, lien de connexion

### 2f. Emails automatiques pour le coaching

- Email d'invitation à réserver un créneau coaching (pour Coachée uniquement)
- Email de rappel avant le coaching

---

## Phase 3 : Intégration WooCommerce / LearnDash

### 3a. Génération de coupon WooCommerce (DÉJÀ FAIT)

L'Edge Function `generate-woocommerce-coupon` existe déjà et :
- Génère un code promo unique
- Le crée via l'API REST WooCommerce (`/wp-json/wc/v3/coupons`)
- Le lie au `woocommerce_product_id` du catalogue
- L'enregistre dans `woocommerce_coupons`

L'Edge Function `send-elearning-access` envoie l'email avec le coupon.

→ Le flux actuel (Zapier OU SuperTools) est conservé. **La formule n'est pas indiquée dans WooCommerce** - elle est gérée uniquement côté SuperTools.

### 3b. Automatisation du flux d'onboarding depuis SuperTools

Quand un participant e-learning est ajouté avec une formule :
1. Générer automatiquement le coupon WooCommerce (via l'Edge Function existante)
2. Envoyer l'email d'accès avec le coupon
3. Programmer les emails de suivi selon la formule :
   - **Solo** : questionnaire besoins + évaluation
   - **Communauté** : + rappels lives
   - **Coachée** : + rappels lives + invitation coaching

### 3c. Pages publiques questionnaire/évaluation (PAS DE CHANGEMENT)

Les pages publiques existantes (`/questionnaire/:token`, `/evaluation/:token`) fonctionnent déjà avec un token par participant. Elles n'ont besoin que du nom de formation et de l'email.

→ **Aucune modification nécessaire** pour les pages publiques.

---

## Ordre d'implémentation recommandé

1. **Phase 1** (modèle de données) - Migrations SQL
2. **Phase 2a-2b** (formule dans participant) - UI participant
3. **Phase 2c** (lives) - UI + CRUD lives
4. **Phase 2d** (coaching) - UI + CRUD coaching
5. **Phase 2e-2f** (emails automatiques) - Edge Functions + programmation
6. **Phase 3b** (automatisation onboarding) - Orchestration du flux
