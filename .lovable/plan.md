# Plan — Landing page publique "Academy SuperTilt"

Architecture validée. Cette version fige les ajustements demandés et propose la rédaction des contenus, section par section. Pas de design, pas de code à ce stade.

## Ajustements intégrés

- Hero : un seul CTA, "Commencer gratuitement". Le CTA secondaire est supprimé.
- Formations gratuites : affichage automatique de **toutes** les formations gratuites publiées (4 aujourd'hui). Pas de sélection éditoriale.
- Formations payantes : sélection éditoriale via un indicateur "mise en avant" pilotable depuis l'administration LMS.
- Contenu des cartes payantes (prix, durée, etc.) non figé : décidé en phase de conception.
- Parcours gratuit sans friction : depuis une carte gratuite, le visiteur crée son compte et arrive directement dans la formation choisie.
- Aucun bloc placeholder. Pas de vocabulaire "certifiant". Preuves de réassurance réelles uniquement.

## Architecture finale

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

---

## Rédaction des contenus

### 1. Hero

**Sur-titre** : Academy SuperTilt

**H1** : Apprenez, expérimentez, progressez avec SuperTilt.

**Sous-titre** :
L'Academy SuperTilt réunit nos formations en ligne autour de la facilitation graphique, de la facilitation et l'intelligence collective, et de la gestion de projet. Quatre formations sont accessibles gratuitement : il suffit de créer un compte.

**CTA unique** : Commencer gratuitement

### 2. Formations gratuites

**Titre de section** : Commencez gratuitement, dès maintenant

**Chapô** :
Quatre formations complètes, offertes. Choisissez celle qui vous intéresse, créez votre compte en quelques secondes et démarrez immédiatement.

**Carte (structure de contenu)** :
- Visuel de la formation
- Titre de la formation
- Accroche courte issue de la description du cours
- Badge "Gratuit"
- Durée
- CTA : Démarrer cette formation

**Note de parcours** : le CTA d'une carte mène à la création de compte en gardant en mémoire la formation choisie ; une fois le compte créé, l'apprenant est déposé directement dans cette formation, sans étape de recherche.

**Micro-texte sous la section** : Aucune carte bancaire. Accès immédiat.

### 3. Les 3 expertises

**Titre de section** : Ce que vous pouvez apprendre

**Chapô** :
Nos formations couvrent trois domaines complémentaires, utiles séparément et encore plus ensemble.

**Bloc 1 — Facilitation graphique**
Donner à voir les idées : dessiner simplement, structurer visuellement, restituer une réflexion en images.

**Bloc 2 — Facilitation et intelligence collective**
Faire travailler un groupe : concevoir et animer des ateliers, faire émerger les idées, faire décider.

**Bloc 3 — Gestion de projet**
Piloter et embarquer : cadrer un projet, suivre son avancement, communiquer clairement avec les parties prenantes.

### 4. Réassurance

**Titre de section** : Ils apprennent avec SuperTilt

Le contenu de cette section repose exclusivement sur des éléments factuels à fournir. Formats possibles, à retenir selon disponibilité :
- Nombre d'apprenants formés
- Nombre d'ateliers ou d'interventions animés
- Nombre d'années d'activité
- Un ou deux témoignages réels d'apprenants, avec prénom et contexte
- Référence de certification qualité, si applicable
- Logos de clients, si l'accord est acquis

Si un seul élément est disponible, la section n'en affiche qu'un. Si aucun n'est disponible, la section n'est pas publiée.

**À fournir** : les chiffres et témoignages exacts.

### 5. Formations payantes

**Titre de section** : Aller plus loin

**Chapô** :
Des parcours plus complets pour approfondir une expertise et la mettre en pratique dans votre contexte professionnel.

**Carte** : contenu à arbitrer en phase de conception. Éléments candidats : visuel, titre, accroche, durée, prix.

**CTA par carte** : Voir la formation (ouvre la fiche produit sur supertilt.fr dans un nouvel onglet)

**Lien de fin de section** : Voir toutes nos formations sur supertilt.fr

**Sélection** : seules les formations marquées "mise en avant" dans l'administration LMS apparaissent ici.

### 6. SuperTilt, c'est aussi

**Titre de section** : SuperTilt ne s'arrête pas à l'Academy

**Chapô** :
Au-delà des formations en ligne, nous intervenons directement auprès des équipes et des organisations.

**Items (une ligne chacun)**
- Formations en présentiel
- Coaching et accompagnement
- Facilitation d'ateliers et de séminaires
- Scribing et captation graphique en direct

**CTA unique** : Découvrir SuperTilt (vers supertilt.fr)

Section volontairement compacte : elle informe, elle ne détaille pas.

### 7. Rappel de conversion

**Titre** : Prêt à commencer ?

**Texte** :
Créez votre compte et accédez immédiatement à nos quatre formations gratuites.

**CTA** : Commencer gratuitement

### 8. Footer

- Politique de confidentialité
- Contact
- Lien vers supertilt.fr
- Mention légale et année en cours

---

## Points techniques à préparer

**Formations gratuites** : requête sur les cours publiés au type d'accès gratuit, hors intra et hors clients. Affichage automatique, sans limite fixe.

**Formations payantes** : nécessite un indicateur de mise en avant sur les cours, éditable depuis l'administration LMS, et son exploitation par la landing.

**Parcours sans friction** : la formation choisie doit être mémorisée pendant l'inscription, puis l'accès à cette formation attribué automatiquement au nouveau compte, avec redirection directe vers celle-ci.

**Référencement** : title et meta description propres à l'Academy, un seul H1, texte alternatif sur les visuels de formation.

---

## Éléments encore à fournir

- Preuves de réassurance : chiffres exacts, témoignages réels, références clients.
- Formations payantes à mettre en avant.

## Prochaine étape

Valider ces contenus, puis passer au design et à la charte graphique de la page.
