# Super Tools - Product Requirements Document

> Version reconstruite à partir du code réel
> Référence auditée sur `main` GitHub le 2026-04-03

## 1. Pourquoi ce document existe

Ce PRD sert d'onboarding produit pour une personne qui arrive sur `super-tools`.

Il ne décrit pas une vision théorique ou une roadmap marketing. Il décrit :

- ce que le produit fait réellement aujourd'hui
- les modules visibles dans l'application
- les parcours majeurs
- les intégrations et dépendances importantes
- l'état de maturité observé dans le code
- les angles morts et dettes structurelles à connaître avant de développer

Le document fait foi comme vue d'ensemble produit, mais le code reste la source finale de vérité.

---

## 2. Résumé exécutif

`Super Tools` est une plateforme SaaS modulaire orientée organisme de formation, conseil et pilotage d'activité.

Le produit rassemble dans une seule application :

- gestion des formations et de l'e-learning
- CRM commercial et génération de devis
- suivi de missions et rentabilité
- marketing de contenu
- support interne
- événements et prise de parole
- cartographie de réseau professionnel
- OKR
- veille structurée
- outils IA
- monitoring, administration et automatisation email

Le produit est aujourd'hui plus proche d'un "workspace opérationnel unifié" que d'un simple LMS ou d'un simple CRM.

Point important sur l'état actuel :

- l'application est large et déjà utilisable sur de nombreux flux métier
- l'expérience a récemment basculé vers un point d'entrée centré sur un agent IA
- la profondeur fonctionnelle est réelle, mais la cohérence documentaire et architecturale n'est pas encore au niveau de la richesse produit

---

## 3. Positionnement produit

### 3.1 Cible principale

Le produit semble conçu d'abord pour une structure de type :

- organisme de formation
- consultant ou cabinet
- prestataire de services B2B
- activité mêlant relation commerciale, livraison, contenu, suivi administratif et automatisations

### 3.2 Problème adressé

Le produit cherche à éviter la dispersion entre plusieurs outils séparés :

- CRM
- LMS
- agenda et logistique
- devis
- suivi des missions
- emailing
- support
- contenus
- veille
- IA métier

L'ambition produit visible dans le code est de faire de `super-tools` un système d'exploitation métier interne.

---

## 4. Vue d'ensemble du produit

### 4.1 Entrée actuelle dans l'application

L'ancien point d'entrée `/dashboard` redirige désormais vers `/agent`.

Cela signifie qu'en avril 2026, le produit se présente de plus en plus comme :

- une application métier classique
- augmentée par un agent conversationnel capable d'explorer les données, rechercher du contenu et déclencher certaines actions

### 4.2 Grandes familles de fonctionnalités

Le produit peut être lu en 6 blocs :

1. Acquisition et vente
2. Delivery et opérations
3. Contenu, image et réseau
4. IA et automatisations
5. Administration et monitoring
6. Portails publics ou semi-publics

---

## 5. Carte fonctionnelle par domaine

## 5.1 Agent IA et recherche unifiée

### Finalité

Fournir un point d'accès conversationnel aux données et contenus de l'application.

### Présence dans le produit

- route principale : `/agent`
- page : `AgentChat.tsx`
- edge functions : `agent-chat`, `index-documents`, `process-indexation-queue`

### Capacités visibles

- conversation persistée
- historique de conversations
- exécution de requêtes structurées
- recherche sémantique dans du contenu indexé
- préparation d'actions avec confirmation utilisateur

### Ce que cela change dans le produit

L'agent n'est plus un gadget latéral. Il devient une couche transverse qui ambitionne de lire :

- CRM
- formations
- devis
- missions
- emails
- support
- contenus
- LMS

### Maturité estimée

`Moyenne à élevée sur la surface visible`, mais encore sensible sur le plan sécurité et architecture.

### Point d'attention

Ce module est récent et a une portée transverse très forte. Toute évolution dessus peut impacter la sécurité globale du produit.

---

## 5.2 Formations

### Finalité

Gérer des formations de bout en bout, depuis leur création jusqu'au suivi des participants, des questionnaires, des documents, des signatures et de certains flux e-learning.

### Écrans principaux

- `/formations`
- `/formations/new`
- `/formations/:id`
- `/formations/:id/edit`
- `/besoins`
- `/evaluations`
- `/certificates`
- `/historique`

### Capacités visibles

- création et duplication de sessions
- gestion des dates, du format et du lieu
- assignation formateur
- ajout unitaire ou en masse de participants
- questionnaires de besoins
- évaluations multiples
- signatures d'émargement
- génération de certificats
- documents liés à la formation
- conventions et envois d'emails liés aux parcours
- supports de formation structurés

