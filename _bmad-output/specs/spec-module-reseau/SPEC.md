---
id: SPEC-module-reseau
companions:
  - brownfield.md
  - mecanismes-candidats.md
sources:
  - ../../brainstorming/brainstorm-enrichir-module-reseau-2026-11-02/brainstorm-intent.md
  - ../../brainstorming/brainstorm-enrichir-module-reseau-2026-11-02/inspiration-spec-faveurs-cinq-minutes.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Module Réseau : une boucle continue qui vient à Romain

## Why

C'est une douleur à résoudre. Romain a un réseau riche : la communauté agile, LinkedIn, des clubs, des anciens clients depuis 2012 avec une très bonne satisfaction. Mais il ne suit rien et ne relance personne. Il ne capte jamais une rencontre lui-même (« je m'en souviendrai »). Il bloque sur « suis-je intrusif ? » et ne sait pas quoi dire sans utilité visible. Le module Réseau existe depuis mars 2026 et n'a jamais servi : il est invisible et ne produit aucune action quotidienne (voir `brownfield.md`). Le réseau fait vivre SuperTilt : missions, projets, inspiration et surtout recommandations. Un module qui attend que Romain vienne à lui restera vide.

## Capabilities

- **CAP-1**
  - **intent:** Romain voit ses actions réseau dans ses actions quotidiennes, sans ouvrir le module Réseau.
  - **success:** Un jour où un contact remplit les critères de suggestion, une entrée réseau apparaît dans `daily_actions` avec un lien vers le contact. Elle disparaît une fois traitée.
- **CAP-2**
  - **intent:** Après un événement, Romain capture les personnes rencontrées en complétant la synthèse qu'on lui demande déjà.
  - **success:** À partir d'un texte libre, SuperTools propose les contacts avec leur contexte et une date de relance. Ils sont créés en une confirmation, sans formulaire.
- **CAP-3**
  - **intent:** Les contacts que SuperTools connaît déjà (CRM gagné, contacts de mission, commanditaires, participants de formation) entrent dans le réseau sans saisie, comme les pairs et partenaires.
  - **success:** Un import crée un contact par email, avec sa source et sa dernière collaboration. Le relancer ne crée aucun doublon.
