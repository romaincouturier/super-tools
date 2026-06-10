# Super Tools

Plateforme SaaS métier orientée organisme de formation, conseil et pilotage d'activité.

Le produit regroupe dans une seule application :

- formations et e-learning
- CRM et devis
- missions et rentabilité
- contenu et relecture
- support
- événements
- réseau professionnel
- OKR
- veille
- agent IA et outils IA spécialisés
- administration, monitoring et automatisations email

Pour une vue produit détaillée, lire [PRD.md](./PRD.md).

## Stack

- React 18
- TypeScript
- Vite
- TanStack Query
- Tailwind CSS + shadcn/ui
- Supabase
- Edge Functions Deno
- Vitest

## Démarrage local

Prérequis :

- Node.js 20+ recommandé
- npm

Installation :

```bash
npm install
```

Lancement du front :

```bash
npm run dev
```

Build :

```bash
npm run build
```

Tests :

```bash
npm run test
```

Lint :

```bash
npm run lint
```

Le serveur Vite tourne sur `http://localhost:8080`.

## Variables d'environnement

Le front utilise les variables suivantes :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Le projet contient aujourd'hui des valeurs de fallback dans [vite.config.ts](./vite.config.ts). Ce comportement est pratique pour certains environnements, mais il mérite une revue de sécurité avant généralisation.

Les fichiers `.env*` sont ignorés par git selon [.gitignore](./.gitignore).

## Structure du repo

### Frontend

- [src/pages](./src\pages) : pages de l'application
- [src/components](./src\components) : composants UI par domaine
- [src/hooks](./src\hooks) : hooks d'accès aux données et d'orchestration
- [src/services](./src\services) : services métier partagés
- [src/lib](./src\lib) : utilitaires
- [src/integrations/supabase](./src\integrations\supabase) : client et types Supabase

### Backend

- [supabase/functions](./supabase\functions) : Edge Functions
- [supabase/migrations](./supabase\migrations) : migrations SQL
- [supabase/config.toml](./supabase\config.toml) : configuration des functions

### Documentation

- [PRD.md](./PRD.md) : vue produit et modules
- [docs/cleanup-plan.md](./docs\cleanup-plan.md) : plan de remise à plat
- [IMPROVEMENTS.md](./IMPROVEMENTS.md) : règles acquises et invariants de qualité

## Repères fonctionnels

Quelques routes importantes :

- `/agent` : point d'entrée conversationnel principal
- `/formations` : gestion des formations
- `/crm` : pipeline commercial
- `/missions` : suivi missions
- `/devis/:cardId` : workflow devis
- `/lms` : gestion e-learning
- `/veille` : veille et digests
- `/parametres` : réglages métier et techniques
- `/monitoring` : santé applicative

Le routeur principal est déclaré dans [src/App.tsx](./src\App.tsx).

## Conventions utiles

- Le code TypeScript React est organisé par domaine métier.
- Le produit a déjà une forte largeur fonctionnelle : éviter d'ajouter de nouvelles couches d'abstraction sans nécessité claire.
- Avant de coder, vérifier les invariants dans [IMPROVEMENTS.md](./IMPROVEMENTS.md).
- Le script [scripts/check-rules.sh](./scripts\check-rules.sh) sert de garde-fou qualité.

## Points d'attention actuels

- Le repo a accumulé de la dette d'architecture et de documentation.
- Plusieurs Edge Functions sont encore exposées de manière trop large.
- Le produit est riche, mais pas encore assez homogène sur le plan structurel.

Avant tout chantier large, consulter aussi [docs/cleanup-plan.md](./docs\cleanup-plan.md).

