## Détails techniques

**Migration (mise en attente, appliquée à l'acceptation)**

Fichier `.lovable/drafts/var_01m25q33pnfj9t2f1dmwqghm4b/migrations/<ts>_formation_configs_expertise_featured.sql` :

```sql
ALTER TABLE public.formation_configs
  ADD COLUMN IF NOT EXISTS expertise text,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
```

Additif uniquement, aucune politique ni grant à modifier (table existante).

**`src/components/catalogue/CatalogFormDialog.tsx`**
- Étendre `CatalogEntry` avec `expertise: string | null` et `is_featured: boolean`.
- Deux nouveaux états `expertise` / `isFeatured`, hydratés dans le `useEffect` de chargement, inclus dans `formValuesRef` pour l'auto-save, et envoyés dans l'`update`/`insert` de `formation_configs`.
- UI : `Select` alimenté par `EXPERTISE_OPTIONS` de `@/lib/lmsCourseMeta` restreint à `facilitation_graphique`, `agilite`, `intelligence_collective` (+ option « Non renseignée » → `null`), et un `Switch` « Mise en avant », placés à côté du bloc prix/durée.

**`src/pages/Catalogue.tsx`**
- Ajouter `expertise` et `is_featured` au type et au `select`.
- Nouvelle colonne triable « Expertise » dans le tableau, valeur via `expertiseLabel()`, tiret si vide ; badge « Mise en avant » sur la ligne quand `is_featured`.
- Vue carte mobile : afficher l'expertise sous le nom.

**`src/components/lms/CourseMetaDialog.tsx`**
- Nouveau `Select` « Formation du catalogue liée » listant `formation_configs` actives (`id`, `formation_name`, tri `display_order`), avec option « Aucune » → `null`.
- Valeur initiale `course.formation_config_id`, envoyée dans `updateCourse.mutateAsync`.
- Vérifier que `formation_config_id` est bien accepté par `useUpdateCourse` (`src/hooks/useLms.ts`) et l'ajouter au type `LmsCourse` si absent.

**Formules — vérification seulement**
`coaching_sessions_count` est déjà édité dans `CatalogFormDialog.tsx` (état `FormulaEdit`, champ nombre dans le bloc formule, sauvegarde incluse). Aucune modification.

**Vérification**
`npx tsgo --noEmit -p tsconfig.app.json`. Les champs du catalogue ne pourront être testés en conditions réelles qu'après acceptation du brouillon, puisque les deux colonnes n'existent pas encore.

**Hors périmètre**
Le calcul serveur des recommandations, les cartes du tableau de bord apprenant et le bandeau promo : à traiter dans une étape suivante.
