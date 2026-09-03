# Plan — Landing page publique "Academy SuperTilt"

## Architecture validée

```text
1. Hero                          — comprendre + CTA unique
2. Formations gratuites          — acquisition, très haut de page
3. Les 3 expertises              — situer le périmètre
4. Réassurance (preuves réelles) — crédibilité
5. Formations payantes           — sélection éditoriale
6. SuperTilt, c'est aussi        — offre plus large, secondaire
7. Rappel de conversion          — retour au geste attendu
8. Footer
```

## Ajustements intégrés

- Hero : un seul CTA, "Commencer gratuitement".
- Formations gratuites : affichage automatique de **toutes** les formations gratuites publiées (4 aujourd'hui).
- Formations payantes : sélection éditoriale via un indicateur "mise en avant" pilotable depuis l'administration LMS.
- Parcours gratuit sans friction : depuis une carte gratuite, le visiteur crée son compte et arrive directement dans la formation choisie.
- Aucun bloc placeholder. Pas de vocabulaire "certifiant". Preuves de réassurance réelles uniquement.

---

## Rédaction des contenus

### 1. Hero

**Sur-titre** : Academy SuperTilt

**H1** : Apprenez, expérimentez, progressez avec SuperTilt.

**Sous-titre** :
Des formations en ligne, des mini-cours et des ressources pour progresser en facilitation graphique, intelligence collective et gestion de projet. Et pour commencer, quatre formations sont accessibles gratuitement.

**CTA** : Commencer gratuitement

### 2. Formations gratuites

**Titre** : Commencez gratuitement

**Texte** : Envie de tester l'Academy ? Commencez avec l'une de nos quatre formations gratuites. Créez simplement votre compte et lancez-vous.

**Carte** :
- Visuel de la formation
- Titre de la formation
- Accroche courte issue de la description du cours
- Badge "Gratuit"
- Durée
- CTA : Démarrer cette formation



**Parcours** : depuis une carte, la formation choisie est mémorisée ; après création de compte, l'apprenant est inscrit et redirigé directement vers cette formation, sans recherche.

### 3. Les 3 expertises

**Titre** : Ce que vous pouvez apprendre

Pas de chapô. Les descriptions restent concrètes et centrées sur ce que les personnes vont savoir faire.

**Bloc 1 — Facilitation graphique**
Dessiner simplement, synthétiser une réunion en une image, rendre une idée visible et mémorable.

**Bloc 2 — Facilitation et intelligence collective**
Concevoir et animer des ateliers, faire émerger les idées d'un groupe et l'aider à décider.

**Bloc 3 — Gestion de projet**
Cadrer un projet, suivre son avancement et mieux communiquer avec les personnes impliquées.

### 4. Réassurance

**Titre** : Ils apprennent avec SuperTilt

Section basée uniquement sur des preuves réelles, pas d'argument générique. À remplir avec les éléments disponibles : nombre d'apprenants, années d'activité, témoignages avec prénom et contexte, certification qualité, logos clients (avec accord).

Si un seul élément est disponible, la section n'en affiche qu'un. Si aucun n'est disponible, elle n'est pas publiée.

**À fournir** : chiffres exacts, témoignages réels, références clients.

### 5. Formations payantes

**Titre** : Aller plus loin

**Texte** : Vous voulez approfondir ? Découvrez une sélection de nos formations en ligne.

**Carte** : visuel, titre, accroche, durée, prix (niveau d'information à arbitrer en phase de conception).

**CTA** : Découvrir la formation

**Lien de fin de section** : Voir toutes nos formations sur supertilt.fr

**Sélection** : seules les formations marquées "mise en avant" dans l'administration LMS apparaissent.

### 6. SuperTilt, c'est aussi

**Titre** : Et au-delà de l'Academy ?

**Texte** : Nous proposons aussi des formations en présentiel et accompagnons les équipes directement sur le terrain : coaching, facilitation d'ateliers et de séminaires, scribing…

**CTA** : Découvrir SuperTilt (vers supertilt.fr)

Section volontairement compacte.

### 7. Rappel de conversion

**Titre** : Envie de commencer ?

**Texte** : Choisissez une formation gratuite, créez votre compte et c'est parti.

**CTA** : Commencer gratuitement

### 8. Footer

- Politique de confidentialité
- Contact
- Lien vers supertilt.fr
- Mention légale et année en cours

---

## Design et charte graphique

La charte SuperTilt (octobre 2024) fait office de référence directe pour la landing.

### Couleurs

```text
Jaune         #ffd100   → couleur principale, fonds de sections, badges, CTA primaires
Anthracite    #101820   → texte, fonds sombres, contraste
Gris clair    #f2f4f4   → fonds neutres, cartes
Blanc         #ffffff   → respiration, texte sur fond anthracite
```

Le fond de la landing passe en **jaune SuperTilt** sur les sections hautes (hero, expertises, conversion finale), avec des sections claires (gris/blanc) pour les blocs de catalogue. Le noir n'est utilisé qu'en touches : texte, éléments graphiques, footer.

### Typographie

La charte prescrit **Métropolis** (Bold pour les titres, Regular pour le corps, Light pour les légendes). Si la licence web n'est pas disponible immédiatement, on utilisera **Manrope** comme fallback géométrique proche, puis on basculera sur Métropolis dès que les fichiers seront fournis. Les titres de la landing seront en gras condensé, les corps en sans-serif régulier.

### Formes et motifs

- **Angles très arrondis** (environ 20-40 px) sur les blocs et les cartes, pour un aspect humain et convivial.
- **Arcs de cercle** jaunes/noirs en arrière-plan, coupés hors-champ, pour dynamiser les sections.
- **Crayonnés** : lignes manuscrites sous les titres, encerclements ovales autour de mots-clés.
- **Texture solaire** : disque jaune/orange granuleux en haut de page, rappelant le soleil.
- **Pills et badges** : fond jaune, texte anthracite, bords arrondis complets.

### Logo

Le logo SuperTilt (version sans baseline) est utilisé en **anthracite sur fond jaune/blanc**, et en **blanc sur fond anthracite** dans le footer. L'asset existant `supertilt-logo-anthracite.jpg` est conservé via le composant `SupertiltLogo`. Si un fichier vectoriel ou une version blanche est disponible, on l'intègrera.

### CTA

- Primaire : fond anthracite, texte blanc, bords arrondis, icône flèche.
- Secondaire : fond jaune, texte anthracite, pour les badges et les actions de moindre importance.
- Tertiaire : contour anthracite sur fond clair.

### Sections appliquées

```text
Hero                         — fond jaune, arc noir en haut à droite, logo blanc/anthracite,
                                 H1 large, sous-titre, CTA anthracite
Formations gratuites         — fond blanc ou gris clair, cartes blanches à gros radius,
                                 badge "Gratuit" jaune
Les 3 expertises             — fond jaune, 3 blocs arrondis avec icône + crayonné
Réassurance                  — fond blanc/gris, chiffres et témoignages sobres
Formations payantes          — fond blanc, cartes avec image, prix, CTA
SuperTilt, c'est aussi       — fond anthracite, texte blanc, CTA jaune
Rappel de conversion         — fond jaune, formulaire/CTA final
Footer                       — fond anthracite, logo blanc, liens blancs
```

## Points techniques à préparer

**Formations gratuites** : requête sur les cours publiés au type d'accès gratuit, hors intra et hors clients. Affichage automatique, sans limite fixe.

**Formations payantes** : nécessite un indicateur de mise en avant sur les cours, éditable depuis l'administration LMS, et son exploitation par la landing.

**Parcours sans friction** : mémoriser la formation choisie pendant l'inscription, inscrire automatiquement le nouveau compte à ce cours, puis rediriger vers la page de la formation.

**Référencement** : title et meta description propres à l'Academy, un seul H1, texte alternatif sur les visuels de formation.

**Polices** : vérifier disponibilité de Métropolis en webfont ; sinon fallback Manrope puis migration.

**Assets à produire ou récupérer** :
- logo SuperTilt en blanc (SVG/PNG) pour footer et sections sombres ;
- visuels des formations gratuites et payantes (miniatures 16:9) ;
- éventuellement arcs/cercles en SVG si on ne les code pas directement en CSS.

---

## Éléments encore à fournir

- Preuves de réassurance : chiffres exacts, témoignages réels, références clients.
- Formations payantes à mettre en avant.
- Fichiers Métropolis (woff2) si licence disponible.

---

## Prochaine étape

Valider la direction design, puis implémenter la landing (structure React, tokens CSS, typographie, assets et contenus).
