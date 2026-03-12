# Plan d'implémentation — Module Réseau v0.1

## Scope v0.1
Onboarding conversationnel + cartographie réseau + fiche de positionnement.

---

## Étape 1 — Migration Supabase

**Fichier :** `supabase/migrations/20260312120000_create_reseau_module.sql`

Créer les 4 tables du module :
- `network_contacts` (id, user_id, name, context, warmth enum hot/warm/cold, linkedin_url, last_contact_date, notes, created_at)
- `network_actions` (id, user_id, contact_id FK, action_type, message_draft, scheduled_week, status, result, done_at, created_at) — préparé pour v0.2
- `user_positioning` (id, user_id, pitch_one_liner, key_skills text[], target_client, onboarding_completed_at, updated_at)
- `network_conversation` (id, user_id, role text, content text, phase text 'onboarding'|'cartography', created_at)

Avec :
- RLS policies (user_id = auth.uid())
- Indexes sur user_id, contact warmth, conversation phase

---

## Étape 2 — Types TypeScript

**Fichier :** `src/types/reseau.ts`

Types pour : NetworkContact, NetworkAction, UserPositioning, NetworkMessage, ConversationPhase ('onboarding' | 'cartography'), WarmthLevel ('hot' | 'warm' | 'cold').

---

## Étape 3 — Edge Function IA

**Fichier :** `supabase/functions/network-ai-assistant/index.ts`

Edge function proxy vers Claude API. Reçoit :
- `messages` : historique conversation
- `phase` : 'onboarding' | 'cartography'
- `positioning` : fiche actuelle (si existe)
- `contacts` : contacts existants (pour cartography)

Prompt système adapté selon la phase :
- **Onboarding** : pose les 3 blocs de questions (identité, valeur, cible), reformule, extrait le positionnement. Retourne `{ reply, positioning?: { pitch_one_liner, key_skills, target_client } }` quand terminé.
- **Cartography** : pose les 7 questions séquencées, extrait les contacts mentionnés. Retourne `{ reply, contacts?: [{ name, context, warmth }] }` quand des contacts sont détectés.

---

## Étape 4 — Hook React Query

**Fichier :** `src/hooks/useReseau.ts`

- `usePositioning()` — fetch/upsert user_positioning
- `useNetworkContacts()` — CRUD network_contacts
- `useNetworkConversation(phase)` — fetch/append messages network_conversation
- `useSendNetworkMessage()` — mutation : append message + appel edge function + save response + extract contacts/positioning

---

## Étape 5 — Composants React

### 5a. Page principale
**Fichier :** `src/pages/Reseau.tsx`

ModuleLayout + PageHeader avec icône Users. 3 états :
1. **Pas d'onboarding** → affiche `ReseauOnboarding`
2. **Onboarding fait, < 3 contacts** → affiche `ReseauCartography`
3. **Contacts existants** → affiche `ReseauDashboard` (liste contacts + fiche positionnement)

### 5b. Composants conversation (pattern ChatbotWidget)
**Fichier :** `src/components/reseau/ReseauChat.tsx`

Composant chat réutilisable :
- ScrollArea avec messages (bulles user/assistant)
- Input + bouton envoyer
- Loading state pendant appel IA
- Auto-scroll

### 5c. Onboarding conversationnel
**Fichier :** `src/components/reseau/ReseauOnboarding.tsx`

- Utilise `ReseauChat` en phase 'onboarding'
- Message d'accueil initial de l'assistant
- Quand l'IA retourne un `positioning`, affiche la fiche pour validation
- Bouton "Valider ma fiche" → sauvegarde + passe à cartography

### 5d. Cartographie réseau
**Fichier :** `src/components/reseau/ReseauCartography.tsx`

- Utilise `ReseauChat` en phase 'cartography'
- Quand l'IA détecte des contacts, les affiche en side panel pour validation
- Bouton "Ajouter ce contact" pour chaque contact extrait
- Bouton "Terminer la cartographie" quand l'utilisateur a fini

### 5e. Fiche de positionnement
**Fichier :** `src/components/reseau/PositioningCard.tsx`

Card affichant : pitch_one_liner, key_skills (badges), target_client.
Mode édition inline.

### 5f. Liste de contacts
**Fichier :** `src/components/reseau/ContactsList.tsx`

Table/cards des contacts avec : nom, contexte, badge chaleur (couleur), dernière interaction.
Dialog pour ajouter/modifier un contact manuellement.

### 5g. Dashboard réseau
**Fichier :** `src/components/reseau/ReseauDashboard.tsx`

Layout 2 colonnes : PositioningCard + stats simples en haut, ContactsList en bas.
Bouton pour relancer la conversation cartographie.

---

## Étape 6 — Routing & Navigation

### 6a. App.tsx
- Ajouter lazy import : `const Reseau = lazyWithRetry(() => import("./pages/Reseau"));`
- Ajouter route : `<Route path="/reseau" element={<Reseau />} />`

### 6b. moduleIcons.ts
- Ajouter : `reseau: { icon: Users, label: "Réseau", path: "/reseau" }`

---

## Ordre d'implémentation

1. Migration SQL (tables + RLS)
2. Types TypeScript
3. Edge function IA
4. Hook useReseau
5. Composant ReseauChat (chat générique)
6. ReseauOnboarding + PositioningCard
7. ReseauCartography + ContactsList
8. ReseauDashboard (assemblage)
9. Page Reseau.tsx + routing App.tsx + moduleIcons.ts

---

## Hors scope v0.1
- Actions hebdomadaires (v0.2)
- Génération de messages (v0.2)
- Suivi/relances (v0.3)
- Dashboard métriques (v0.4)
- Import LinkedIn (reporté)
