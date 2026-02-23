# ADR-008 : Prettier + Husky + lint-staged pour la qualité de code

**Date :** 2026-02 (P1)
**Statut :** Accepté

## Contexte

Le formatage du code était inconsistant entre développeurs. Pas de vérification automatique avant commit.

## Décision

- **Prettier** (`.prettierrc`) : Formatage automatique (print width 100, double quotes, trailing commas)
- **Husky** (`.husky/pre-commit`) : Hook Git pre-commit
- **lint-staged** (`package.json`) : Exécute Prettier + ESLint uniquement sur les fichiers staged

## Conséquences

- **Positif :** Code uniformément formaté, erreurs lint détectées avant push
- **Négatif :** Légère latence sur les commits (1-3s)
