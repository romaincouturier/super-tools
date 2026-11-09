# Contrôle de l'application du référentiel V10 dans SuperTools

Référence : guide de lecture V10, novembre 2026, DGEFP. Contrôle effectué le 5 novembre 2026, par lecture du guide puis exploration du code et de la base de production.

**Ce que ce document dit, et ce qu'il ne dit pas.** Il recense ce que SuperTools sait produire comme preuve. Qualiopi audite l'organisme, pas son logiciel : une preuve absente de l'application peut exister dans une messagerie, un Drive ou un classeur et rester parfaitement recevable. Un manque signalé ici est donc un manque **dans l'outil**, pas une non-conformité constatée.

## Périmètre

SuperTilt est certifié au titre des actions de formation, n'est ni CFA ni certificateur, ne propose pas de formation certifiante, pas d'alternance, et ne sous-traite pas.

**22 indicateurs applicables** : 1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 17, 18, 19, 21, 22, 23, 24, 25, 26, 30, 31, 32.

**11 non applicables** : 3, 7 et 16 (formations certifiantes) ; 13, 14, 15, 20, 29 et 33 (CFA et alternance) ; 27 (pas de sous-traitance) ; 28 (pas de période de formation en situation de travail).

**Gradation.** Le guide liste les indicateurs pouvant donner lieu à une non-conformité mineure : 1, 2, 3, 8, 9, 12, 13, 17, 18, 19, 23, 24, 25, 28, 30 et 33. Tous les autres ne connaissent que la non-conformité **majeure**. Parmi les applicables, sont donc majeurs uniquement : **4, 5, 6, 10, 11, 21, 22, 26, 31, 32**.

Deux précisions de périmètre relevées dans le guide et qui n'étaient pas dans notre analyse de septembre :
- l'indicateur 12 ne s'applique qu'aux **formations de plus de 2 jours** ;
- le glossaire définit le délai d'accès comme « la durée estimée entre la demande du bénéficiaire et le début de la prestation », pas comme une date limite d'inscription.

---

## Tableau de contrôle

