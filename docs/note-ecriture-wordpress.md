# Note : écrire dans WordPress depuis SuperTools

Destinataire : la chargée de communication.
Objet : ce que SuperTools pourrait faire directement dans WordPress, ce que ça
rapporterait, et ce qu'il faut décider avant.

## Où on en est aujourd'hui

SuperTools **lit** WordPress (les articles publiés sont importés avec leur
contenu, leur catégorie et leurs vues) et, depuis cette évolution, **historise
Google Search Console** : chaque jour, les clics, impressions, positions et
requêtes sont figés en base, page par page.

Concrètement, SuperTools sait maintenant répondre à des questions du type :

- quelles pages sont bien positionnées mais peu cliquées ;
- quelles requêtes sont à un cran de la première page ;
- quelles pages perdent du trafic par rapport au trimestre précédent ;
- quelles URL Google n'a pas indexées.

Ce qu'il **ne fait pas** : rien n'est écrit dans WordPress. Chaque correction
identifiée doit être reportée à la main, une page à la fois.

## Ce que l'écriture permettrait

Par ordre de rapport effort / résultat.

**1. Les meta descriptions manquantes.**
La description affichée sous le titre dans Google. Quand elle est absente,
Google fabrique un extrait à partir de la page, parfois avec un texte qui n'a
rien à y faire (bandeau cookies, menu). SuperTools peut proposer une
description par article, à partir du contenu réel, et la pousser après votre
relecture. Effet attendu : plus de clics à position inchangée. C'est mesurable
dans les quatre à six semaines qui suivent, et la comparaison avant / après est
désormais dans la page Statistiques.

**2. Les titres des pages qui ne convertissent pas.**
Le tableau « CTR anormalement bas » liste les pages bien classées dont personne
ne clique le lien. Ce sont presque toujours des titres écrits pour la page, pas
pour la liste de résultats. Cibler ces pages-là, quelques dizaines, plutôt que
tout le corpus.

**3. Le rafraîchissement des contenus qui marchent déjà.**
Un article qui se positionne depuis des années gagne plus à être mis à jour
qu'un article neuf à écrire. Mise à jour de la date, ajout des liens vers les
contenus récents et vers la page formation correspondante. SuperTools sait
lesquels : ce sont les pages en tête du croisement contenus / audience.

**4. Le maillage interne vers les offres.**
Les articles les plus lus ne mènent pas systématiquement vers la formation
correspondante. Ajouter ce chemin de façon systématique est un travail
mécanique, donc automatisable, avec relecture.

**5. Les données structurées.**
Ce sont des informations invisibles pour le lecteur mais lues par Google et par
les moteurs génératifs : questions / réponses (FAQ), sessions de formation
(dates, lieu, prix), avis clients. SuperTools possède déjà la matière : les
questions fréquentes, les sessions et les témoignages sont en base. Les publier
sous forme structurée est le seul chantier de cette liste qui améliore à la
fois le référencement classique et les chances d'être cité par ChatGPT ou
Perplexity.

**6. Le ménage.**
Redirections des articles obsolètes vers leur version à jour, désindexation des
contenus périmés (comptes rendus d'événements anciens). Effet indirect mais
réel : Google consacre son budget d'exploration aux pages qui comptent.

## Ce qu'il faut avant de lancer

1. **Un accès WordPress dédié** : un compte au rôle limité avec un mot de passe
   d'application, pas le compte administrateur personnel. Révocable en un clic.
2. **Savoir où vivent les meta données** : selon l'extension SEO installée
   (Yoast, Rank Math ou autre), la meta description n'est pas stockée au même
   endroit. À vérifier avant tout développement, c'est ce qui décide de la
   faisabilité du point 1.
3. **Une règle de validation** : ma recommandation est qu'aucune modification
   ne parte sans relecture. Le circuit proposé : SuperTools prépare, vous
   validez lot par lot, la publication suit. Les révisions WordPress
   permettent de revenir en arrière sur chaque page.
4. **Un lot pilote** : vingt pages, pas trois cents. On mesure l'effet réel sur
   les clics avant de généraliser.

## Ce que ça ne fera pas

- Aucune garantie de position. On agit sur ce qui est sous notre contrôle : le
  taux de clic, l'indexation, la structure. Le classement dépend de Google.
- Aucun effet immédiat. Google réexplore les pages sur plusieurs semaines. Les
  chiffres avant / après ne sont lisibles qu'après un mois environ.
- Aucune mesure des citations dans les IA. Personne ne publie cette donnée. Ce
  que l'on peut suivre, c'est le nombre de visites venues de ChatGPT, de
  Perplexity ou de Gemini : SuperTools les compte désormais chaque jour.

## Prochaine étape proposée

Choisir ensemble le lot pilote : les vingt pages qui cumulent le plus
d'impressions avec un taux de clic inférieur à la norme de leur position. La
liste est déjà calculée dans SuperTools, onglet Statistiques, section
Opportunités.
