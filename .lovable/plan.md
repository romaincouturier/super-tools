# Plan de Refactoring — Clean Code sans Régression

## Diagnostic (données réelles)

### Fichiers les plus lourds (God Objects)
| Fichier | Lignes | Problème |
|---|---|---|
| `CardDetailDrawer.tsx` | **2887** | Composant monolithique CRM |
| `FormationDetail.tsx` | **1629** | Page-dieu formations |
| `Questionnaire.tsx` | **1305** | Formulaire monolithique |
| `AttendanceSignatureBlock.tsx` | **1199** | Logique émargement mélangée |
| `useCommercialCoachData.ts` | **1166** | Hook-dieu coach commercial |
| `Evaluation.tsx` | **771** | Formulaire évaluation |
| `TrainingSummary.tsx` | **688** | Page résumé formation |
| `MissionSummary.tsx` | **658** | Page résumé mission |
| `useMissions.ts` | **617** | Hook missions non typé |
| `SponsorEvaluation.tsx` | **606** | Formulaire sponsor |

### Dette technique transversale
- **1419 occurrences de `as any`** dans 67 fichiers → bypass total de TypeScript
- **196 appels `supabase.rpc as any`** → aucune vérification des paramètres RPC
- Pas de couche d'abstraction DB (appels Supabase éparpillés dans les composants)
- Duplication de patterns fetch/loading/error dans chaque page publique
- Pas de tests sur les composants critiques

---

## Phase 1 — Type Safety (risque: nul)
> Objectif : Éliminer les `as any` progressivement sans changer la logique

### 1.1 Typer les appels RPC
Créer `src/lib/supabase-rpc.ts` : un wrapper typé autour de `supabase.rpc()` qui :
- Définit les types d'entrée/sortie pour chaque fonction RPC
- Élimine les `as any` sur les 196 appels RPC
- Fournit autocomplétion et validation compile-time

### 1.2 Typer les accès Supabase directs
Créer des helpers typés dans `src/lib/supabase-queries/` pour les tables non couvertes par les types auto-générés.

### 1.3 Créer des types partagés manquants
- Types pour les réponses RPC publiques
- Types pour les payloads de formulaires (questionnaire, évaluation, etc.)

---

## Phase 2 — Extraction de composants (risque: faible)
> Objectif : Casser les God Objects en sous-composants focalisés

### 2.1 `CardDetailDrawer.tsx` (2887 lignes → ~8 fichiers)
- `CardDetailHeader` — Titre, emoji, badges
- `CardDetailInfo` — Infos client (email, phone, company)
- `CardDetailDescription` — Éditeur description
- `CardDetailActions` — Actions commerciales
- `CardDetailEmails` — Section emails
- `CardDetailComments` — Fil commentaires
- `CardDetailAttachments` — Pièces jointes
- `useCardDetail.ts` — Hook pour la logique métier

### 2.2 `FormationDetail.tsx` (1629 lignes → ~6 fichiers)
- `FormationDetailHeader` — Actions + statut
- `FormationDetailInfo` — Infos générales
- `FormationDetailSchedule` — Planning
- `FormationDetailNotes` — Notes
- `FormationDetailSidebar` — Sidebar latérale
- `useFormationDetail.ts` — Logique métier

### 2.3 `Questionnaire.tsx` (1305 lignes → ~5 fichiers)
- `QuestionnaireInfoSection` — Contexte participant
- `QuestionnaireSkillsSection` — Auto-évaluation
- `QuestionnairePreferencesSection` — Préférences
- `QuestionnaireConsentSection` — RGPD + soumission
- `useQuestionnaire.ts` — Logique fetch/save/submit

### 2.4 `AttendanceSignatureBlock.tsx` (1199 lignes → ~4 fichiers)
- `AttendanceStatusTable` — Tableau des statuts
- `AttendancePdfGenerator` — Génération PDF
- `AttendanceSendDialog` — Envoi des demandes
- `useAttendanceSignatures.ts` — Logique métier

### 2.5 `useCommercialCoachData.ts` (1166 lignes → ~4 fichiers)
- `useCoachContexts.ts` — Gestion des contextes
- `useCoachAnalysis.ts` — Analyse IA
- `useCoachHistory.ts` — Historique
- Types partagés dans `src/types/commercial-coach.ts`

---

## Phase 3 — Couche service DB (risque: moyen, nécessite tests)
> Objectif : Centraliser les accès DB pour éviter la duplication

### 3.1 Pattern Repository
Créer `src/services/` avec des fichiers par domaine :
- `src/services/trainings.ts` — CRUD formations
- `src/services/participants.ts` — CRUD participants
- `src/services/evaluations.ts` — CRUD évaluations
- `src/services/missions.ts` — CRUD missions
- `src/services/crm.ts` — CRUD CRM

