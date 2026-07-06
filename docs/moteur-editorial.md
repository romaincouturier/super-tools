# Moteur d'analyse éditoriale — guide d'utilisation

Guide à destination de la responsable éditoriale (ST-2026-0220).

## Le principe

Le moteur lit ce qui entre dans SuperTool (transcripts de réunions et formations, feedbacks de participants), le compare au corpus déjà publié et aux performances réelles (Search Console, statistiques du site, newsletters), puis propose une action éditoriale par sujet. **L'IA recommande, la décision reste humaine.**

## Où ça se passe

Module **Transcripts** (`/transcripts`) → onglet **Recommandations**. C'est la file d'arbitrage. Par défaut elle affiche les fiches « À arbitrer », triées par score de priorité décroissant.

## Comment les recommandations arrivent

- **Automatique** : chaque lundi matin (05:00 UTC), le moteur analyse les nouveaux transcripts exploitables et les feedbacks des formations des 90 derniers jours.
- **Manuel** : le bouton **« Lancer l'analyse éditoriale »** traite immédiatement jusqu'à 10 signaux en attente. S'il en reste, le message l'indique — relancer pour continuer.

## Lire une fiche

Chaque fiche répond à trois questions.

### Est-ce qu'on a déjà traité ce sujet ?

La section **Contenus existants proches** liste les articles publiés les plus proches, avec :
- le pourcentage de similarité sémantique ;
- la date de publication et de dernière modification ;
- les performances réelles : vues, clics Google, impressions, position moyenne.

Les liens sont cliquables. Le **risque de redondance** et le **niveau de couverture** résument le verdict.

### Est-ce que ça vaut le coup ? (scores 0-100)

| Score | Ce qu'il mesure |
|---|---|
| **Priorité** | La synthèse pondérée — c'est lui qui trie la file. |
| Besoin | Intensité du besoin exprimé par la cible (fréquence, douleur, urgence saisonnière). |
| Créativité | Angle SuperTilt spécifique + actualité/saisonnalité. Un sujet fréquent mais générique score moins qu'un sujet fréquent avec un vrai point de vue maison. |
| SEO | Probabilité d'une recherche Google durable, au regard des requêtes qui performent déjà. |
| Commercial | Capacité à générer des leads, lever une objection, appuyer une session programmée ou un OKR. |

### Qu'est-ce qu'on en fait ?

- une **action recommandée** : créer un article, améliorer un article existant, recycler, fusionner, archiver, créer un post LinkedIn, à discuter, ne rien faire ;
- une **justification** courte citant les sources qui ont pesé ;
- une **prochaine étape** concrète.

Le badge orange **« Sensible — validation humaine »** signale les sujets issus de matière confidentielle : le moteur les pénalise et ne les transforme jamais seul en contenu.

## L'arbitrage (3 boutons)

- **Accepter → carte Idées** : crée la carte dans la colonne Idées du kanban Contenus, avec toute la fiche dans la description. Le flux de production habituel prend le relais.
- **À discuter** : ouvre un email pré-rempli (sujet + justification) et classe la fiche « En discussion ».
- **Refuser** : archive la fiche. Le refus est mémorisé — le moteur ne reproposera pas le même sujet (dédoublonnage sémantique à 90 % de similarité).

Le champ **Note de décision** trace le pourquoi. Les filtres (Acceptées / En discussion / Refusées / Toutes) donnent l'historique complet.

## Le référentiel : régler le cerveau du moteur

**Paramètres → Prompts Transcripts → carte « Moteur éditorial »** : la liste des cibles, les règles de saisonnalité (rentrée, plans de développement des compétences, charge mentale juin/décembre…) et les règles de scoring y sont en texte clair, modifiables sans développeur. La modification s'applique dès l'analyse suivante.

Exemples d'ajustements : ajouter une cible, écrire « en ce moment, priorité aux contenus IA pour formateurs », durcir la pénalité sur les sujets génériques.

## Ce que le moteur ne fait jamais

- Publier ou créer une carte sans validation humaine.
- Inventer des chiffres : si Search Console ou Brevo n'ont pas de données, la fiche indique « données indisponibles » et le score s'appuie sur les autres signaux.
- Transformer du personnel ou du confidentiel en idée publique : ces transcripts sont écartés en amont (score 0 ou marquage sensible).

## Routine suggérée

- **Lundi, 15 minutes** : parcourir la file « À arbitrer » du haut vers le bas. Accepter ce qui va au kanban, refuser franchement (ça nourrit l'anti-doublon), mettre « à discuter » ce qui demande un avis.
- **Une fois par trimestre** : relire le référentiel dans les paramètres pour l'ajuster à la saison et aux priorités commerciales.

## Prérequis techniques (une fois)

- Migration `20260702120000_editorial_engine.sql` appliquée et edge function `editorial-engine` déployée.
- Clé OpenAI configurée (Paramètres → Intégrations) : nécessaire à la similarité d'articles. Sans elle, le moteur tourne mais sans comparaison au corpus.
- Propriété Search Console + clé Brevo configurées (Paramètres → Intégrations) pour les données de performance.
- La colonne du kanban Contenus doit s'appeler exactement **« Idées »**.
