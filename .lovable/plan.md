## Objectif

Lier les **formules** non plus au catalogue seul, mais à des **sessions** précises (permanentes ou programmées), pour que le routing WooCommerce envoie chaque acheteur dans la bonne session.

## 1. Modèle de données

Nouvelle table de liaison `training_formulas` (M:N entre `trainings` et `formation_formulas`) :

```
training_formulas(
  training_id  uuid → trainings,
  formula_id   uuid → formation_formulas,
  PRIMARY KEY (training_id, formula_id)
)
```

Règle métier (contrainte applicative + trigger SQL) :

- Une `formula_id` peut être attachée à **plusieurs sessions programmées** du même catalogue (cohortes successives), **ou** à **une seule session permanente** (start_date NULL), mais **pas aux deux** simultanément.
- Trigger qui rejette l'insertion si la formule est déjà liée à une session permanente quand on tente de la lier à une session datée (et inversement).

## 2. UI — `FormationDetail` (sessions)

Sur chaque session (programmée ou permanente), ajouter une section **"Formules disponibles"** :

- Multi-select des formules du catalogue.
- Lecture des liaisons existantes via `training_formulas`.
- Désactiver les formules déjà liées à une session du type opposé (avec message explicatif).

## 3. Routing WooCommerce — `supertilt-webhook`

Refactor des lignes 376-430 (`index.ts`) :

```text
product_id → formule → table training_formulas
  ├─ Si dates parsées dans le titre Woo → session programmée matchant la date
  ├─ Sinon, parmi les sessions liées à la formule :
  │    • session permanente si elle existe
  │    • sinon la prochaine session programmée (start_date > today)
  └─ Sinon → inbox to_validate
```

On supprime le fallback "première session permanente du catalogue" qui causait le bug Liza.

## 4. Backfill des liaisons existantes

Pour chaque participant existant avec `formula_id` non nul :

- Insérer `(training_id, formula_id)` dans `training_formulas` (ON CONFLICT DO NOTHING).

Cela conserve l'état actuel comme point de départ ; l'admin ajustera ensuite manuellement via l'UI.

## 5. Correction Liza & Agnès

État actuel constaté :


| Participant        | Session actuelle                | Formule    | Correction                                                 |
| ------------------ | ------------------------------- | ---------- | ---------------------------------------------------------- |
| Liza Gobber        | permanente (497f7804, no date)  | Communauté | déplacer vers la prochaine cohorte Communauté              |
| Agnès Golfier (×2) | permanente + cohorte 2026-05-27 | Communauté | supprimer le doublon dans la permanente, garder la cohorte |


Pour Liza : la prochaine cohorte Communauté du catalogue est  2026-05-27. Je la déplace là

Côté technique : `UPDATE training_participants SET training_id = ... WHERE id = ...` + `DELETE` du doublon Agnès.

## 6. Ordre d'exécution

1. Migration : table `training_formulas` + trigger d'exclusivité + GRANT + RLS + backfill.
2. UI section "Formules" sur `FormationDetail`.
3. Refactor `supertilt-webhook` pour utiliser `training_formulas`.
4. Correction des affectations Liza + Agnès.

## Questions avant de lancer

- Confirme la cible pour Liza : cohorte **mars 2026** ou **mai 2026** ? --> **mai 2026** 
- Pour la formule **Coaché** (16571) du catalogue Facilitation graphique en ligne : actuellement aucune session ne porte cette formule. Tu veux que je crée une session permanente "Coaché" ou tu la lieras manuellement après ? --> Associé à la cohorte de **mai 2026** 
  &nbsp;