### Composantes proches

- catalogue de formation
- formules de formation
- sessions live
- coaching individuel
- envois programmés
- traçabilité via historique d'activité

### Maturité estimée

`Élevée`

C'est le cœur fonctionnel le plus dense du produit.

### Gaps probables

- expérience coaching encore incomplète
- orchestration e-learning non totalement finalisée
- dette de complexité dans plusieurs composants formations

---

## 5.3 LMS / Portail apprenant

### Finalité

Prolonger la brique formation vers l'accès apprenant et les contenus e-learning.

### Écrans principaux

- `/apprenant`
- `/espace-apprenant`
- `/lms`
- `/lms/:courseId`
- `/lms/:courseId/player`

### Capacités visibles

- accès apprenant
- portail d'apprentissage
- listing de cours
- builder de cours
- player de cours
- quiz
- progression
- badges / complétion
- contenus LMS stockés et rejoués dans l'application

### Maturité estimée

`Moyenne`

Le module est réel et assez avancé, mais moins stabilisé que le bloc Formations historique.

### Point d'attention

Le portail apprenant repose aujourd'hui sur un modèle d'accès à auditer sérieusement côté sécurité.

---

## 5.4 CRM

### Finalité

Piloter les opportunités commerciales, les relances, les échanges et le pipe.

### Écrans principaux

- `/crm`
- `/crm/card/:cardId`
- `/crm/reports`

### Capacités visibles

- kanban commercial
- colonnes personnalisées
- cartes d'opportunité
- tags
- commentaires
- pièces jointes
- emails depuis une opportunité
- score de confiance
- statut opérationnel `TODAY` / `WAITING`
- coaching commercial IA
- rapports CRM
- lien vers missions et devis

### Maturité estimée

`Élevée sur le cœur`, `moyenne sur les raffinements`

### Gaps probables

- prévisions et analyses avancées
- fiabilité de certains flux IA
- simplification de hooks et composants encore monolithiques

---

## 5.5 Devis et micro-devis

### Finalité

Transformer une opportunité commerciale en proposition formalisée et signable.

### Écrans principaux

- `/micro-devis`
- `/devis/:cardId`
- `/signature-devis/:token`

### Capacités visibles

- micro-devis rapide
- workflow de devis plus complet
- génération de lignes et synthèses via IA
- PDF
- email de devis
- signature
- paramétrage légal et administratif
- intégration avec le CRM

### Maturité estimée

`Moyenne à élevée`

### Gaps probables

- UX mobile et signature
- robustesse du stockage des PDF signés

---

## 5.6 Missions

### Finalité

Suivre les missions client, leur rentabilité, leurs activités, leurs contenus et leur logistique.

### Écrans principaux

- `/missions`
- `/missions/:missionId`
- `/mission-info/:missionId`

### Capacités visibles

- kanban ou pilotage de missions
- statut mission
- contacts mission
- activités / consommé
- rentabilité
- pages de mission riches
- documents et médias
- import Google Calendar
- livrables
- résumé mission

### Maturité estimée

`Élevée`

### Gaps probables

- facture mission / rendu PDF
- forecasting plus avancé

---

## 5.7 Contenu et relecture

### Finalité

Organiser la production éditoriale et sa relecture collaborative.

### Écrans principaux

- `/contenu`

### Capacités visibles

- board éditorial
- cartes de contenu
- commentaires de review
- annotations d'images
- assistance IA
- newsletters

### Maturité estimée

`Moyenne`

### Gaps probables

- scheduling plus poussé
- diffusion vers plateformes externes

---

## 5.8 Veille

### Finalité

Centraliser des contenus de veille, les taguer, les regrouper par clusters et produire des digests.

### Écran principal

- `/veille`

### Capacités visibles

- ajout de contenus de veille
- recherche et filtres
- tags
- types de contenus
- clusters automatiques
- digests hebdomadaires
- partage Slack visible dans les digests

### Maturité estimée

`Moyenne`

C'est un vrai module métier désormais, absent de l'ancien PRD.

---

## 5.9 Réseau professionnel

### Finalité

Aider l'utilisateur à clarifier son positionnement et entretenir sa cartographie de contacts.

### Écran principal

- `/reseau`

### Capacités visibles

- onboarding de positionnement
- cartographie conversationnelle
- contacts réseau
- température relationnelle
- dashboard réseau
- signaux de refroidissement

### Maturité estimée

