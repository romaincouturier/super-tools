---
name: anonymisation-demo
description: "Audite et complète l'anonymisation des écrans internes pour une démonstration commerciale. Passe en revue les écrans ajoutés depuis la dernière campagne, applique les masques du mode démo (src/lib/demoMask.ts), et met à jour le ratchet de contrôle. Utiliser avant une démo, après l'ajout d'une feature qui affiche des données client, ou quand l'utilisateur parle d'anonymisation / mode démo."
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, Task
---

# Anonymisation des écrans pour la démo

SuperTools se démontre à des prospects avec la base de production. Le mode démo
masque à l'écran tout ce qui identifie un client, un participant ou un montant,
sans altérer les données ni la logique métier.

## Architecture existante — ne pas réinventer

| Brique | Rôle |
| --- | --- |
| `src/contexts/DemoModeContext.tsx` | `useDemoMode()` → `{ isDemoMode, toggleDemoMode }`. L'état est persisté dans `profiles.demo_mode` : le toggle suit le compte du présentateur, pas l'onglet. |
| `src/lib/demoMask.ts` | Les masques. Aucune autre fonction de masquage ne doit exister ailleurs. |
| `src/components/settings/StaffProfileSettings.tsx` | L'interrupteur, dans Paramètres. |
| `scripts/check-demo-mask.sh` | Le contrôle. Règle [065], branchée en ratchet dans `scripts/check-rules.sh`. |

## Stratégie de masquage

Le masque conserve la **forme** de la donnée (longueur, initiales, structure) pour
que l'écran reste crédible en démo. Il ne la remplace pas par du faux contenu.

| Donnée affichée | Masque | Rendu |
| --- | --- | --- |
| `email`, `contact_email`, `recipient_email` | `maskEmail` | `r•••••@s••••••••.fr` |
| `first_name`, `last_name`, `full_name`, `contact_name`, `nom`, `prenom` | `maskName` | `R••••n C•••••••r` |
| `phone`, `telephone`, `mobile` | `maskPhone` | `•• •• •• •• ••` |
| `company`, `societe`, titre libre, objet d'email | `maskText` | `A••e F•••••••n` |
| `amount`, `montant`, `price`, `total_ht`, `estimated_value` | `maskAmount` | `•••• €` |
| `address`, `adresse`, `postal_code`, `iban` | `maskAddress` | `••••••` |
| `siret`, `siren` | `maskSiren` | `••• ••• •••` |
| clé d'API, token | `maskApiKey` | `sk-l••••••••••••••••` |
| nom de fichier déposé | `maskFileName` | `••••••••.pdf` |
| bloc de texte libre long (résumé, commentaire, note) | flou CSS `filter: blur(4px)` + `userSelect: none` (voir `src/pages/Dashboard.tsx`) | illisible mais la mise en page tient |

Pattern canonique :

```tsx
const { isDemoMode } = useDemoMode();
...
{isDemoMode ? maskEmail(contact.email) : contact.email}
```

## Règles

1. **Affichage uniquement.** Jamais de masque sur une valeur qui repart ensuite :
   payload de mutation, corps d'email, PDF, export, `href="mailto:"`, `value=` de
   champ de formulaire, clé React. Le masque s'applique au texte rendu, au dernier
   moment.
2. **Les champs de saisie ne se masquent pas** — masquer un `value=` corrompt la
   donnée à l'enregistrement. Un formulaire d'édition ouvert en démo expose son
   contenu : soit on ne l'ouvre pas, soit on floute le conteneur en CSS.
3. **Périmètre = écrans internes.** Les écrans publics (portail apprenant, portail
   partenaire, questionnaires, évaluations, signatures, pages `/formation-info`)
   affichent les données de leur propre visiteur : rien à masquer, ils sont exclus
   du contrôle.
4. **L'équipe SuperTilt reste visible.** Formateurs, collaborateurs, auteurs de
   commentaires, compte connecté : ce sont les gens qui font la démo, pas des
   clients. Leurs noms, emails et téléphones ne se masquent pas.
5. **Les chiffres de SuperTilt se masquent** comme ceux des clients : bilan
   dropshipping, encaissements partenaires, finances. Seuls les prix du catalogue
   restent visibles, ils sont publics.
