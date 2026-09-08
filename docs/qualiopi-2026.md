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

Six migrations, à appliquer dans l'ordre de leur horodatage. Toutes idempotentes et rejouables sur base vierge.

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

### `20260908110000_vhd_procedure_public.sql`

- Fonction `get_active_vhd_procedure()`, seule porte ouverte sur `vhd_procedures` pour un visiteur sans compte. Elle ne rend que la version **active** et seulement les champs à publier : ni brouillons, ni versions archivées, ni `created_by`.

### `20260908120000_vhd_narrative_access_log.sql`

- `vhd_narrative_access` : journal des consultations du récit, en lecture seule pour les administrateurs et sans aucune policy d'écriture.
- `read_vhd_narrative()` journalise **avant** de rendre le texte ; `get_vhd_narrative_access()` rend le journal d'un signalement.
- La policy `FOR ALL` de `vhd_report_narratives` est remplacée par ses trois verbes d'écriture : la lecture directe disparaît, seule la fonction reste.

### `20260908130000_vhd_report_attachments.sql`

- Bucket privé `vhd-attachments` et table `vhd_report_attachments`, tous deux réservés aux administrateurs.
- Le bucket est **absent** de `STORAGE_BUCKETS` et déclaré dans `scripts/backup-bucket-exclusions.txt`.

### Réversibilité

Aucune donnée existante n'est modifiée ni supprimée : les migrations ajoutent des colonnes et des tables. Un retour arrière consiste à supprimer les cinq tables `vhd_*`, `quality_risks`, les sept colonnes ajoutées et les deux réglages, puis à rétablir la policy `FOR ALL` d'origine sur `vhd_report_narratives`. Aucune écriture n'a lieu sur les tables existantes.

### Après application

1. Vérifier que les six nouvelles tables existent et que `select` depuis un compte non administrateur renvoie zéro ligne.
2. Rédiger la procédure de prévention dans Signalements → Procédure et la mettre en vigueur.
3. Compléter les quatre champs d'information du public pour chaque formation du catalogue.
4. Laisser `distance_intervenant_threshold` vide tant que l'arrêté n'est pas publié.
5. Accorder le module `risques` aux comptes qui doivent tenir le registre des risques ; les administrateurs l'ont d'office.
6. Le 1er novembre 2026, passer `quality_framework_version` à `2026-11-01`.

## Sauvegarde

`vhd_procedures`, `vhd_reports` et `quality_risks` sont ajoutées aux deux listes de sauvegarde.

Trois éléments sont **explicitement exclus** : la table `vhd_report_narratives`, la table `vhd_report_attachments` et le bucket `vhd-attachments` (`scripts/backup-exclusions.txt` et `scripts/backup-bucket-exclusions.txt`), plus `vhd_narrative_access` qui documente qui a lu quoi et n'apporte rien à une restauration.

Le raisonnement est le même pour les quatre. Le registre part dans la sauvegarde et prouve que les signalements sont traités ; ce qui est nominatif — un témoignage, une attestation jointe, le nom d'un fichier, la trace de qui a lu quoi — ne quitte pas la base. Sans ces exclusions, ces données se retrouveraient en clair dans Drive pendant toute la rotation, et une demande d'effacement deviendrait impossible à honorer.

## Fichiers

**Migrations** : les six ci-dessus, plus un garde de rejeu ajouté à `20260904081727_*.sql` (migration LMS venue de `main`, qui cassait la CI).

**Logique métier, testée à 100 %**
- `src/lib/catalogSatisfaction.ts` — moyenne par formation et par année (ind. 2)
- `src/lib/satisfactionDisclosure.ts` — texte de diffusion avec sa méthode (ind. 2)
- `src/lib/vhdConstants.ts` — catégories, statuts, retards, construction d'enregistrement (ind. 12)
- `src/lib/distanceFollowUp.ts` — statut d'effectivité du suivi à distance et faits qui le fondent (ind. 19)
- `src/lib/qualityRiskConstants.ts` — échelles, bandes de criticité et synthèse du registre des risques (ind. 32)
- `src/lib/vhdProcedure.ts` — versions de la procédure de prévention et conditions de publication (ind. 12)

