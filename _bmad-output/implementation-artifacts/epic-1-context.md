# Epic 1 Context: Planifier et rédiger tous les contenus dans un calendrier

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Livrer le socle du module Contenus sociaux, sous-module du groupe supertilt.fr (`/supertilt-fr/contenus-sociaux`) : Romain et Emmanuelle rédigent un contenu une fois, le déclinent sur plusieurs canaux avec un visuel de la Médiathèque, le classent par thème et le planifient dans un calendrier mensuel et hebdomadaire conforme à la maquette. Aujourd'hui les posts sociaux se mêlent aux articles dans le kanban newsletter, sans calendrier commun. L'epic doit produire un module utilisable seul au quotidien, sans circuit de validation (epic 2), sans campagnes ni vues liste et aperçu (epic 3), sans MCP (epic 4) et sans migration des cartes post existantes (epic 5).

## Stories

- Story 1.1 : Rédiger un contenu décliné sur plusieurs canaux
- Story 1.2 : Planifier dans le calendrier avec aperçu des contenus
- Story 1.3 : Joindre un visuel de la Médiathèque et être alerté d'un post incomplet
- Story 1.4 : Classer les contenus par thèmes et filtrer
- Story 1.5 : Ouvrir un contenu, le modifier et le marquer publié
- Story 1.6 : Poser des notes dans le calendrier

## Requirements & Constraints

- Accès par le seul droit `supertilt_fr`, aucun droit par sous-module. Un utilisateur sans ce droit ne voit ni l'entrée de menu ni les données.
- Canaux de départ : LinkedIn Romain, LinkedIn Emmanuelle, page LinkedIn SuperTilt, Instagram, YouTube, Facebook, Blog, Le Déclic. Chacun a un nom, une abréviation unique (LI, IN, FA, YO, puis Blog, Déclic) et une limite de texte facultative. La liste s'étend en base, sans code ; Blog et Le Déclic sont des canaux comme les autres.
- Composeur : au moins un canal, format post, story ou reel, thème, date facultative. Un contenu sur N canaux crée un groupe et N posts liés. Tant que la synchro est active, texte et visuel sont communs au groupe ; la couper rend la déclinaison indépendante et une modification ultérieure du groupe ne l'écrase plus.
- Sauvegarde continue : fermer puis rouvrir le composeur retrouve le brouillon sans perte, y compris une frappe faite avant la fin du délai d'enregistrement, et sans créer de groupe en double.
- Axe publication par post : sans date, programmé, marqué comme publié. En epic 1, le statut affiché ne prend que trois valeurs : Brouillon (sans date), Programmé (daté), Publié (marqué). L'échelle complète à cinq statuts arrive en epic 2.
- Marquer publié vaut pour une seule déclinaison, garde le post modifiable et s'annule d'un second geste (retour à programmé si daté, sans date sinon).
- Suppression confirmée : une déclinaison seule, ou tout le groupe sur demande ; supprimer la dernière déclinaison supprime le groupe.
- Alertes V1 : visuel manquant (tous canaux, toute publication porte un visuel) et texte au-delà de la limite du canal, avec la limite et le dépassement. Canal sans limite : jamais d'alerte de longueur. Une alerte disparaît dès la correction et ne bloque ni l'enregistrement, ni la planification, ni le marquage publié.
- Thèmes : liste vide au départ, création, renommage, recoloration. Supprimer un thème laisse les posts intacts, sans thème.
- Notes de calendrier : un jour, un texte, une couleur ; aucun statut, filtre de statut ni compteur de posts.
- Hors périmètre : publication native vers les réseaux, IA de rédaction dans le composeur, médiathèque propre au module, Google Agenda et sessions de formation dans le calendrier.
- Critères communs à chaque story : `npm run typecheck`, `bash scripts/check-rules.sh` et `npm test` passent ; textes UI en français ; chaque écran passe le mode démo (`src/lib/demoMask.ts`, contrôle [065]) ; la PR explicite l'impact sécurité de tout changement dans `supabase/`.

## Technical Decisions

