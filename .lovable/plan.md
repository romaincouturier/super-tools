# Plan — Landing page publique "Academy SuperTilt"

## Diagnostic de la page actuelle

La page d'accueil publique actuelle (`src/pages/Landing.tsx`, route `/`) est centrée sur la **facilitation graphique** :
- H1 : "Faites parler vos idées, en images".
- Audience ciblée : formateurs, facilitateurs, personnes créatives.
- Section unique "Les formations disponibles" qui liste tous les cours publiés sans distinction gratuit / payant / ressource.
- Footer minimal.

Elle ne reflète donc pas la nouvelle posture de l'Academy SuperTilt : un hub de formations en ligne multi-expertises, avec un fort levier d'acquisition via le gratuit.

## Objectif de la nouvelle landing

Faire comprendre en 10 secondes à un visiteur froid ce qu'est **l'Academy SuperTilt**, puis le guider vers l'action la plus simple : **créer un compte et commencer une formation gratuite**. Les offres payantes et les services hors Academy doivent être visibles mais secondaires.

## Message principal (H1 + baseline)

**H1** : "Academy SuperTilt — Formez-vous aux métiers de la facilitation et de l'intelligence collective"

**Baseline** : "Cours en ligne, mini-formations et ressources gratuites pour apprendre à visualiser, faciliter et piloter. Créez un compte gratuit et commencez dès aujourd'hui."

## Structure de page proposée

### 1. Hero (zone immédiate)
- **Label** : "Academy SuperTilt"
- **H1** (message principal ci-dessus)
- **Sous-titre** expliquant le positionnement : cours en ligne, mini-cours, ressources gratuites, 3 expertises.
- **CTA principal** : "Commencer gratuitement" → ancre vers les formations gratuites / ouverture du modal de création de compte.
- **CTA secondaire** : "Explorer les formations" → ancre vers le catalogue.

### 2. Barre de confiance / promesses
3 items courts, alignés horizontalement :
- "Formations conçues par des facilitateurs expérimentés"
- "Accès gratuit immédiat à 4 formations"
- "Apprentissage à votre rythme, sur desktop et mobile"

### 3. Les 3 expertises de l'Academy
Section explicative pour les visiteurs qui ne connaissent pas SuperTilt. 3 blocs :
- **Facilitation graphique** — apprendre à dessiner, sketchnoter, visualiser.
- **Facilitation & intelligence collective** — animer des réunions, des ateliers, des synthèses.
- **Gestion de projet / agilité** — piloter, décider, communiquer avec le visuel.

Chaque bloc : titre, 2 lignes de description, pictogramme. Pas de lien profond pour l'instant.

### 4. Formations gratuites — "Commencez gratuitement" (CTA principal)
Afficher les cours publiés avec `access_type = 'gratuit'` (les 4 formations gratuites).
- Mise en avant en haut de la section.
- Carte : miniature, titre, courte description, durée estimée, badge "Gratuit".
- CTA : "Créer un compte et commencer" → `/apprenant` (inscription / connexion apprenant).
- Message : "Créez un compte gratuit pour accéder à toutes nos formations gratuites."

### 5. Formations payantes en ligne
Afficher les cours publiés avec `access_type = 'payant'`.
- Section intitulée "Formations payantes en ligne" ou "Approfondissez avec nos formations certifiantes".
- Carte : miniature, titre, description courte, durée, prix (récupéré via `formation_configs`/`formation_formulas`).
- CTA : "Acheter sur supertilt.fr" → lien externe `boutique_url` (même logique que `useRecommendedCourses`).

### 6. Mini-cours et ressources gratuites
Section dédiée aux contenus plus légers (articles, vidéos courtes, templates, etc.).
- Pour l'instant, si la base ne contient pas encore de ressources de ce type, cette section peut être statique / placeholder.
- Objectif : montrer que l'Academy n'est pas qu'un catalogue de gros parcours.
- CTA : "Découvrir les ressources" → ancre ou page à venir.

### 7. SuperTilt, c'est aussi… (hors Academy, positionné secondaire)
Section de clôture informative, sans voler la vedette à l'Academy :
- Formations en présentiel
- Coaching et accompagnement
- Facilitation
- Scribing / dessin en live
- CTA unique : "Découvrir SuperTilt" → lien externe vers `supertilt.fr`.

### 8. Preuve sociale / engagement (optionnel mais recommandé)
Si disponible : témoignage ou chiffre simple (ex. "X apprenants formés"). Sinon gardé pour une itération ultérieure.

### 9. Footer
- Liens : Politique de confidentialité, Contact, Conditions générales.
- Liens externes : SuperTilt (site principal), Blog, LinkedIn.
- Mention légale.

## Hiérarchie des contenus

```text
Niveau 1 — Conversion immédiate
  Hero + CTA "Commencer gratuitement"
  Barre de confiance

Niveau 2 — Comprendre ce qu'est l'Academy
  Les 3 expertises
  Formations gratuites (accès sans friction)

Niveau 3 — Approfondissement / monétisation
  Formations payantes en ligne
  Mini-cours et ressources gratuites

Niveau 4 — Contexte SuperTilt
  "SuperTilt, c'est aussi..."
  Footer
```

## Données et filtres à exploiter

Utiliser les champs déjà présents :
- `lms_courses.status = 'published'`
- `lms_courses.access_type` : `'gratuit'` → section gratuite ; `'payant'` → section payante.
- `lms_courses.expertise` : affichage du label via `expertiseLabel()`.
- `formation_configs` / `formation_formulas` : prix, lien boutique, durée (même logique que `useRecommendedCourses`).
- `lms_modules` : nombre de modules par cours.

Ne pas afficher les formations `access_type = 'intra'` ou `expertise = 'intra_clients'`.

## Comportements et CTAs

- Visiteur connecté déjà apprenant : redirection automatique vers `/apprenant` (comportement actuel à conserver).
- Visiteur non connecté : reste sur la landing, CTA "Créer un compte" ouvre `/apprenant`.
- CTA payant : ouverture externe `supertilt.fr` dans un nouvel onglet.
- Navigation fixe : liens d'ancre vers les sections principales.

## Ce qui reste volontairement en dehors de cette page

- Pas de catalogue complet des prestations SuperTilt.
- Pas de formulaire de contact / devis (redirection vers supertilt.fr).
- Pas de détail des programmes complets (accessible après création de compte ou sur la fiche produit).

## Prochaines étapes

1. Valider cette structure et la hiérarchie des contenus.
2. Collecter les textes finaux et les 4 formations à mettre en avant.
3. Concevoir la mise en page et la charte (dans un second temps, comme demandé).
4. Implémenter la nouvelle structure React en réutilisant les hooks existants.
