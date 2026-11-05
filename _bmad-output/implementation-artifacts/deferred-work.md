- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-rediger-un-contenu-decline.md`
  summary: Colonne « Non planifiés · N » listant les brouillons sans date avec leurs badges canaux, un clic rouvrant le composeur (story 1.1, UX-DR3).
  evidence: Spec 1.1 à ~2 200 tokens, au-dessus du plafond de 1 600 ; Romain a choisi de découper le 5 nov. À livrer avant ou avec la story 1.2, qui glisse ces brouillons dans le calendrier.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-planifier-dans-le-calendrier.md`
  summary: Tester `listGroupsInRange`, `listUndatedGroups` et `listGroupsByIds` avec un client Supabase simulé (bornes gte/lt, filtre unscheduled, dédoublonnage, liste vide).
  evidence: Relecture de la story 1.2 : aucune assertion ne porte sur les filtres de ces lectures ; il manque un mock du client dans `src/services/socialContents.test.ts`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-planifier-dans-le-calendrier.md`
  summary: Remplacer la lecture en deux temps (ids de posts puis `.in(ids)`) par une seule requête filtrée par jointure interne, avec pagination.
  evidence: Non vérifié (maybe-false) ; deviendrait medium au-delà de 1 000 lignes PostgREST ou d'une URL trop longue. À mesurer quand les brouillons s'accumulent.
