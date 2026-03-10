# Tickets — Violations architecturales non traitées

> Généré le 2026-03-10 — À traiter par ordre de priorité

---

## ARCH-001 — Extraire la logique métier de `BulkAddParticipantsDialog.tsx` (539 l.)

**Priorité** : HAUTE
**Fichier** : `src/components/formations/BulkAddParticipantsDialog.tsx`
**Violation** : Fat component — 9 appels Supabase directs, parsing CSV, envoi d'emails, génération de coupons, scheduling, activity logging mélangés dans le rendu.

### Décomposition

| Extraction | Fichier cible | Responsabilité |
|---|---|---|
| `useParticipantParser` | `src/hooks/useParticipantParser.ts` | Parsing CSV/texte inter-entreprise et standard |
| `insertParticipantsWithQuestionnaires` | `src/services/bulkParticipants.ts` | Insert participants + questionnaires besoins |
| `sendWelcomeEmailsToBatch` | `src/services/bulkParticipants.ts` | Envoi welcome emails en batch |
| `sendElearningAccessToBatch` | `src/services/bulkParticipants.ts` | Génération coupon + envoi accès e-learning |
| `scheduleNeedsSurveyEmails` | `src/services/bulkParticipants.ts` | Calcul jours ouvrés + insert scheduled_emails |

### Résultat attendu

Le composant ne garde que l'UI (textarea, bouton, toast) et orchestre via le hook + service. ~150 lignes max.

### Critères d'acceptation

- [ ] Aucun appel Supabase direct dans le composant
- [ ] Hook `useParticipantParser` testé unitairement (cas CSV, cas texte, cas erreur)
- [ ] Service `bulkParticipants.ts` testé unitairement
- [ ] Comportement identique à l'existant (pas de régression)

---

## ARCH-002 — Extraire la logique métier de `DailyTodoPanel.tsx` (457 l.)

**Priorité** : HAUTE
**Fichier** : `src/components/dashboard/DailyTodoPanel.tsx`
**Violation** : Fat component — 4 appels Supabase, agrégation analytics sur 30 jours, gestion d'état de collapse, toggle optimiste, logique de navigation mélangés.

### Décomposition

| Extraction | Fichier cible | Responsabilité |
|---|---|---|
| `useDailyActions` | `src/hooks/useDailyActions.ts` | Fetch actions, toggle completion (optimistic update) |
| `useDailyAnalytics` | `src/hooks/useDailyAnalytics.ts` | Fetch analytics 30j, agrégation par catégorie, ranking |
| `fetchAggregatedAnalytics` | `src/services/dailyActionAnalytics.ts` | Requête + transformation des données analytics |
| Constantes catégories | `src/lib/dailyActionConstants.ts` | Mapping catégories, display order, icônes |

### Résultat attendu

Le composant ne garde que le rendu des groupes d'actions et des badges analytics. ~200 lignes max.

### Critères d'acceptation

- [ ] Aucun appel Supabase direct dans le composant
- [ ] Hook `useDailyActions` testé (fetch, toggle optimiste, rollback on error)
- [ ] Hook `useDailyAnalytics` testé (agrégation, ranking)
- [ ] Constantes extraites et réutilisables
- [ ] Comportement identique à l'existant

---

## ARCH-003 — Extraire la logique de `UpcomingCalendarPanel.tsx` (213 l.)

**Priorité** : MOYENNE
**Fichier** : `src/components/dashboard/UpcomingCalendarPanel.tsx`
**Violation** : Requêtes parallèles sur 3 tables (trainings, events, live_meetings) + transformation en format unifié + formatage de dates dans le composant.

### Décomposition

| Extraction | Fichier cible | Responsabilité |
|---|---|---|
| `useUpcomingCalendarEntries` | `src/hooks/useUpcomingCalendarEntries.ts` | Fetch 3 sources, unification, tri chronologique |
| `fetchUpcomingTrainings/Events/Lives` | `src/services/calendarEntries.ts` | Requêtes Supabase individuelles |
| `unifyCalendarEntries` | `src/services/calendarEntries.ts` | Mapping vers type unifié `CalendarEntry` |
| `formatCalendarDate`, `groupEntriesByDate` | `src/lib/calendarFormatters.ts` | Formatage aujourd'hui/demain/relatif, groupement |

### Résultat attendu

Le composant ne fait que du rendu de la liste groupée. ~100 lignes max.

### Critères d'acceptation

- [ ] Aucun appel Supabase direct dans le composant
- [ ] Type `CalendarEntry` défini dans `src/types/`
- [ ] Fonctions de formatage testées unitairement
- [ ] Comportement identique à l'existant

---

## ARCH-004 — Décomposer `useCrmBoard.ts` (592 l.)

**Priorité** : MOYENNE
**Fichier** : `src/hooks/useCrmBoard.ts`
**Violation** : Hook monolithique — 11 responsabilités distinctes (board, columns, cards, tags, comments, attachments, email, AI extraction, reports, settings) avec side-effects (Slack, activity logging) mélangés aux mutations.

### Décomposition

