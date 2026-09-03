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

Direction retenue : **claire, aérée, moderne**, dans la continuité visuelle de SuperTool, avec le jaune comme couleur identitaire forte mais non omniprésente. La landing est plus expressive que l'espace apprenant, mais reste du même univers produit.

### Couleurs

```text
Jaune         #ffd100   → couleur identitaire : hero, accents, badges, soulignements, CTA
Anthracite    #101820   → texte, section sombre unique, footer
Gris clair    #f2f4f4   → fonds de sections alternées
Blanc         #ffffff   → fond dominant, cartes
```

### Rythme des fonds

Le jaune n'apparaît qu'à deux endroits, pour garder son impact.

```text
Hero                     jaune franc          ← seule grande zone jaune
Formations gratuites     blanc
Les 3 expertises         gris clair
Réassurance              blanc
Formations payantes      gris clair
SuperTilt, c'est aussi   anthracite           ← unique section sombre
Rappel de conversion     jaune (bloc arrondi sur fond blanc, pas pleine largeur)
Footer                   anthracite
```

### Typographie

On conserve la typographie déjà en place dans SuperTool ; aucune police nouvelle n'est introduite. Métropolis, prescrit par la charte, sera adopté seulement si les fichiers webfont sont fournis. Les titres restent en graisse forte et taille généreuse, sans condensation artificielle.

### Motifs graphiques : parcimonie

Un ou deux motifs forts maximum par zone, jamais cumulés.

- **Hero** : un arc de cercle anthracite hors-champ. Rien d'autre.
- **Expertises** : un soulignement crayonné sous le titre de section. Pas d'arc, pas de texture.
- **Rappel de conversion** : bloc jaune à grand rayon, encerclement crayonné sur un mot du titre.
- Ailleurs : aucun motif. Les cartes restent nettes, à angles arrondis (16-24 px).
- Pas de texture granuleuse, pas d'accumulation d'arcs, pas de crayonnés décoratifs dispersés.

### Logo

Version sans baseline, via le composant existant `SupertiltLogo` : anthracite sur fond jaune et clair, blanc sur fond anthracite (footer et section sombre).

### CTA

Lisibilité et hiérarchie avant tout, pas de règle mécanique :
- sur fond jaune : bouton anthracite, texte blanc ;
- sur fond clair : bouton jaune, texte anthracite ;
- sur fond anthracite : bouton jaune.

Un seul CTA primaire par section.

### Dernière section

Titre, texte et CTA uniquement. Aucun formulaire.

## Points techniques à préparer

**Formations gratuites** : requête sur les cours publiés au type d'accès gratuit, hors intra et hors clients. Affichage automatique, sans limite fixe.

**Formations payantes** : nécessite un indicateur de mise en avant sur les cours, éditable depuis l'administration LMS, et son exploitation par la landing.

**Parcours sans friction** : mémoriser la formation choisie pendant l'inscription, inscrire automatiquement le nouveau compte à ce cours, puis rediriger vers la page de la formation.

**Référencement** : title et meta description propres à l'Academy, un seul H1, texte alternatif sur les visuels de formation.

**Tokens** : les couleurs de la charte existent déjà dans le design system (`--primary` jaune, `--foreground` anthracite, `--secondary` gris). Aucune couleur codée en dur, uniquement des tokens sémantiques.

**Motifs** : arc et crayonnés produits en SVG inline léger, sans dépendance ni image lourde.

**Assets à récupérer si disponibles** :
- logo SuperTilt vectoriel, dont une version blanche ;
- visuels des formations (miniatures 16:9).

---

## Éléments encore à fournir

- Preuves de réassurance : chiffres exacts, témoignages réels, références clients. Tant qu'ils manquent, la section n'est pas publiée.
- Formations payantes à mettre en avant.
- Fichiers Métropolis (woff2) si licence disponible.

---

## Prochaine étape

Implémenter la landing : refonte de `src/pages/Landing.tsx` selon l'architecture et la direction ci-dessus, indicateur "mise en avant" côté administration LMS, parcours d'inscription sans friction, et métadonnées SEO.