| Ind. | Gravité | Ce que SuperTools prouve | Manque dans l'outil |
|---|---|---|---|
| 1 | mineure | Catalogue : prérequis, objectifs, durée, tarif, reconnaissance, délai d'accès, financement, accessibilité. 21/21 formations complètes. Colonne « Mentions » signalant les fiches incomplètes | **5 items exigés sans aucun champ** : modalités pédagogiques, modalités d'évaluation, méthodes mobilisées, modalités d'accès et d'inscription, contact par formation. Et **rien ne publie ces informations hors de l'application** |
| 2 | mineure | Satisfaction par formation et par année, avec la méthode de calcul, texte de diffusion prêt à coller | Aucun taux d'abandon, de réalisation ni de complétion. Rien n'est publié à ce jour |
| 4 | **majeure** | Recueil des besoins participant complet et horodaté : expérience, niveau auto-évalué, validation des prérequis ligne par ligne, contraintes, accessibilité, consentement RGPD. Relance automatique, alerte si prérequis non validé | Côté **entreprise et financeur** : rien de structuré, seulement un texte libre dans la synthèse du devis |
| 5 | **majeure** | Objectifs en liste structurée sur le catalogue et sur la session, hérités à la création, notés 1 à 5 par le participant objectif par objectif | Aucun agrégat par objectif ni par formation |
| 6 | **majeure** | Programme PDF rattaché à la formation et à la session, parcours LMS structuré jusqu'au bloc de contenu, supports de session | Aucun déroulé ni séquencement en base hors LMS : le programme reste un PDF opaque |
| 8 | mineure | Positionnement déclaratif tracé : niveau auto-évalué, validation des prérequis une par une, email d'alerte au participant, état « validé formateur » prévu | **La validation formateur ne peut pas être enregistrée** : la transition d'état n'est écrite nulle part dans le front. Aucun test ni quiz de positionnement à l'entrée |
| 9 | mineure | Page publique de session riche : dates, horaires, objectifs, prérequis, lieu, programme, supports, règlement intérieur, procédure VHD, fiche formateur avec CV. Convocation par email avec trace d'envoi | Le bloc « Instructions spécifiques » **ne peut jamais s'afficher** : une migration a écrasé la fonction sans reprendre la colonne. Pas de livret d'accueil. Règlement intérieur sans historique de version |
| 10 | **majeure** | Besoin d'aménagement recueilli, email automatique au participant, consultation consolidée, suivi individuel des travaux rendus | **Aucune trace de l'adaptation décidée** : pas de champ « aménagement retenu », pas de statut, pas de responsable. Les analyses de besoins générées ne sont **pas stockées**. Le booléen `necessite_amenagement` n'est jamais alimenté par l'interface |
| 11 | **majeure** | Quatre dispositifs : à chaud par objectif, à froid participant, à froid commanditaire, quiz et travaux LMS. Tokens, horodatage, relances | — |
| 12 | mineure | Procédure versionnée et en vigueur, publiée sur la page de session, registre des signalements avec récit tracé, pièces jointes en bucket privé, journal de consultation | S'applique aux formations de plus de 2 jours seulement. Pas d'accusé de lecture, assumé |
| 17 | mineure | Matériel requis par formation, checklist logistique par format, lieux, supports, plateforme LMS, email d'exigences au commanditaire 60 jours avant | — |
| 18 | mineure | Fiche formateur, documents justificatifs, validation d'adéquation formateur/session | Aucune distinction interne/externe. Le guide admet qu'un prestataire indépendant assure seul les fonctions |
| 19 | mineure | Suivi d'effectivité calculé sur les traces réelles : leçons obligatoires terminées, quiz **réussis**, travaux rendus. Un parcours tout coché sans activité rendue est « incomplet », jamais conforme. Seuil d'inactivité 21 jours. Référent pédagogique saisissable, seuil laissé vide faute d'arrêté | L'écran est par parcours LMS, pas par session, et aucun lien n'y mène depuis la fiche session |
| 21 | **majeure** | Compétences, diplômes et CV du formateur, validation d'adéquation aux objectifs de chaque session | **0 document justificatif** chargé en production. 1 seule validation d'adéquation enregistrée |
| 22 | **majeure** | Champ « Formations suivies » prévu sur la fiche formateur | **0 formation renseignée en production.** Aucun plan de formation, aucun entretien professionnel |
| 23 | mineure | Module de veille : 19 sources, 492 éléments, clusters, digest hebdomadaire | **Aucune typologie légale / métier / pédagogique.** Surtout : **aucune trace d'exploitation** — rien ne relie un élément de veille à une décision ou à une évolution de prestation. Or la non-conformité est définie comme « l'absence d'exploitation de la veille mise en place » |
| 24 | mineure | idem | idem |
| 25 | mineure | idem | idem |
| 26 | **majeure** | Besoin d'accessibilité recueilli et transmis au participant | **Aucun réseau de partenaires du handicap** : zéro mention d'Agefiph, Cap emploi, MDPH ou Ressource Handicap Formation. **Aucun référent handicap désigné** : les deux écrans qui l'affichent réutilisent l'expéditeur générique des emails |
| 30 | mineure | Bénéficiaires à chaud et à froid, commanditaire : formulaires tokenisés, relances, horodatage complet. Auto-évaluation du formateur | Financeur : pas de formulaire, seulement un rappel à soi-même et une saisie manuelle. Aucun taux de retour calculé. Table `stakeholder_appreciations` existante mais sans écran |
| 31 | **majeure** | Registre dédié distinguant les trois natures du guide — réclamation, aléa, difficulté — avec gravité, actions décidées, réponse, date de réponse et synthèse | **Aucun accusé de réception n'est envoyé au réclamant.** Or le guide le place en tête des preuves attendues. Et les demandes d'apprenants déposées dans l'espace apprenant partent dans le kanban produit, **sans aucun pont** vers le registre |
| 32 | **majeure** | Registre des risques : 13 risques, 6 de criticité élevée ou critique, tous avec mesure de prévention. Plan d'amélioration en kanban, 6 actions | Le lien réclamation → action d'amélioration n'existe **que** par le registre des risques, dont les rattachements sont facultatifs. Ailleurs, `source_type = 'reclamation'` est une étiquette sans clé étrangère |