```
src/hooks/crm/
├── useCrmBoard.ts              → fetch board (colonnes, cartes, tags)
├── useCrmCardDetails.ts        → fetch détails carte (attachments, comments, activity)
├── useCrmColumnMutations.ts    → create/update/archive/reorder columns
├── useCrmCardMutations.ts      → create/update/move/delete cards (sans side-effects)
├── useCrmTagMutations.ts       → create/delete/assign/unassign tags
├── useCrmComments.ts           → add/delete comments
├── useCrmAttachments.ts        → add/delete attachments
├── useCrmEmail.ts              → send email via edge function
├── useCrmReports.ts            → aggregation queries
├── useCrmSettings.ts           → settings CRUD
└── useCrmMutation.ts           → factory helper partagé
```

### Points critiques

- Extraire le logging d'activité de `useUpdateCard` vers `src/services/crmActivity.ts`
- Extraire les notifications Slack vers `src/services/crmSlack.ts`
- Le mutation factory helper (`useCrmMutation`) doit rester partagé

### Critères d'acceptation

- [ ] Chaque fichier < 80 lignes
- [ ] Aucun side-effect dans les hooks de mutation
- [ ] Re-export barrel file `src/hooks/crm/index.ts` pour rétrocompatibilité
- [ ] Tous les consommateurs existants fonctionnent sans changement d'import
- [ ] Comportement identique à l'existant

---

## ARCH-005 — Décomposer `useEditParticipant.ts` (561 l.)

**Priorité** : MOYENNE
**Fichier** : `src/hooks/useEditParticipant.ts`
**Violation** : Hook retournant 57 valeurs couvrant 10 responsabilités : état dialog, formulaire auto-save, sponsor, financeur, paiement, formule, convention, fichiers, coupon.

### Décomposition

| Extraction | Fichier cible | Responsabilité | Return values |
|---|---|---|---|
| `useAutoSaveForm` | `src/hooks/useAutoSaveForm.ts` | Timer, hash tracking, debounce save | ~5 |
| `useParticipantForm` | `src/hooks/participants/useParticipantForm.ts` | Nom, prénom, email, entreprise | ~8 |
| `useSponsorInfo` | `src/hooks/participants/useSponsorInfo.ts` | Sponsor nom/email | ~6 |
| `useFinanceurInfo` | `src/hooks/participants/useFinanceurInfo.ts` | Financeur + popover | ~8 |
| `usePaymentInfo` | `src/hooks/participants/usePaymentInfo.ts` | Mode paiement, prix, durée | ~6 |
| `useParticipantFiles` | `src/hooks/participants/useParticipantFiles.ts` | Upload/delete documents | ~4 |
| `useParticipantConvention` | `src/hooks/participants/useParticipantConvention.ts` | Upload/delete convention signée | ~5 |

### Points critiques

- `useAutoSaveForm` est réutilisable — gère debounce, hash de l'état, save automatique
- La logique d'upload de fichier est dupliquée entre convention et fichiers participants → extraire `useFileUpload` générique
- Fournir un hook orchestrateur `useEditParticipantComposed` pour rétrocompatibilité

### Critères d'acceptation

- [ ] Chaque hook retourne < 10 valeurs
- [ ] `useAutoSaveForm` testé unitairement (debounce, hash, save)
- [ ] `useFileUpload` réutilisable pour convention et fichiers
- [ ] Hook orchestrateur expose la même interface que l'actuel
- [ ] Comportement identique à l'existant

---

## ARCH-006 — Décomposer `FormationFormSection.tsx` (476 l., ~51 props)

**Priorité** : BASSE
**Fichier** : `src/components/formations/FormationFormSection.tsx`
**Violation** : Composant avec 51 props couvrant 8 sections (type, participants, config, formule, dates, lieu, options, résumé).

### Décomposition

| Extraction | Fichier cible | Props |
|---|---|---|
| `FormationTypeSelector` | `src/components/formations/FormationTypeSelector.tsx` | 2 |
| `ParticipantInput` | `src/components/formations/ParticipantInput.tsx` | 5 |
| `FormationConfigSection` | `src/components/formations/FormationConfigSection.tsx` | ~12 |
| `FormationDatesSection` | `src/components/formations/FormationDatesSection.tsx` | ~12 |
| `LocationSelector` | `src/components/formations/LocationSelector.tsx` | 4 |
| `FormationOptions` | `src/components/formations/FormationOptions.tsx` | 6 |
| `FormationSummary` | `src/components/formations/FormationSummary.tsx` | 4 |

### Résultat attendu

L'orchestrateur principal passe de 476 à ~80 lignes et compose 7 sous-composants focalisés.

### Critères d'acceptation

- [ ] Composant principal < 100 lignes
- [ ] Chaque sous-composant < 100 lignes
- [ ] Aucun sous-composant > 12 props
- [ ] Dialog management encapsulé dans `FormationConfigSection` et `FormationDatesSection`
- [ ] Comportement identique à l'existant

---

## Ordre de traitement recommandé

| # | Ticket | Priorité | Effort estimé | Risque |
|---|--------|----------|---------------|--------|
| 1 | ARCH-001 | HAUTE | Moyen | 9 appels Supabase mélangés — plus gros risque d'incohérence |
| 2 | ARCH-002 | HAUTE | Moyen | Analytics complexes cachées dans un composant UI |
| 3 | ARCH-004 | MOYENNE | Élevé | 11 responsabilités, mais fonctionnel en l'état |
| 4 | ARCH-005 | MOYENNE | Élevé | 57 return values, mais encapsulé |
| 5 | ARCH-003 | MOYENNE | Faible | Plus petit, extraction straightforward |
| 6 | ARCH-006 | BASSE | Moyen | Prop drilling gênant mais pas bloquant |