6. **Faux positif → `// demo-safe: <raison>`** sur la ligne. Cas légitimes : les
   deux points ci-dessus, et un booléen dont le nom contient `email`. Jamais de
   `demo-safe` sur une donnée client.
7. **`useDemoMode()` au niveau racine du composant** (règles des hooks).

## Protocole

### 1. Mesurer l'écart

```bash
bash scripts/check-demo-mask.sh --count    # total de violations
bash scripts/check-demo-mask.sh --files    # regroupées par fichier
bash scripts/check-demo-mask.sh            # fichier:ligne
```

### 2. Prioriser par le parcours de démo

Le contrôle est mécanique, la démo ne l'est pas. Demander à l'utilisateur quels
écrans il va montrer, ou à défaut prioriser dans cet ordre :
Dashboard → CRM (kanban, fiche, devis) → Formations (liste, détail, participants)
→ Missions → Finances → LMS → Paramètres.

### 3. Corriger

Au-delà de ~20 fichiers, répartir en lots disjoints sur 3 sous-agents en parallèle
(maximum du projet), avec la table de correspondance ci-dessus et les 5 règles.
Chaque lot vérifie que ses fichiers ne sortent plus dans `--files`.

### 4. Vérifier

```bash
npm run typecheck
npx vitest run
bash scripts/check-rules.sh
```

### 5. Abaisser le ratchet

`scripts/rules-ratchet.txt` porte `065=<n>`. Le compte ne peut que descendre :
après correction, remettre la valeur réelle dans le même commit.

### 6. Répétition à blanc

Avant la démo, activer le mode démo dans Paramètres et parcourir le chemin prévu.
Le contrôle ne voit pas ce qui n'est pas nommé par un champ identifiant : logos
clients, captures d'écran, pièces jointes, titres de missions, onglets du
navigateur, notifications. Cette relecture visuelle est la dernière maille.

## Ce que le contrôle prouve, et ce qu'il ne prouve pas

`065=0` veut dire : aucune donnée identifiante n'est rendue par un accès direct
à un champ, dans du JSX ou dans un toast. C'est un **plancher, pas une preuve**.
Le grep ne suit pas une variable : `const name = [c.first_name, c.last_name]…`
puis `confirm(\`Supprimer ${name} ?\`)` passe au travers, et c'est exactement ce
qui a laissé neuf fuites en place le 22/09 (toasts d'envoi, corps d'email
programmé, carte kanban commandes, confirmations de suppression).

Le réflexe qui les attrape : quand tu masques un champ à un endroit, **cherche
toutes les autres sorties de la même donnée dans le fichier** — toast, `confirm`,
`title=`, corps d'email prévisualisé, tableau jumeau. Une fuite arrive rarement
seule.

## Angles morts connus du contrôle

- Identité portée par une variable locale, pas par un accès de champ.
- Champs de formulaire (`value=`) — exclus par construction, voir règle 2.
- Données identifiantes portées par un nom de champ générique (`title`, `label`,
  `name`, `content`) — invisibles pour le grep, à traiter à la relecture.
- Contenus rendus en HTML (`dangerouslySetInnerHTML`), PDF générés, images.
- Écrans publics, hors périmètre.

## Prompt type

Ce que la skill attend en entrée — à reprendre tel quel avant une démo :

> Démo SuperTools demain. Le mode démo couvre déjà une partie des écrans, mais
> trois mois de features ont été livrées depuis. Audite l'écart avec
> `scripts/check-demo-mask.sh`, complète le masquage en réutilisant strictement
> les masques de `src/lib/demoMask.ts` et le pattern `isDemoMode ? mask*(v) : v`
> (pas de nouvelle mécanique, pas de fausses données), en priorisant le parcours
> Dashboard → CRM → devis → formations → participants → missions → finances → LMS.
> N'altère aucune donnée envoyée (mutations, emails, PDF, exports, champs de
> saisie). Annote `// demo-safe: <raison>` les faux positifs. Termine par
> `npm run typecheck`, `npx vitest run`,
> `bash scripts/check-rules.sh`, abaisse le ratchet `065` et rends-moi la liste
> des écrans restés non couverts.