- Cinq nouvelles tables (noms à fixer en story 1.1) : canaux, groupes de posts, posts (une ligne par déclinaison), thèmes, notes. Chacune a la RLS active avec des policies appuyées sur `has_module_access(auth.uid(), 'supertilt_fr')` ou `is_admin`, jamais une logique recopiée, `WITH CHECK` compris. Chacune est ajoutée aux listes de `scheduled-backup` et `backup-export`.
- Piège : `has_module_access` renvoie vrai pour `romain@supertilt.fr` sans ligne de droit. Les tests d'accès (pgTAP) utilisent un compte sans droit, un compte avec droit autre que Romain, un admin et `anon`.
- Schéma par migration rejouable de `supabase/migrations/`, seed des canaux idempotent ; `src/integrations/supabase/types.ts` régénéré, jamais édité (le scan démo en dépend). Le push n'applique pas la migration : elle se joue explicitement en production.
- Propagation du texte et du visuel dans un groupe portée par la base (fonction SQL ou trigger), pas par l'écran, pour être testable sur PGlite et reprise par le MCP.
- Poser ou déplacer la date d'un groupe : une seule fonction SQL atomique, appelée une fois par le service ; elle passe la publication à « programmé » sur toutes les déclinaisons. Un déplacement ne change que le jour et conserve l'heure.
- Contenu partiellement publié : changer la date ou le texte synchronisé ne touche que les déclinaisons non publiées ; le contenu affiche le statut le moins avancé de ses déclinaisons.
- Statut affiché : une seule fonction pure, appelée partout, écrite comme la première étape de l'échelle complète pour que l'epic 2 l'étende sans réécriture.
- Règle d'alerte : une fonction pure dans `supabase/functions/_shared/`, sans dépendance navigateur ni alias `@/`, importée par l'écran (modèle `_shared/micro-devis-followup.ts`) et réutilisée par le MCP en epic 4. Le mode de comptage des caractères (emojis, accents composés, retours ligne) reste à fixer.
- Visuel : référence vers la table `media` avec mise à NULL si le média est supprimé, ce qui rend l'alerte « visuel manquant ».
- Dates et heures en Europe/Paris ; la suite de tests tourne en `TZ=UTC`. Regroupement par jour et date de dépôt dans des fonctions pures qui reçoivent le fuseau, testées autour des changements d'heure. Une note est stockée comme un jour sans heure.
- Flux page, hook (`src/hooks/`, TanStack Query), service (`src/services/`), Supabase ; aucun accès Supabase dans une page ou un composant. Erreurs par `toastError()` et `reportHandledError()`, spinners par `<Spinner />`, confirmations par `useConfirm()`, sauvegarde par `useAutoSaveForm` avec `flushAndGetPending` à la fermeture.
- Glisser-déposer avec dnd-kit (déjà présent) ; logique du dépôt sortie en fonction pure, mécanique couverte par un seul E2E Playwright sur faux backend.
- Visuels choisis via le hook existant de la Médiathèque (`useMediaLibrary`), sans aucun envoi vers le stockage.
- Plan de test : `_bmad-output/test-artifacts/test-design/test-design-epic-1-contenus-sociaux.md` (risques élevés R-01 à R-05 : RLS, synchro, datation atomique, fuseau, sauvegarde continue, à mitiger avant livraison).

## UX & Interaction Patterns

- En-tête à trois onglets : Calendrier (seul actif dans cet epic), Liste, Aperçus. Pas d'onglet MCP.
- Barre de filtres en pastilles : thème (à la couleur du thème), réseau, statut. ET entre familles, OU dans une famille, famille vide égale pas de filtre. La barre des canaux et la pastille « réseau » sont un seul filtre, qui s'applique à la grille et à la colonne Non planifiés. Pas de vues enregistrées dans cet epic.
- Colonne gauche « Non planifiés · N » : brouillons sans date, un groupe compte une fois, notes exclues, badges canaux, glissables sur un jour.
- Grille mensuelle du lundi au dimanche, jour courant mis en évidence, jours hors mois grisés ; vue semaine avec les mêmes cartes sur sept jours.
- Une carte représente un contenu (le groupe), pas une déclinaison : pastille de statut, heure, badges canaux abrégés, liseré gauche à la couleur du thème (neutre sans thème), début du titre tronqué, tri horaire dans le jour.
- Indicateur d'alerte lisible sans ouvrir le post, sur la carte du calendrier, la carte Non planifiés et dans le composeur.
- Légende des statuts en haut à droite : Brouillon, Programmé, Publié dans cet epic.
- Clic sur une carte : détail modifiable (texte, visuel, canaux, thème, format, date et heure), avec marquage publié et suppression.
- Notes affichées sur leur jour, visuellement distinctes des cartes de contenu.

## Cross-Story Dependencies

- La story 1.1 crée le module, le menu, les canaux, groupes et posts, la synchro en base et la colonne Non planifiés : toutes les autres en dépendent. Les stories 1.4 (thèmes) et 1.6 (notes) ajoutent leurs tables au même dispositif RLS et sauvegarde.
- La story 1.3 étend au visuel la propagation de groupe de la story 1.1 ; son indicateur s'affiche sur les cartes de la story 1.2.
- La story 1.4 s'appuie sur la carte et le filtre canal de la story 1.2 (liseré, pastilles).
- La story 1.5 réutilise la fonction de statut affiché de la story 1.2 et le composeur de la story 1.1.
- Epic 2 étendra la fonction de statut affiché : un post daté non approuvé y affichera Brouillon au lieu de Programmé (changement visible à acter avec Romain). Epic 4 réutilisera la règle d'alerte et la propagation en base. Epic 5 migrera les 6 cartes post : l'epic 1 ne touche pas `content_cards`.
- Questions ouvertes : heure attribuée à un brouillon sans heure glissé sur un jour ; réactivation possible de la synchro coupée, et avec quel texte.
