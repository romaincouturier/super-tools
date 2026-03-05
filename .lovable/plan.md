

# Plan: Migration des URLs en dur + Fix build error

## 1. Fix build error (priorité immédiate)

**Fichier:** `src/pages/FormationEdit.tsx` ligne 1019

Le `<ModuleLayout>` ouvert ligne 449 n'est jamais fermé. La ligne 1019 (`</div>`) devrait être `</ModuleLayout>`.

---

## 2. Migration des URLs en dur vers `app_settings`

### Principe

Centraliser toutes les URLs hardcodées dans la table `app_settings` (déjà utilisée pour `google_my_business_url`, `website_url`, etc.) et les lire dynamiquement dans les Edge Functions et le frontend.

### 2a. Nouvelles clés `app_settings` à créer

| Clé | Valeur par défaut | Utilisée dans |
|-----|-------------------|---------------|
| `app_url` | `https://super-tools.lovable.app` | ~20 edge functions |
| `website_url` | `https://www.supertilt.fr` | signitic, certificates, eval, testimonials |
| `blog_url` | `https://supertilt.fr/blog/` | questionnaire confirmation |
| `youtube_url` | `https://www.youtube.com/@supertilt` | certificates, eval |
| `google_maps_api_key` | `AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8` | FormationDetail, TrainingSummary |
| `qualiopi_certificate_path` | `certificat-qualiopi/Certificat QUALIOPI v3.pdf` | generate-micro-devis |

Note : `google_my_business_url`, `supertilt_site_url`, `website_url`, `youtube_url` existent déjà dans certaines fonctions. Il faut harmoniser les noms et s'assurer que toutes les fonctions les lisent depuis `app_settings`.

### 2b. Création d'un helper partagé `app-urls.ts`

Nouveau fichier `supabase/functions/_shared/app-urls.ts` exposant une fonction :

```typescript
export async function getAppUrls(): Promise<Record<string, string>>
```

Cette fonction charge en une seule requête toutes les clés URL depuis `app_settings` et retourne un dictionnaire avec des valeurs par défaut. Mise en cache possible via variable globale (durée de vie = durée de l'invocation).

Export ajouté dans `_shared/mod.ts`.

### 2c. Edge Functions à modifier (~20 fichiers)

Remplacer le pattern :
```typescript
const appUrl = Deno.env.get("APP_URL") || "https://super-tools.lovable.app";
```
par :
```typescript
import { getAppUrls } from "../_shared/app-urls.ts";
const urls = await getAppUrls();
const appUrl = urls.app_url;
```

**Fichiers concernés :**
- `send-devis-signature-request`
- `send-event-share-email`
- `send-convention-reminder`
- `process-session-start`
- `send-training-calendar-invite`
- `force-send-scheduled-email`
- `process-logistics-reminders`
- `send-attendance-signature-request`
- `send-action-reminder`
- `send-event-update-email`
- `send-thank-you-email`
- `generate-daily-actions`
- `send-evaluation-reminder`
- `send-mission-deliverables`
- `zapier-create-training`
- `send-content-notification`
- `send-needs-survey`
- `send-needs-survey-reminder`
- `send-welcome-email`
- `send-elearning-access`

### 2d. Edge Functions avec URLs supertilt.fr/youtube

- `_shared/signitic.ts` : lire `website_url` depuis `getAppUrls()`
- `generate-certificates` : déjà lu depuis `app_settings` (OK, garder)
- `process-evaluation-submission` : déjà lu (OK)
- `send-questionnaire-confirmation` : déjà lu (OK)
- `process-mission-testimonials` : déjà lu (OK)

### 2e. URL Supabase Storage en dur

- `generate-micro-devis` : remplacer l'URL hardcodée par construction dynamique via `SUPABASE_URL` + chemin bucket

### 2f. Frontend — Google Maps API Key

- `FormationDetail.tsx` et `TrainingSummary.tsx` : lire `google_maps_api_key` depuis `app_settings` (via un hook ou une requête au chargement) au lieu du hardcode `AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8`

### 2g. Frontend — Liens supertilt.fr

- `TrainingSummary.tsx` ligne 331 et `Questionnaire.tsx` ligne 817 : lire `website_url` depuis `app_settings`
- `Evaluation.tsx` lignes 694/707 : texte statique, acceptable en dur (contenu de formulaire, pas une URL cliquable technique)
- `FormationCreate.tsx` : le texte "supertilt.fr" dans les lieux prédéfinis est du contenu métier, acceptable en dur

### 2h. URLs Google API (googleapis.com)

Ces URLs sont des endpoints d'API Google stables et ne doivent **pas** être migrées dans `app_settings`. Elles restent en dur :
- `oauth2.googleapis.com/token`
- `www.googleapis.com/upload/drive/v3/files`
- `www.googleapis.com/calendar/v3/...`
- `generativelanguage.googleapis.com/v1beta/openai/`

### 2i. URL AI Gateway (ai.gateway.lovable.dev)

C'est une URL d'infrastructure Lovable, stable et identique pour tous les projets. Elle reste en dur dans les 7 fonctions concernées.

### 2j. Migration SQL

Insertion des valeurs par défaut pour les nouvelles clés :

```sql
INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('app_url', 'https://super-tools.lovable.app')
ON CONFLICT (setting_key) DO NOTHING;
```

### 2k. UI Paramètres

Ajouter `app_url` et `google_maps_api_key` dans la page Paramètres pour qu'ils soient éditables.

---

## Résumé des actions

1. **Fix build** : fermer `</ModuleLayout>` dans FormationEdit.tsx
2. **Migration SQL** : insérer les nouvelles clés dans `app_settings`
3. **Helper partagé** : créer `_shared/app-urls.ts` + export dans `mod.ts`
4. **~20 Edge Functions** : remplacer les fallbacks hardcodés par le helper
5. **1 Edge Function** : construire l'URL storage dynamiquement
6. **2 pages frontend** : lire `google_maps_api_key` depuis la base
7. **2 pages frontend** : lire `website_url` depuis la base
8. **Page Paramètres** : ajouter les nouvelles clés éditables
9. **Redéployer** toutes les Edge Functions