`Moyenne à élevée pour la v0.1`

### Gaps probables

- génération d'actions
- scheduling hebdomadaire
- intégrations d'envoi

---

## 5.10 Arena

### Finalité

Faciliter des discussions structurées ou des débats assistés par IA.

### Écrans principaux

- `/arena`
- `/arena/discussion`
- `/arena/results`

### Capacités visibles

- setup de discussion
- orchestration
- synthèse finale
- suggestion d'experts

### Maturité estimée

`Moyenne`

---

## 5.11 Support

### Finalité

Gérer les bugs, demandes et tickets internes.

### Écrans principaux

- `/support`
- `/reclamations`
- `/reclamation/:token`

### Capacités visibles

- tickets support
- statuts et priorités
- pièces jointes
- analyse IA
- notification support
- réclamations publiques

### Maturité estimée

`Moyenne à élevée`

---

## 5.12 Événements

### Finalité

Suivre conférences, prises de parole, déplacements et opportunités de type CFP.

### Écrans principaux

- `/events`
- `/events/new`
- `/events/:id`
- `/events/:id/edit`

### Capacités visibles

- création et édition d'événements
- logistique
- partage
- lien possible avec le contenu
- suivi CFP

### Maturité estimée

`Moyenne`

---

## 5.13 OKR

### Finalité

Piloter des objectifs, résultats clés et initiatives.

### Écran principal

- `/okr`

### Capacités visibles

- objectifs
- key results
- initiatives
- suivi d'avancement
- assistance IA

### Maturité estimée

`Moyenne`

---

## 5.14 Outils IA dédiés

### Finalité

Exposer des assistants IA spécialisés hors de l'agent principal.

### Écran principal

- `/ia`

### Capacités visibles

- génération de programme de formation
- génération de quiz
- synthèse de coaching
- score de santé activité / business

### Maturité estimée

`Moyenne`

### Relation avec l'agent

L'écran `/ia` reste une boîte à outils spécialisée, tandis que `/agent` devient la couche conversationnelle transverse.

---

## 5.15 Administration, paramètres et exploitation

### Écrans principaux

- `/parametres`
- `/admin`
- `/monitoring`
- `/emails`
- `/emails-erreur`
- `/screenshots`
- `/chatbot-admin`
- `/medias`
- `/historique`
- `/statistiques`
- `/ameliorations`

### Ce bloc couvre

- paramètres généraux
- gestion des formateurs
- réglages CRM
- modèles email et snippets
- accès utilisateurs
- intégrations
- sauvegarde
- abonnement
- clés Arena
- paramètres devis
- voix IA
- paramètres d'indexation agent
- monitoring base, crons, functions et usage
- emails entrants
- emails en erreur
- médiathèque globale
- base de connaissance chatbot
- historique d'activité
- statistiques
- suivi d'améliorations

### Maturité estimée

`Élevée sur la présence fonctionnelle`, `moyenne sur la cohérence d'ensemble`

Ce bloc est très riche, mais encore sous-documenté.

---

## 6. Parcours majeurs

## 6.1 Parcours commercial vers delivery

1. Une opportunité est créée dans le CRM
2. Des échanges email et relances sont suivis
3. Un devis ou micro-devis est généré
4. La mission ou la formation est ensuite pilotée dans son module dédié

## 6.2 Parcours formation

1. Une formation est créée depuis le catalogue ou from scratch
2. Des participants sont ajoutés
3. Les questionnaires sont envoyés
4. La session est opérée
5. Les signatures, évaluations et documents sont gérés
6. L'éventuel accès e-learning est activé

## 6.3 Parcours apprenant

1. L'apprenant reçoit un accès
2. Il rejoint son espace apprenant
3. Il consulte les contenus LMS
4. Il progresse, répond à des quiz et accède à ses ressources

## 6.4 Parcours agent IA

1. L'utilisateur arrive sur `/agent`
2. Il pose une question métier
3. L'agent interroge les données ou recherche du contenu indexé
4. L'agent synthétise ou prépare une action

## 6.5 Parcours veille / contenu

1. Des contenus ou événements sont créés
2. Ils nourrissent éventuellement le board contenu ou la veille
3. La veille produit clusters et digests
4. Le contenu suit un cycle de review et publication

---

## 7. Intégrations externes

Les intégrations visibles dans le code incluent :

- Supabase
- OpenAI
- Anthropic / Claude
- Resend
- Stripe
- WooCommerce
- LearnDash
- Google Calendar
- Google Drive
- Google Maps / Routes
- Slack
- SIREN
- Zapier
- Loom

