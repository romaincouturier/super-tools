# Design system SuperTilt

Source unique : `src/styles/tokens.css`. En cas de désaccord entre ce document et le code, le code a raison et ce document est un bug.

## Trois surfaces

SuperTilt est un seul produit pour trois audiences. Chacune a son design system : un socle commun (`tokens.css` : palette, statuts, contrat shadcn, structure) et une couche propre à la surface (`surfaces.css`).

| Surface | Audience | Routes |
| --- | --- | --- |
| `landing` | Prospects, clients, partenaires, apprenants non connectés | `/`, `/academy/*`, `/connexion*`, `/auth`, `/signup`, `/onboarding`, pages de mot de passe, signatures de devis, convention et location, `/partenaire/:token`, `/reclamation/:token`, `/mission-info` |
| `learner` | Apprenants et participants | `/espace-apprenant/*`, player et accueil LMS, `/formation-*`, évaluations, questionnaires, émargement, sondages |
| `staff` | L'équipe | Tout ce qui est sous `RequireStaff`, builders LMS (surface par défaut) |

- `SurfaceLayout` (`src/components/SurfaceLayout.tsx`) pose `data-surface` sur `<html>`, pas sur un wrapper : les dialogs et popovers Radix sont rendus dans `<body>`. `<html>` porte `staff` par défaut (`index.html`).
- Une surface ne redéfinit que des alias sémantiques et des valeurs structurantes (`--font-body`, `--radius-card`, `--shadow-card`, et à venir `--surface-page`, `--control-md`). Jamais la palette ni les statuts.
- Décisions du 2026-11-04 :

| | staff | learner | landing |
| --- | --- | --- | --- |
| Police | Inter | Lexend | Lexend |
| Fond de page | crème | crème | crème |
| Rayon (`--radius`) | 0.5rem | 0.75rem | 1rem |
| Relief (`--shadow-card`) | aucun, bordure | ombre douce du bloc | ombre douce large |
| Contrôles `sm / md / lg` | 36 / 40 / 44 px | 40 / 44 / 48 px | 40 / 44 / 48 px |

Les rayons, ombres et hauteurs de `Button`, `Input`, `Select` et `Card` lisent ces tokens (`rounded-card`, `shadow-card`, `h-control-*`). Les fonds de cartes internes (gris clair) restent.
- Un composant de `components/ui/` est commun aux trois surfaces et lit les tokens : il ne connaît pas la surface. Un composant propre à une surface vit dans `components/learner/`, `components/auth/`, ou dans les dossiers métier du back-office.

## Décisions

- Un seul mode, clair. La marque ne définit pas de variante sombre ; `.dark` et `dark:` sont interdits (check [076]).
- Palette fermée. Une couleur absente de `tokens.css` n'existe pas.
- Application React unique : pas de package partagé. Le dossier `src/components/ui/` reste celui du CLI shadcn.
- Tailwind v3 conservé (canaux HSL pour l'opacité : `bg-primary/10`). Le passage à Tailwind v4 est un chantier séparé.
- `--yellow` (#E6BC00) est le jaune d'action ; `--yellow-brand` (#FFD100) est réservé aux aplats décoratifs de la marque, parce que le premier tient le contraste avec l'encre.
- `--red-ink` pour le texte d'erreur, `--red` pour contours et aplats : `--red` seul fait moins de 4,5:1 sur blanc.

## Trois couches

| Couche | Exemples | Qui les lit |
| --- | --- | --- |
| Palette de marque | `--ink`, `--yellow`, `--cream`, `--green`, `--red` | Seulement les alias |
| Alias sémantiques | `--text-strong`, `--surface-subtle`, `--feedback-danger-ink` | Tailwind via `tailwind.config.ts` |
| Contrat shadcn | `--background`, `--primary`, `--ring`, `--sidebar-*` | Les primitives `components/ui/` |

## Utiliser

| Besoin | Classe |
| --- | --- |
| Succès | `text-success`, `bg-success-surface`, `border-success-line` |
| Erreur | `text-danger-ink`, `bg-danger-surface`, `border-danger-line` |
| Alerte | `text-caution-ink`, `bg-caution-surface`, `border-caution-line` |
| Information | `text-info-ink`, `bg-info-surface`, `border-info-line` |
| Texte 10px / 11px | `text-micro`, `text-caption` |
| Texte courant 15px | `text-prose` |
| Marque tierce (Anthropic, OpenAI, Google, LinkedIn) | `bg-partner-*`, `text-partner-*` |
| Rayon bloc LMS | `rounded-block` |
| Hauteur de champ | `h-control-md` (2.5rem), `h-control-sm` (2rem) |
| Durée / courbe | `duration-fast|base|slow`, `ease-brand` |

Migration effectuée le 2026-11-03 (1 171 occurrences, 191 fichiers). Le jaune 400/500 (étoiles, favoris) devient `primary`, le jaune de marque ; le reste du jaune est de l'alerte (`caution`). Un fond plein `green-600 hover:green-700` devient `bg-success hover:bg-success/90`.

Correspondance de migration depuis la palette brute : `green-*` vers `success`, `red-*` vers `danger`, `amber-*` et `orange-*` vers `caution`, `blue-*` vers `info`. Les autres teintes (purple, pink, teal...) ne correspondent à aucun statut : choisir un alias existant ou, si un graphique l'exige, ouvrir une décision ici.

## Règles de maintenance

- Tout token qui crée une classe Tailwind maison s'enregistre dans `extendTailwindMerge` (`src/lib/utils.ts`).
- Les `--st-*` du builder ont été supprimés (2026-11-04) : 802 usages remplacés par leur valeur (`hsl(var(--ink) / 0.55)`...). Le check [076] interdit leur retour.
- Un composant partagé n'existe qu'à sa deuxième utilisation. Il vit dans `src/components/shared/`, sans métier.
- Les e-mails ignorent les variables CSS : leurs hex vivent dans `supabase/functions/_shared/` et copient les valeurs de `tokens.css`.
- Les primitives de `components/ui/` modifiées à la main (variantes de marque) seraient écrasées par une réinstallation shadcn : ne pas relancer `shadcn add` sur un composant existant sans relire son diff.

## Garde-fous

- Check bloquant [076] : aucun `dark:` ni `.dark`.
- Ratchets [076a] palette Tailwind brute, [076b] hex en classe, [076c] tailles de texte arbitraires : la dette ne peut que baisser (`scripts/rules-ratchet.txt`).

## Chantier restant

1. Supprimer les `style={{}}` avec des couleurs littérales (invisibles au ratchet), puis les rayons arbitraires restants.
2. Annoter les variantes de `button.tsx` et `badge.tsx` qui n'ont pas de source de charte ; ajouter `data-slot` aux primitives.
3. Documenter la typographie (Lexend pour l'interface du builder, Fraunces pour les titres éditoriaux) et fixer un fichier de chargement unique des polices.
4. Écrire la charte source (logo, planches) dans ce dossier ; elle n'existe pas encore.