**Accès données**
- `src/hooks/useVhdReports.ts`
- `src/hooks/useDistanceFollowUp.ts` — consolidation des traces LMS existantes
- `src/hooks/usePedagogicalReferent.ts` — référent de session et seuil de l'arrêté
- `src/hooks/useQualityRisks.ts` — registre des risques et ses trois rattachements
- `src/hooks/useVhdProcedures.ts` — versions de la procédure, archivage avant publication
- `src/hooks/useVhdAttachments.ts` — pièces jointes, URL signée à courte durée

**Écrans**
- `src/pages/Signalements.tsx` — registre des signalements (nouveau)
- `src/pages/Catalogue.tsx` — colonne satisfaction et bouton de copie
- `src/components/catalogue/CatalogFormDialog.tsx` — quatre champs d'information du public
- `src/components/lms/DistanceFollowUpTab.tsx` — onglet « Suivi distanciel » d'un parcours LMS
- `src/components/formations/PedagogicalReferent.tsx` — désignation sur la fiche session
- `src/pages/RegistreRisques.tsx` — registre des risques qualité (nouveau)
- `src/components/formations/VhdProcedureEditor.tsx` — onglet « Procédure » de la page Signalements
- `src/pages/TrainingSummary.tsx` — publication de la procédure sur la page de session
- `src/components/formations/VhdReportEvidence.tsx` — pièces jointes et journal des consultations

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

## Indicateur 12 : comment les apprenants sont informés

La procédure vit dans `vhd_procedures`, pas dans le règlement intérieur. Ce dernier est un PDF déposé dans un réglage unique : le remplacer écrase le précédent, sans historique. On ne pourrait donc pas dire quelle procédure s'appliquait à la date de faits signalés, alors que le registre des signalements référence précisément cette version.

Publier une version **archive** la précédente au lieu de l'écraser, et l'archivage passe avant la mise en vigueur : un index unique interdit deux procédures actives, l'ordre inverse échouerait en laissant l'ancienne en place sans le dire.

Le canal d'information est la page publique de session, `/formation-info/:trainingId`, qui porte déjà le règlement intérieur. Son lien part dans l'email d'accueil de chaque participant (`send-welcome-email`) et dans les rappels de veille et du jour ; chaque envoi horodate `needs_survey_sent_at`. La trace disponible est donc : la version publiée, sa date d'entrée en vigueur, et la date d'envoi du lien à chaque apprenant.

Ce que cela ne prouve pas : que l'apprenant a lu le texte. Le décret demande à l'organisme de s'assurer de la prévention et du traitement de ces situations, sans exiger d'accusé de lecture. Aucune case à cocher n'a donc été imposée, conformément à la consigne de ne pas coder de règle d'audit absente du texte. Une trace individuelle reste possible via le portail apprenant, déjà authentifié, si le besoin apparaît.

Le règlement intérieur gagne à renvoyer vers cette section ; c'est une phrase à ajouter au PDF, hors application.

## Ce que le registre garantit

Une consultation du récit laisse une trace : la lecture passe par une fonction qui journalise avant de rendre le texte, et la policy de lecture directe a été retirée pour que ce ne soit pas qu'une convention. Le journal est visible sous chaque signalement, avec la date et le lecteur.

Une pièce jointe ne quitte pas la base : bucket privé, exclu de la sauvegarde Drive, jamais d'URL publique. Un fichier ne s'ouvre que par un lien signé valable cinq minutes, créé au moment du clic : un lien copié cesse de fonctionner presque aussitôt.

Les deux exclusions de sauvegarde ont le même motif que celle du récit : ce qui est nominatif ne part pas en copie claire dans une rotation conservée sept jours, quatre semaines et trois mois, où une demande d'effacement deviendrait impossible à honorer. Le registre, lui, est sauvegardé et prouve le traitement.

Un accès avec la clé de service échappe au journal. Il couvre l'usage de l'application, pas la base elle-même.