### Rôle global des intégrations

- IA générative et embeddings
- envoi et réception d'emails
- paiements et portail client
- synchronisation agenda
- génération et stockage de documents
- onboarding e-learning
- automatisations externes

---

## 8. Architecture technique

## 8.1 Frontend

- React 18
- TypeScript
- Vite
- React Router
- TanStack Query avec persistance IndexedDB
- Tailwind CSS
- shadcn/ui
- Tiptap
- dnd-kit
- Vitest
- Playwright présent dans la stack

## 8.2 Backend

- Supabase PostgreSQL
- Auth Supabase
- Storage Supabase
- Edge Functions en Deno
- RPC SQL
- indexation sémantique et recherche vectorielle

## 8.3 Échelle observée dans le code

À date d'audit :

- 65 pages React
- 68 routes déclarées
- 126 Edge Functions
- 303 migrations SQL

Ces chiffres traduisent un produit déjà large, avec une dette de coordination naturelle.

---

## 9. Routes importantes

## 9.1 Routes authentifiées principales

- `/agent`
- `/formations`
- `/crm`
- `/missions`
- `/contenu`
- `/events`
- `/reseau`
- `/okr`
- `/support`
- `/veille`
- `/ia`
- `/lms`
- `/parametres`
- `/monitoring`
- `/admin`

## 9.2 Routes publiques ou semi-publiques

- `/`
- `/auth`
- `/signup`
- `/questionnaire/:token`
- `/evaluation/:token`
- `/evaluation-commanditaire/:token`
- `/evaluation-formateur/:token`
- `/emargement/:token`
- `/signature-devis/:token`
- `/signature-convention/:token`
- `/reclamation/:token`
- `/formulaire/besoins`
- `/formulaire/evaluation`
- `/formation-info/:trainingId`
- `/formation-support/:trainingId`
- `/mission-info/:missionId`
- `/apprenant`
- `/espace-apprenant`

---

## 10. État du produit par maturité

### Modules les plus solides

- Formations
- CRM
- Missions
- Paramètres / exploitation

### Modules en croissance claire

- LMS
- Agent IA
- Veille
- Réseau
- Arena

### Modules utiles mais encore hétérogènes

- Événements
- Support
- OKR
- IA dédiée

---

## 11. Ce qu'un nouvel arrivant doit savoir tout de suite

1. Le produit est plus large que ce que l'ancien PRD laissait penser.
2. `/agent` est désormais la porte d'entrée principale.
3. Le cœur historique reste le triptyque `formations + CRM + missions`.
4. Plusieurs briques transverses existent déjà mais étaient peu documentées :
   - veille
   - agent
   - médiathèque
   - emails entrants
   - monitoring
   - chatbot admin
5. Le produit est fonctionnel, mais il existe une dette de sécurité et d'architecture importante à traiter avant d'accélérer davantage.

---

## 12. Risques et dettes à connaître

### 12.1 Documentation

- Le repo contient encore des documents concurrents ou partiels.
- Le README n'est pas encore au niveau du produit.

### 12.2 Architecture

- logique métier encore trop présente dans certains composants et hooks
- accès Supabase très diffus dans le front
- forte largeur fonctionnelle, donc coût de maintenance élevé

### 12.3 Sécurité

- trop de fonctions exposées publiquement
- modèle CORS trop large
- nouvelles briques agent / indexation à auditer finement
- certaines surfaces publiques ou semi-publiques demandent une revue approfondie

### 12.4 Produit

- l'étendue fonctionnelle est une force, mais aussi une source de dispersion
- certains modules coexistent sans hiérarchie produit totalement lisible pour un nouveau venu

---

## 13. Recommandation documentaire

Ce PRD doit être complété par trois autres documents de référence :

- un `README.md` fiable orienté installation et architecture
- un document `docs/cleanup-plan.md` pour la remise à plat technique
- un document d'architecture de sécurité centré sur les accès publics, apprenants, authentifiés et agent IA

---

## 14. Conclusion

`Super Tools` est un produit plus ambitieux qu'un simple outil métier vertical.

C'est déjà une plateforme opérationnelle unifiée qui combine :

- exécution métier
- automatisation
- contenus
- intelligence artificielle
- pilotage

Le vrai sujet pour la suite n'est pas de "prouver qu'il y a un produit". Il est déjà là.
Le sujet est maintenant de le rendre plus lisible, plus sûr et plus maintenable, afin que sa largeur fonctionnelle devienne un avantage durable plutôt qu'une source de fragilité.

