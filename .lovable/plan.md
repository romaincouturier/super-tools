# Plan — Landing page publique "Academy SuperTilt" (architecture)

## Diagnostic de la page actuelle

Page d'accueil publique actuelle (`src/pages/Landing.tsx`, route `/`) :
- H1 "Faites parler vos idées, en images" : positionnement exclusivement facilitation graphique.
- Section "Pour qui" : formateurs, facilitateurs, personnes créatives.
- Une seule section formations, qui liste automatiquement **tous** les cours publiés, sans distinction gratuit / payant.
- Footer minimal.

Elle ne représente ni les 3 expertises, ni le rôle d'acquisition des formations gratuites, ni l'existence d'une offre SuperTilt plus large.

## Objectif

Un visiteur froid doit comprendre en quelques secondes : ce qu'est l'Academy SuperTilt, ce qu'il peut y apprendre, qu'il peut commencer gratuitement tout de suite, et qu'il existe ensuite d'autres offres SuperTilt.

**H1 retenu** : "Apprenez, expérimentez, progressez avec SuperTilt."

## Architecture de la page

### 1. Hero
- Label "Academy SuperTilt"
- H1 : "Apprenez, expérimentez, progressez avec SuperTilt."
- Sous-titre : l'Academy = formations en ligne, mini-cours et ressources, sur 3 expertises.
- CTA principal : "Commencer gratuitement" → section formations gratuites.
- CTA secondaire : "Découvrir l'Academy" → ancre vers les expertises.

### 2. Commencez gratuitement (bloc d'acquisition, très haut de page)
Placé immédiatement après le hero, c'est le cœur de la conversion.
- Les 4 formations gratuites, sélectionnées explicitement (pas un listing automatique du catalogue).
- Par carte : miniature, titre, accroche courte, durée, badge "Gratuit".
- CTA par carte + CTA de section : "Créer un compte et commencer" → `/apprenant`.
- Une phrase d'accroche : accès immédiat, simple création de compte.

### 3. Les 3 expertises de l'Academy
Pour situer le périmètre auprès d'un visiteur qui ne connaît pas SuperTilt :
- Facilitation graphique
- Facilitation & intelligence collective
- Gestion de projet

Chaque bloc : titre, une à deux lignes, pictogramme. Sert de repère, pas de catalogue.

### 4. Réassurance (preuves réelles)
Bandeau court, uniquement avec des éléments factuels SuperTilt, à fournir. Exemples de formats possibles :
- Nombre d'apprenants formés
- Nombre d'années d'activité / d'ateliers animés
- Note ou témoignage réel d'apprenant
- Référence de certification qualité, si applicable

Aucun argument générique ("apprenez à votre rythme", "conçu par des experts"). Si une seule preuve est disponible, la section n'en affiche qu'une.

### 5. Aller plus loin — formations en ligne payantes
- Sélection éditoriale de quelques formations payantes, pas l'intégralité du catalogue.
- Par carte : miniature, titre, accroche, durée, prix.
- CTA : "Voir la formation" → fiche produit sur supertilt.fr (nouvel onglet).
- Un lien de fin de section vers le catalogue complet sur supertilt.fr.
- Pas de vocabulaire "certifiant".

### 6. SuperTilt, c'est aussi (secondaire)
Bloc compact, volontairement court, pour signaler l'étendue de l'offre hors Academy :
formations en présentiel, coaching et accompagnement, facilitation, scribing.
Un seul CTA : "Découvrir SuperTilt" → supertilt.fr.

### 7. Rappel de conversion final
Bandeau de clôture qui ramène au geste attendu : créer un compte et démarrer une formation gratuite.

### 8. Footer
Politique de confidentialité, contact, lien vers supertilt.fr, mention légale.

## Hiérarchie

```text
Niveau 1 — Comprendre + convertir
  Hero
  Formations gratuites

Niveau 2 — Situer l'offre et rassurer
  Les 3 expertises
  Réassurance (preuves réelles)

Niveau 3 — Monétisation
  Formations payantes sélectionnées

Niveau 4 — Contexte et clôture
  SuperTilt hors Academy
  Rappel de conversion
  Footer
```

## Principes retenus

- Aucun bloc placeholder : une section dont le contenu n'existe pas n'apparaît pas. Les mini-cours et ressources ne feront donc pas l'objet d'une section tant qu'il n'y a pas de contenu réel à montrer.
- Pas de listing automatique du catalogue : les formations affichées, gratuites comme payantes, sont **sélectionnées**.
- Les formations intra / clients ne sont jamais affichées.
- Le vocabulaire "certifiant" est exclu.
- La partie hors Academy reste courte et clairement secondaire.

## Point technique — sélection des formations mises en avant

La page actuelle interroge `lms_courses` sans filtre éditorial. Pour permettre une sélection maîtrisée, deux options à trancher au moment de l'implémentation :
1. **Réglage en base** : un indicateur de mise en avant sur les cours, piloté depuis l'administration LMS. Le plus souple pour toi, un peu plus de travail.
2. **Liste définie dans le code** : la sélection est fixée dans la page, modifiable par une intervention de ma part.

Recommandation : option 1, pour que tu gardes la main sur ce qui apparaît en page d'accueil.

## Ce qui reste hors périmètre de cette landing

- Catalogue complet des formations.
- Catalogue complet des prestations SuperTilt.
- Formulaire de contact ou de devis.
- Programmes détaillés des formations.

## Éléments à fournir avant l'étape suivante

- Les 4 formations gratuites à mettre en avant.
- La sélection de formations payantes.
- Les preuves de réassurance réelles (chiffres, témoignages, références).

## Prochaines étapes

1. Valider cette architecture.
2. Trancher le mode de sélection des formations mises en avant.
3. Rédiger les textes définitifs.
4. Travailler la mise en page et la charte graphique.
5. Implémenter.
