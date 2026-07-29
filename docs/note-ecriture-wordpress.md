# Note : écrire dans WordPress depuis SuperTools

Destinataire : la chargée de communication.
Objet : ce que SuperTools pourrait faire directement dans WordPress, ce que ça
rapporterait, et ce qu'il faut décider avant.

**Statut de cette note : aucune de ces lignes ne repose sur une observation des
données du site.** Elle décrit ce que le système permet et ce qu'il faudrait
décider, à partir du code et du schéma de la base. Les volumes (combien
d'articles sans description, combien de pages mal cliquées, combien de
questions dans la FAQ) ne seront connus qu'une fois la synchronisation Search
Console passée et l'onglet Opportunités renseigné. Chaque chiffre cité en
réunion doit venir de là, pas d'ici.

## Où on en est aujourd'hui

SuperTools **lit** WordPress : les articles sont importés depuis un export CSV
déposé à la main (titre, URL, catégorie, contenu, extrait, vues). Ce n'est pas
une synchronisation automatique : les vues stockées datent du dernier import.

Depuis cette évolution, SuperTools **historise Google Search Console** : chaque
nuit, les clics, impressions, positions et requêtes sont figés en base, page
par page, ainsi que le trafic WordPress du jour.

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

Réserve : SuperTools ne sait pas encore **lesquels** en sont dépourvus. L'export
CSV utilisé pour l'import n'inclut pas la description SEO. Ajouter cette colonne
à l'export puis à l'import est un petit chantier, et c'est le préalable pour
chiffrer le lot au lieu de l'estimer.

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
Première question à trancher, et elle se vérifie en dix minutes : les articles
les plus lus mènent-ils vers la formation correspondante ? Si le chemin manque
sur une partie du corpus, l'ajouter est un travail mécanique, donc
automatisable, avec relecture.

**5. Les données structurées.**
Ce sont des informations invisibles pour le lecteur mais lues par Google et par
les moteurs génératifs : questions / réponses (FAQ), sessions de formation
(dates, lieu, prix), avis clients. SuperTools tient déjà ces trois types de
données (questions fréquentes, sessions, témoignages) ; leur volume réel est à
regarder avant de décider. Les publier sous forme structurée est le seul
chantier de cette liste qui améliore à la fois le référencement classique et
les chances d'être cité par ChatGPT ou Perplexity.

**6. Le ménage.**
Redirections des articles obsolètes vers leur version à jour, désindexation des
contenus périmés. L'onglet Indexation dira lesquels Google ignore déjà, ce qui
évite de trier le corpus à la main. Effet indirect mais réel : Google consacre
son budget d'exploration aux pages qui comptent.

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

Dans l'ordre :

1. Laisser passer la première synchronisation Search Console, puis ouvrir
   Statistiques > Opportunités. C'est le moment où les hypothèses de cette note
   deviennent des chiffres.
2. Regarder deux nombres avant tout : combien de pages figurent dans « CTR
   anormalement bas », et combien d'URL apparaissent comme non indexées.
3. Choisir ensemble le lot pilote : les vingt pages du premier tableau, celles
   qui cumulent le plus d'impressions pour un taux de clic inférieur à la norme
   de leur position.

Si l'un de ces tableaux ressort vide ou très court, tant mieux : cela veut dire
que le chantier n'est pas là, et il faut le dire aussi.