- **CAP-4**
  - **intent:** Romain ajoute ses contacts hors SuperTools : l'archive officielle LinkedIn (relations et messages, réimportée régulièrement), l'iPhone en vCard, Gmail (environ 3 ans d'historique), et l'historique 2012-2023 tiré des répertoires et fichiers Dropbox des missions. La communauté des anciens stagiaires de facilitation graphique y est incluse.
  - **success:** Un import produit des contacts dédoublonnés avec ceux qui existent, avec un rapport (créés, fusionnés, rejetés). Un contact incomplet (sans email ni commanditaire identifié) est signalé, pas rejeté en silence.
- **CAP-5**
  - **intent:** Chaque suggestion dit qui contacter, pourquoi maintenant (feu vert justifié) et quoi lui offrir (une utilité concrète), avec les éléments dont Claude a besoin pour rédiger le message.
  - **success:** Aucune suggestion n'est affichée sans raison ni utilité renseignées. Priorité aux contacts perdus de vue depuis 1 à 5 ans, puis aux signaux d'actualité, puis à la qualité de collaboration ; jamais un contact en discussion commerciale, en mission ou contacté récemment. L'actualité est recherchée par Claude (LinkedIn, Internet) au moment de préparer le message, puis journalisée comme signal. Claude, via le MCP, rédige à partir de ces éléments un brouillon Gmail qui cite le contexte propre au contact, avec la signature par défaut. SuperTools ne crée aucun brouillon lui-même.
- **CAP-6**
  - **intent:** Romain garde la décision : il envoie lui-même, reporte, écarte définitivement, ou note une action faite hors outil.
  - **success:** Aucun message ne part sans action de Romain. « Plus tard » et « jamais » retirent le contact des suggestions pour la durée prévue.
- **CAP-7**
  - **intent:** Romain voit quels types de message obtiennent des réponses, pour juger le message et non lui-même.
  - **success:** Chaque action faite reçoit un statut de réponse. Le taux de réponse par type d'action est affiché.
- **CAP-8**
  - **intent:** Le Super Déj est un événement du module Événements. Le Réseau fournit à Claude de quoi le préparer : thème, tablée, invitations, rétroplanning et mail collectif du lendemain.
  - **success:**
    - Pour une date donnée, il propose 4 à 5 invités lyonnais, managers ou entrepreneurs concernés par le thème, avec les passerelles probables entre eux.
    - Les invitations, les relances et le mail J+1 sont prêts à relire.
- **CAP-9**
  - **intent:** Romain sait sur quelle offre chaque contact peut le recommander, et qui lui a apporté chaque lead.
  - **success:** Une fiche contact porte son étiquette d'offre (facilitation graphique, intelligence collective, coaching agile). Une opportunité CRM peut désigner le contact qui l'a recommandée.
- **CAP-10**
  - **intent:** Romain peut faire tout son suivi réseau depuis Claude avec le connecteur SuperTools.
  - **success:** Depuis Claude, il peut :
    - lister les suggestions ;
    - lire une fiche contact avec son historique ;
    - journaliser une action ou une interaction ;
    - rouvrir l'écran et y retrouver ce qui a été journalisé.
- **CAP-11**
  - **intent:** SuperTools sait avec qui une collaboration s'est bien passée : évaluations pour les formations, avis laissé par Romain pour les missions, récap de rencontre pour les événements.
  - **success:** Une mission terminée peut recevoir un avis de Romain. La qualité de collaboration d'un contact se calcule à partir de ces trois sources et influe sur l'ordre des suggestions.

## Constraints

- Aucun envoi automatique ni séquence de relance : l'outil prépare, Romain envoie.
- Aucune suggestion ni aucun message sans raison et utilité concrètes. Les relances génériques (« qu'en as-tu gardé ? », mails de nouvelles en masse) sont exclues.
- Capture : zéro saisie pour ce que SuperTools sait déjà, saisie minimale sinon. Pas de formulaire à champs obligatoires multiples.
- On étend l'existant : tables `network_*`, écran `/reseau`, `generate-daily-actions`. On ne crée pas de module parallèle. La RLS doit ouvrir tout le module à Emmanuelle (responsable communication), en plus de Romain. Aujourd'hui elle est propriétaire seule.
- Le nouveau code respecte le flux page → hook → service → Supabase. Le module existant appelle Supabase directement depuis ses hooks.
- Toute edge function réseau authentifie son appelant. C'est à corriger sur `network-generate-actions`.
- Super Déj :
  - Lyon uniquement ;
  - 4 à 5 personnes, 1 h ;
  - un tous les 2 mois ;
  - repas offert, budget fixé par événement ;
  - parrainage : chaque invité peut amener quelqu'un à la tablée suivante ;
  - règle « on ne vend rien ».
- Textes de l'interface en français.
- Les écrans existants (questionnaire de départ, chat de cartographie, plan d'actions hebdomadaire, score de santé) sont conservés dans un sous-module à part ; le nouveau parcours ne s'appuie pas sur eux.

## Non-goals

- Agile Game Alps et les autres événements organisés : ils sont gérés par le module Événements.
- Envoi automatique, séquences et campagnes de relance.
- Newsletters ou mails de nouvelles génériques en masse.
- Scraping de LinkedIn.
- Saisie manuelle lourde des contacts.

## Success signal

- Pendant 10 semaines sur 12, Romain traite au moins une action réseau qui lui arrive dans ses actions quotidiennes, sans avoir ouvert le module de lui-même.
- Un premier Super Déj a lieu, avec son mail collectif du lendemain envoyé.

## Assumptions

- Les capabilities marquées « à valider » dans le document d'intention forment le périmètre candidat. La revue tranche ce qui reste.
- Les seuils de l'indicateur de succès (10 semaines sur 12) viennent de la spec d'inspiration.
