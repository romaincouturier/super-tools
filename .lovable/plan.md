# Graphique d'heures travaillées

Ajouter un graphique au-dessus de l'historique dans l'onglet "Historique" de `src/pages/TimeTracker.tsx`.

## UI

- Nouveau composant `TimeChart` rendu juste au-dessus du total et de la liste des mois dans `HistoryTab`.
- Card contenant :
  - **Sélecteur de granularité** : boutons toggle `Jour / Semaine / Mois / Année` (Tabs ou ToggleGroup shadcn).
  - **Sélecteur de plage de dates** : 2 `Input type="date"` (Du / Au) + presets rapides (7j, 30j, 90j, 12 mois, Tout).
  - **Graphique en barres** : `BarChart` de `recharts` (déjà utilisé dans le projet), axe X = période, axe Y = heures, tooltip avec total formaté (`Xh YYmin`).
  - Total affiché sur la période sélectionnée.

## Logique

- Filtrer `entries` par `entry_date` dans `[from, to]`.
- Bucketiser selon la granularité avec `date-fns`:
  - jour: `format(d, 'yyyy-MM-dd')`, label `d MMM`
  - semaine: `startOfWeek(d, { weekStartsOn: 1 })`, label `S<num> <yy>`
  - mois: `yyyy-MM`, label `MMM yyyy`
  - année: `yyyy`, label `yyyy`
- Remplir les buckets vides à zéro entre `from` et `to` pour un axe continu.
- Convertir minutes → heures décimales pour l'axe Y, formater le tooltip avec `formatDuration` existant.

## Defaults

- Plage par défaut : 30 derniers jours.
- Granularité par défaut : jour.

## Fichiers

- `src/pages/TimeTracker.tsx` : ajout du composant `TimeChart` (en haut du fichier) et insertion dans `HistoryTab` avant le total.

Aucune modification backend, aucune nouvelle dépendance (recharts et date-fns déjà présents).