---

## Ce que le contrôle a fait corriger

Six points relevés le 5 novembre ont été traités dans la foulée. Le tableau ci-dessus décrit l'état **avant** ces correctifs ; ce qui suit dit ce qui a changé.

### Accusé de réception des réclamations (indicateur 31)

À la soumission du formulaire public, rien n'était envoyé au réclamant. `send-reclamation-acknowledgement` envoie désormais un accusé dont le texte est modifiable dans Paramètres > Emails, et `reclamations.acknowledgement_sent_at` en porte la trace, affichée dans le registre. La fonction ne reçoit que le jeton : le destinataire est lu sur la réclamation, jamais fourni par l'appelant.

### Demandes déposées depuis l'espace apprenant (indicateur 31)

Une insatisfaction pédagogique ou administrative partait dans le kanban produit et n'arrivait jamais au registre. Le routage se décide maintenant dans `src/lib/learnerHelpRouting.ts` : accès et problème technique restent au support, question pédagogique et administratif partent au registre en **difficulté**, et une entrée « Réclamation » y envoie explicitement. L'écriture passe par `create_learner_reclamation`, qui lit l'identité sur le compte connecté.

### Référent handicap et réseau de partenaires (indicateur 26)

Les écrans publics annonçaient un référent en affichant l'expéditeur générique des emails. Quatre réglages portent désormais la désignation, avec sa date, et `useHandicapReferent` ne retombe sur le contact général qu'à défaut, sans prétendre qu'un référent existe. La table `handicap_partners` reprend les sept partenaires tenus jusqu'ici hors de l'application, avec un écran dans Paramètres et un signalement des types de handicap qu'aucun partenaire actif ne couvre.

### Trois fonctions qui ne marchaient pas

1. Le bloc « Instructions spécifiques » de la page publique de session ne pouvait jamais s'afficher : la migration `20260423170103` avait réécrit `get_training_summary_info` sans reprendre la colonne. Rétabli.
2. La validation formateur d'un recueil de besoins ne pouvait pas être enregistrée : l'état et la colonne existaient, aucune écriture ne les posait. Le bouton vit dans la fiche du questionnaire.
3. `formation_configs.format_formation` était lue et écrite par personne. Le champ est éditable.

### Des chiffres mesurés plutôt qu'inventés

`business-health-score` faisait produire par un modèle un taux de complétion et des risques de décrochage à partir d'un contexte qui n'en portait aucune donnée. Les indicateurs chiffrés sont maintenant calculés côté serveur, et le prompt interdit au modèle d'en inventer.

---

## Ce qui reste

- **Compétences et formation continue du formateur** (21 et 22, majeures) : les champs existent, ils sont vides. Zéro justificatif chargé, zéro formation suivie renseignée. La preuve tient en quelques minutes de saisie dans Paramètres > Formateurs.
- **Exploitation de la veille** (23, 24 et 25) : 492 éléments capturés, aucun lien vers une décision, aucune typologie. La non-conformité de ces trois indicateurs est définie comme l'absence d'exploitation.
- **Trace de l'adaptation décidée** (10, majeure) : le besoin d'aménagement est recueilli, un email part, rien n'est tracé ensuite. Les analyses de besoins générées ne sont pas conservées.
- **Les cinq informations manquantes de l'indicateur 1** : modalités pédagogiques, modalités d'évaluation, méthodes mobilisées, modalités d'accès et d'inscription, contact par formation.
- **La publication hors de l'application** : les mentions et les résultats de satisfaction existent en base, aucune page publique ne les porte.

---

## Audit blanc

