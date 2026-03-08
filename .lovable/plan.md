# SuperTools — Plan Produit & Technique

---

## Partie 1 — Refactoring terminé (Clean Code)

### Résumé
- **Phase 1** (Type Safety) : wrapper RPC typé, élimination `as any` ✅
- **Phase 2** (God Objects) : CardDetailDrawer, FormationDetail, Questionnaire, AttendanceSignatureBlock, useCommercialCoachData découpés ✅
- **Phase 3** (Couche Service) : `src/services/missions.ts`, `trainings.ts` ✅
- **Phase 4** (Patterns partagés) : `useJourneyTracking`, `useSignaturePad` migrés ✅
- **Phase 5** (Tests) : 550 tests, 0 échec ✅

### Dette restante (non bloquante)
- ~1400 `as any` restants (67 fichiers) — à réduire progressivement
- `useFormationDetail.ts` : 4 fonctions inline à migrer vers `trainingFormatters.ts`
- Pas de tests sur les composants UI critiques (pages publiques)

---

## Partie 2 — Roadmap Produit V2 (Plan fusionné)

### Vision
*"Le Notion des formateurs indépendants"* — plateforme SaaS freemium, multilingue, self-serve pour gérer tout son business de formation depuis un seul outil.

**Cible** : Formateurs indépendants dans le monde entier
**Modèle** : Product-Led Growth (freemium → pro → business)

---

### M1 — Fondations Multi-Tenant + Billing

#### 1.1 Architecture Multi-Tenant
- Table `organizations` avec isolation par `org_id` (RLS Supabase)
- Chaque formateur = un workspace avec ses propres données
- Gestion des rôles par organisation : Owner / Admin / Formateur / Commercial / Viewer
- Dashboard super-admin pour gérer les tenants

#### 1.2 Billing Stripe
- Intégration Stripe : Free (1 formation, 5 participants) → Pro (illimité) → Business (équipe)
- Usage metering : compteurs participants, stockage, emails
- Upgrade nudges contextuels
- Webhook Stripe pour provisioning automatique

#### 1.3 i18n — Phase 1
- Extraction strings FR → `react-i18next`
- Support initial : 🇫🇷 FR + 🇬🇧 EN
- Dates, devises, fuseaux horaires localisés (étendre `dateFormatters` existant)

---

### M2 — Onboarding & PLG Engine

#### 2.1 Self-Serve Signup
- Landing page marketing `/` (pricing, features, témoignages, démo sandbox)
- SEO : "training management tool", "freelance trainer software"
- Inscription → choix de plan → setup initial en 30 secondes

#### 2.2 Onboarding Wizard
- 4 étapes : Profil → Première formation → Participants → Premier questionnaire
- Templates pré-remplis par secteur (dev, management, langues, coaching, bien-être)
- Checklist gamifiée avec confettis à chaque étape (lib déjà installée)

#### 2.3 Viralité Early
- Certificats partageables sur LinkedIn → lien vers le formateur
- "Made with SuperTools" badge sur certificats et portails
- Weekly digest email : résumé + actions à faire

---

### M3 — Portail Apprenant

#### 3.1 Interface Dédiée Participant
- Espace unifié : formations en cours, progression, certificats, documents
- Authentification par magic link (pas de compte nécessaire)
- Mobile-first, PWA installable

#### 3.2 Fonctionnalités Avancées
- Messagerie avec le formateur
- Booking de créneaux coaching (slots déjà implémentés côté admin)
- Questionnaires et évaluations intégrés (plus de pages publiques isolées)
- Accès aux replays et supports

#### 3.3 i18n — Phase 2
- Ajout 🇪🇸 ES, 🇵🇹 PT, 🇩🇪 DE
- Templates emails multilingues
- Contenu dynamique configurable par langue du participant

---

### M4 — IA Augmentée

#### 4.1 Génération de Contenu
- Programme de formation complet à partir d'un titre + objectifs (prérequis, méthodes pédagogiques, planning)
- Création automatique de quiz/évaluations à partir du programme
- Résumé automatique des sessions de coaching

#### 4.2 Chatbot Formateur IA
- RAG sur le contenu du cours (programmes, supports, évaluations)
- Personnalisé par formation
- Feedback IA sur les exercices des apprenants

