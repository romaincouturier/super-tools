# Référentiel qualité — décret n° 2026-728

Documentation de migration et récapitulatif de mise en œuvre.

**Texte** : décret n° 2026-728 du 1er août 2026, publié au JO du 4 août, en vigueur le **1er novembre 2026**.
**Référence sortante** : guide de lecture V9 du 8 janvier 2024.
**Champ retenu** : `L. 6313-1-1°`, actions de formation. L'organisme n'est ni CFA ni certificateur.

## Périmètre

Le diff des 32 libellés entre le V9 et l'annexe du décret donne **six indicateurs modifiés** dans notre champ.

| Ind. | Ajout du décret | Statut |
|---|---|---|
| 1 | type de reconnaissance, modalités de financement, interdiction de toute mention trompeuse | livré |
| 2 | diffusion des résultats « en précisant de manière transparente leurs modalités de calcul » | livré |
| 12 | prévention et traitement des violences, du harcèlement et des discriminations | livré |
| 19 | vérification de l'effectivité du suivi à distance, référent pédagogique au-delà d'un seuil | livré |
| 27 | traçabilité de la conformité dans les contrats de sous-traitance | non applicable |
| 32 | analyse des risques sur la qualité des formations | livré |

**Exclusions justifiées.** L'indicateur 33 (évaluation des contenus par les apprenants) n'est coché que dans la colonne apprentissage de l'annexe : il ne s'applique pas. Idem pour les 13, 14, 15, 20 et 29. Les 3, 7 et 16 visent les formations certifiantes. Les 9 et 30 ne changent que sur la formulation. Tous les autres sont inchangés au mot près.

L'indicateur 27 ne s'applique pas : l'organisme ne sous-traite pas. Le formateur externe hébergé sur la plateforme facture ses propres clients et verse une commission ; l'organisme n'est pas le prestataire de cette action.

## Migration

Trois migrations, à appliquer dans l'ordre de leur horodatage. Toutes idempotentes et rejouables sur base vierge.

### `20260902140000_quality_framework_and_vhd_register.sql`

- Réglage `quality_framework_version` (`app_settings`), valeur initiale `V9`.
- `vhd_procedures` : procédure de prévention versionnée, avec son interlocuteur.
- `vhd_reports` : registre des signalements.
- `vhd_report_narratives` : récit du signalement, une ligne par signalement.
- Accès réservé aux administrateurs (`is_admin`), posé dès la création des tables.

### `20260902150000_quality_indicators_1_19_32.sql`

- `formation_configs` : `recognition_type`, `funding_terms`, `access_delay`, `accessibility_terms`.
- `trainings` : `pedagogical_referent_name`, `pedagogical_referent_email`, `pedagogical_referent_designated_at`.
- Réglage `distance_intervenant_threshold`, **volontairement vide**.
- `quality_risks` : registre des risques, criticité calculée par la base (`probability * impact`).

### `20260908100000_quality_risks_module.sql`

- Policy de `quality_risks` étendue au module `risques`, qui porte l'écran dédié. Le droit par `formations` est conservé : personne ne perd l'accès.

### Réversibilité

Aucune donnée existante n'est modifiée ni supprimée : les migrations ajoutent des colonnes et des tables. Un retour arrière consiste à supprimer les trois tables `vhd_*` et `quality_risks`, les sept colonnes ajoutées et les deux réglages. Aucune écriture n'a lieu sur les tables existantes.

### Après application

1. Vérifier que les quatre nouvelles tables existent et que `select` depuis un compte non administrateur renvoie zéro ligne.
2. Renseigner la procédure de prévention dans `vhd_procedures` et la passer en `active`.
3. Compléter les quatre champs d'information du public pour chaque formation du catalogue.
4. Laisser `distance_intervenant_threshold` vide tant que l'arrêté n'est pas publié.
5. Accorder le module `risques` aux comptes qui doivent tenir le registre des risques ; les administrateurs l'ont d'office.
6. Le 1er novembre 2026, passer `quality_framework_version` à `2026-11-01`.

## Sauvegarde

`vhd_procedures`, `vhd_reports` et `quality_risks` sont ajoutées aux deux listes de sauvegarde.

`vhd_report_narratives` est **explicitement exclue** (`scripts/backup-exclusions.txt`). Le registre part dans la sauvegarde et prouve que les signalements sont traités ; le récit nominatif d'une victime ne quitte pas la base. Sans cette exclusion, un témoignage se retrouverait en clair dans Drive pendant toute la rotation, et une demande d'effacement deviendrait impossible à honorer.

## Fichiers

**Migrations** : les trois ci-dessus, plus un garde de rejeu ajouté à `20260904081727_*.sql` (migration LMS venue de `main`, qui cassait la CI).