L'écran `/audit-blanc` déroule les 22 indicateurs applicables : tirage d'un échantillon de sessions récentes, contrôles sur les données, questions pour ce qu'aucune donnée ne tranche, verdict par indicateur selon la gradation du guide. Chaque passage est conservé dans `audit_runs` avec les faits figés à sa date.

Le moteur vit dans `supabase/functions/_shared/qualiopi-referential.ts` et `qualiopi-checks.ts`, partagé entre l'écran et la tâche de nuit : un indicateur ne doit pas être apprécié différemment selon qu'on le regarde depuis le navigateur ou depuis un cron.

### Mise en service de la tâche de nuit

`run-qualiopi-audit` repasse les contrôles automatiques chaque nuit et inscrit chaque constat en défaut dans les actions quotidiennes des administrateurs. Elle n'est pas planifiée par une migration : la règle [036] l'interdit, `vault.decrypted_secrets` étant vide sur ce projet.

**Mise en service, et pourquoi ce secret-là.** Le job a d'abord été posé, le 9 novembre 2026,
avec un en-tête `Authorization: Bearer` portant le secret géré par Lovable : il passait alors
par `hasManagedCronCredential`, et `QUALIOPI_CRON_SECRET` ne servait à rien. Une rotation de ce
secret géré l'aurait cassé en 401 silencieux — le défaut même que la règle [036] cherche à
éviter, déplacé d'un secret à l'autre. Le cron a donc été recâblé sur un secret dédié, dont la
rotation est décidée ici et nulle part ailleurs.

Deux étapes :

1. Créer le secret d'edge function `QUALIOPI_CRON_SECRET` avec une valeur aléatoire.
2. Planifier le cron en base, en recopiant la valeur du secret inline :

```sql
select cron.schedule(
  'run-qualiopi-audit',
  '40 6 * * *',
  $$
  select net.http_post(
    url := 'https://<projet>.supabase.co/functions/v1/run-qualiopi-audit',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<valeur du secret>'),
    body := '{}'::jsonb
  );
  $$
);
```

Ce SQL ne peut pas être exécuté par l'assistant : le rôle qui lit le secret n'a pas de droit sur
le schéma `cron` (`permission denied for schema cron`), et celui qui a ce droit écrirait la
valeur en clair dans le journal de la conversation. Il se passe depuis l'éditeur SQL Supabase.

**L'heure n'est pas libre.** `generate-daily-actions` passe à 06:05 et commence par supprimer
toutes les actions non terminées du jour, pour chaque destinataire et toutes catégories
confondues, avant de régénérer les siennes (`supabase/functions/generate-daily-actions/index.ts`,
la boucle `for (const recipient of recipients)` qui précède les insertions). Un audit planifié
avant 06:05 écrirait donc ses constats pour les voir effacés une demi-heure plus tard, sans
erreur ni trace : l'administrateur ne verrait jamais rien, et le cron se déclarerait en succès.
Toute replanification doit rester après `generate-daily-actions`. 06:30 est déjà occupé par
`backfill-practice-hashtags-nightly`, d'où 06:40.

Les deux fonctions datent leurs lignes avec `new Date().toISOString().split("T")[0]`, donc sur
la même journée UTC : pas de décalage de fuseau entre l'écriture et la purge.

**Vérifier sans lire le secret.** `cron.job_run_details` dit si le cron s'est déclenché, pas si
l'edge function a répondu. Pour la réponse réelle, rejouer la commande du job sans jamais
l'afficher, puis lire le code HTTP :

```sql
do $$
declare c text;
begin
  select command into c from cron.job where jobname = 'run-qualiopi-audit';
  execute c;
end $$;

select id, status_code, left(content, 200)
from net._http_response order by id desc limit 1;
```

Un cron en échec sur ce projet échoue silencieusement : sans ce contrôle, un 401 ressemble à une
nuit sans constat. Relevé du 9 novembre 2026 : `200`, `{"success":true,"issues":17,"actions":17}`.

Attention, ce rejeu n'est pas une simulation : il écrit un passage dans `audit_runs` et les
actions du jour correspondantes.