#### 4.3 Intelligence Prédictive
- Risque de décrochage (non-participation, non-complétion questionnaires)
- Recommandations de parcours personnalisées
- Score de santé business : analyse métriques + recommandations hebdomadaires
- Synthèse post-formation : analyse croisée évaluations → rapport PDF

---

### M5 — White-Label + API Publique

#### 5.1 White-Label
- Domaine personnalisé par organisation
- Logo, couleurs, thème personnalisables (design tokens dynamiques)
- Templates emails brandés
- Certificats avec charte graphique du client

#### 5.2 API REST Publique
- Documentation OpenAPI/Swagger
- Webhooks configurables (nouveau participant, formation terminée, paiement reçu, etc.)
- Connecteur Zapier/Make natif
- Rate limiting + API keys (système déjà en place)

#### 5.3 Intégrations Natives
- Zoom / Google Meet / Teams : lien visio auto-généré
- Google Calendar / Outlook : sync bidirectionnelle (base déjà posée)
- Slack : notifications enrichies (connecteur existant)
- Stripe Checkout : paiement direct par les participants

---

### M6 — Mobile + Viralité

#### 6.1 PWA Avancée
- Mode offline pour formateurs terrain
- Push notifications : rappels lives, coaching, évaluations
- Signature émargement optimisée mobile (SignaturePad déjà en place)

#### 6.2 Page Formateur Publique
- `supertools.app/romain-couturier` — portfolio + catalogue + avis + réservation
- Widget booking embeddable sur n'importe quel site
- SEO : profil indexable

#### 6.3 Gamification & Rétention
- Streaks : "12 semaines consécutives d'actions complétées"
- NPS intégré : feedback automatique à 30, 90, 180 jours
- Badges de complétion pour les apprenants

---

### M7+ — Scale (Post-MVP)

#### 7.1 LMS Natif (remplacer LearnDash/WooCommerce)
- Modules / chapitres / leçons dans SuperTools (TipTap déjà en place)
- Upload vidéo avec player intégré (Mux ou Bunny.net)
- Quiz et exercices interactifs
- Tracking progression SCORM-like
- Élimine dépendance WooCommerce/LearnDash

#### 7.2 Marketplace de Formations
- Formateurs publient leurs formations
- Système notation/avis
- Commission SuperTools (revenu partagé)
- Catalogue public consultable

#### 7.3 Conformité Internationale
- Qualiopi (FR) : automatisation indicateurs + preuves (base existante)
- CPF/OPCO connecteurs (FR)
- CPD (UK), IACET (US) : templates conformité modulaires
- GDPR/Privacy dashboard + droit à l'oubli
- Export données pour audits

---

## Architecture Technique Cible

| Composant | Aujourd'hui | V2 |
|---|---|---|
| Auth | Email/password mono-org | Magic links + multi-org + SSO |
| Data | Mono-tenant, pas d'isolation | RLS par `org_id` sur toutes les tables |
| i18n | Hardcodé FR | `react-i18next` + DB multilingue |
| Billing | Aucun | Stripe subscriptions + metering |
| Public pages | Formulaires par token | Portail apprenant + page formateur |
| API | Pas d'API publique | API REST + webhooks documentés |
| Mobile | Responsive basique | PWA installable + offline + push |
| Branding | Logo SuperTilt fixe | White-label dynamique par org |
| IA | Coach commercial + analyse évals | RAG, génération programmes, prédictif |

---

## Métriques de Succès

| Métrique | M3 | M6 | M12 |
|---|---|---|---|
| Formateurs inscrits | 100 | 500 | 2000 |
| Activation rate | 30% | 40% | 50% |
| Free→Paid conversion | 3% | 5% | 8% |
| NPS | >40 | >50 | >60 |
| Langues live | 2 | 5 | 5+ |
| MRR | - | 5k€ | 30k€ |

---

## Règles de Développement

1. **Un feature flag par grosse feature** — déploiement progressif
2. **Tests avant migration** — chaque changement DB accompagné de tests
3. **Backward compatible** — les tenants existants ne doivent jamais casser
4. **Mobile-first** — tout nouveau composant testé sur mobile d'abord
5. **Pas de `any`** — tout nouveau code strictement typé
6. **i18n by default** — toute nouvelle string passe par `t()`