**Logique métier, testée à 100 %**
- `src/lib/catalogSatisfaction.ts` — moyenne par formation et par année (ind. 2)
- `src/lib/satisfactionDisclosure.ts` — texte de diffusion avec sa méthode (ind. 2)
- `src/lib/vhdConstants.ts` — catégories, statuts, retards, construction d'enregistrement (ind. 12)
- `src/lib/distanceFollowUp.ts` — statut d'effectivité du suivi à distance et faits qui le fondent (ind. 19)
- `src/lib/qualityRiskConstants.ts` — échelles, bandes de criticité et synthèse du registre des risques (ind. 32)

**Accès données**
- `src/hooks/useVhdReports.ts`
- `src/hooks/useDistanceFollowUp.ts` — consolidation des traces LMS existantes
- `src/hooks/usePedagogicalReferent.ts` — référent de session et seuil de l'arrêté
- `src/hooks/useQualityRisks.ts` — registre des risques et ses trois rattachements

**Écrans**
- `src/pages/Signalements.tsx` — registre des signalements (nouveau)
- `src/pages/Catalogue.tsx` — colonne satisfaction et bouton de copie
- `src/components/catalogue/CatalogFormDialog.tsx` — quatre champs d'information du public
- `src/components/lms/DistanceFollowUpTab.tsx` — onglet « Suivi distanciel » d'un parcours LMS
- `src/components/formations/PedagogicalReferent.tsx` — désignation sur la fiche session
- `src/pages/RegistreRisques.tsx` — registre des risques qualité (nouveau)

**Navigation** : `src/App.tsx`, `src/components/AppSidebar.tsx`, `src/components/moduleIcons.ts`, `src/hooks/useModuleAccess.ts`.

**Sauvegarde** : `supabase/functions/scheduled-backup/index.ts`, `supabase/functions/backup-export/index.ts`, `scripts/backup-exclusions.txt`.

## Indicateur 19 : ce qui est vérifié

Aucune donnée nouvelle n'est collectée. Le statut de chaque apprenant se déduit des traces LMS déjà présentes : modules obligatoires terminés (`lms_progress`), modules ouverts (`lms_page_views`), et **activités rendues** — quiz réussis rattachés à une leçon du parcours, dépôts de travaux, devoirs remis.

Le décret demande l'effectivité du suivi, pas un taux de complétion. Deux conséquences dans le calcul :

- un parcours entièrement coché sans une seule activité rendue est `incomplet`, jamais conforme ;
- un parcours sans leçon obligatoire n'a pas d'attendu, donc aucun apprenant ne peut y être déclaré conforme.

Le délai d'inactivité qui déclenche `à relancer` est de 21 jours, passé en paramètre à `computeFollowUp` : il se change en un endroit.

Le référent pédagogique est **facultatif**. Le décret ne l'impose qu'« au-delà d'un nombre d'intervenants par formation, fixé par arrêté » ; l'arrêté n'est pas paru, donc le réglage `distance_intervenant_threshold` reste vide et l'écran le dit. Le renseigner suffira à faire apparaître le seuil, sans redéploiement.

## Indicateur 32 : ce que le registre affirme, et ce qu'il n'affirme pas

Le décret ajoute l'analyse des risques pesant sur la qualité des formations. Il ne fixe **aucun** barème, aucun seuil, aucune obligation chiffrée. Trois conséquences dans le code :

- Les échelles de probabilité et d'impact vont de 1 à 4, **sans valeur médiane** : forcer le choix entre plutôt faible et plutôt fort évite le réflexe du « moyen », qui ne décide rien.
- La criticité est une colonne **générée par la base** (`probability * impact`) : personne ne peut enregistrer une valeur qui contredise ses deux facteurs.
- Les bandes d'affichage (faible, modéré, élevé, critique) ne servent qu'à ordonner la liste et colorer un badge. Elles ne prononcent aucune conformité, et rien dans l'application ne s'en déduit. Les bornes tombent dans les trous de la suite des produits atteignables (1, 2, 3, 4, 6, 8, 9, 12, 16), donc aucune valeur n'est à cheval.

Le seul chiffre qui appelle une action est le nombre de risques actifs de bande élevée ou critique auxquels **aucune mesure préventive** n'est opposée. C'est un constat, pas un verdict.

Les trois rattachements — formation du catalogue, réclamation à l'origine, action d'amélioration engagée — restent facultatifs : un risque transverse n'en a aucun. Ce sont eux qui distinguent la prévention de la correction.

## Reste à faire

- Écran d'édition de la procédure VHD (ind. 12) et preuve de l'information des apprenants.
- Pièces jointes aux signalements et journal des consultations.