### 3.2 Hooks simplifiés
Les hooks React Query deviennent des wrappers fins autour des services :
```ts
// Avant (useMissions.ts — 617 lignes avec as unknown as {...})
const { data } = await (supabase as unknown as {...}).from("missions").select("*")

// Après
const { data } = await missionService.getAll()
```

---

## Phase 4 — Patterns partagés (risque: nul)
> Objectif : Éliminer la duplication de code

### 4.1 Hook `usePublicFormPage`
Les 7 pages publiques partagent le même pattern :
- Fetch par token → loading → error → already submitted → form
- Logo + Card layout + journey tracking
Extraire un hook `usePublicFormPage(token, fetchFn)`.

### 4.2 Hook `useJourneyTracking`
Le tracking des événements de parcours est dupliqué dans 5+ pages.

### 4.3 Hook `useSignaturePad`
La logique canvas + SignaturePad est dupliquée dans 3 pages.

---

## Phase 5 — Tests (risque: nul)
> Objectif : Filet de sécurité pour les refactorings futurs

### 5.1 Tests unitaires prioritaires
- `supabase-rpc.ts` (wrapper typé)
- Services DB (mocks Supabase)
- Fonctions utilitaires existantes non testées

### 5.2 Tests de composants
- Pages publiques (token valide/invalide/déjà signé)
- Formulaires critiques (soumission, validation)

---

## Ordre d'exécution recommandé

```
Phase 1.1 → Phase 4.1-4.3 → Phase 2.1 → Phase 2.2 → Phase 2.3 → Phase 1.2 → Phase 3 → Phase 5
```

1. **Types d'abord** (1.1) — Fondation, bloque les régressions à la compilation
2. **Patterns partagés** (4.1-4.3) — Réduit le volume avant les gros fichiers
3. **God Objects** (2.x) — Le plus visible, le plus impactant
4. **Couche service** (3) — Nécessite types + tests
5. **Tests** (5) — En continu, surtout après Phase 3

---

## Règles de refactoring (zéro régression)

1. **Un fichier à la fois** — Jamais de refactoring transversal en un seul commit
2. **Extract → Import → Delete** — Extraire dans un nouveau fichier, importer, puis supprimer
3. **Tests avant suppression** — Vérifier que le comportement est identique
4. **Pas de changement de logique** — Bug fixes = commits séparés
5. **Types explicites** — Tout nouveau code strictement typé, zéro `any`

---

# Audit Qualiopi — Analyse et plan d'action (conservé)

## Tableau synthétique des indicateurs

| Indicateur | Statut | Ce qui manque | Action prioritaire |
|---|---|---|---|
| 1 - Info publique | Couvert | Page catalogue + TrainingSummary exposent objectifs, prerequis, duree, modalites | Aucune |
| 4 - Analyse besoin | Couvert | Module "Besoins participants" avec questionnaire par token | Aucune |
| 5 - Objectifs operationnels | Couvert | Champs `objectives` sur catalogue et formations, editeur dedie | Aucune |
| 6 - Contenus adaptes | Couvert | Programme PDF, format formation, supports, lien SuperTilt | Aucune |
| 8 - Positionnement entree | Partiel | Prerequis definis mais pas de champ formel "validation des prerequis a l'entree" | Ajouter un champ "prerequis valides" par participant |
| 10 - Adaptation au profil | Couvert | Recueil besoins + adaptations notees dans les notes de formation | Aucune |
| 11 - Evaluation atteinte objectifs | Couvert | Questionnaire evaluation avec notation par objectif | Aucune |
| 17 - Moyens humains/techniques | Partiel | Formateurs existent mais sans competences ni diplomes traces | **PRIORITE 1** |
| 19 - Ressources pedagogiques | Couvert | Documents formation, supports URL, programme PDF | Aucune |
| 21 - Competences intervenants | Manquant | Pas de competences, pas de diplomes/certifs | **PRIORITE 1** |
| 22 - Dev competences intervenants | Manquant | Pas d'historique des formations suivies par les formateurs | **PRIORITE 1** |
| 26 - Referent handicap | Partiel | Pas de champ "referent handicap" | Ajouter dans les parametres |
| 27 - Sous-traitants | Partiel | Pas de registre sous-traitants formel | Documenté hors app |
| 30 - Appreciations parties prenantes | Partiel | Manquent equipes pedagogiques, financeurs | **PRIORITE 2** |
| 31 - Reclamations | Couvert | Module complet | Aucune |
| 32 - Mesures amelioration | Partiel | Pas de lien source | **PRIORITE 3** |

