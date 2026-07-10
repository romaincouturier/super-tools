# Observabilité — stratégie de référence

Règle [037] d'IMPROVEMENTS.md. Ce document décrit QUI capture QUOI et par où
chaque erreur doit passer. Principe : des **points de passage uniques**
instrumentés, jamais d'instrumentation dispersée au cas par cas.

## Les trois systèmes et leurs rôles

| Système | Rôle | Ne sert PAS à |
|---|---|---|
| **Sentry** | Erreurs applicatives (exceptions, échecs edge, quotas IA) | Disponibilité, métriques |
| **check-functions-health** + table `edge_function_health` (module Monitoring) | Disponibilité des edge functions (ping périodique) | Détails d'une erreur |
| **Email quotidien de scheduled-backup** | Résultat des jobs de sauvegarde (intégrité, timeouts, GFS) | Erreurs applicatives |

`alert-form-error` (formulaires publics) et `webhook_logs` sont des compléments
métier ; ils n'exonèrent pas du passage par Sentry.

## Frontend — 4 couches, 4 points de passage

1. **Crash de rendu / exception non gérée** : `Sentry.init` (`src/lib/sentry.ts`)
   + `Sentry.ErrorBoundary` (`App.tsx`) + `RouteErrorBoundary`. Ne rien ajouter.
2. **Erreur gérée affichée à l'utilisateur** :
   - Toast shadcn : `toastError(toast, message, { cause: err })` (`src/lib/toastError.ts`)
   - Toast sonner : `import { toast } from "@/lib/toast"` — **jamais** `from "sonner"`
     directement (check [037c]). `toast.error(message, { cause: err })`.
   - Dans les deux cas, passer l'erreur d'origine via `cause` quand le message
     affiché est générique. Un message string seul devient un **breadcrumb**
     Sentry, pas un événement : les toasts de validation ne sont pas des bugs.
3. **Erreurs de données** : `onError` global sur `queryCache`/`mutationCache`
   du `QueryClient` (`App.tsx`). Ne pas dupliquer dans les hooks.
4. **Capture** : tout passe par `reportHandledError` (`src/lib/sentry.ts`),
   qui déduplique — un même objet Error vu par l'onError global PUIS par un
   toast ne produit qu'un seul événement.

`console.error` = debug local uniquement. Jamais le seul traitement d'un
chemin d'erreur visible par l'utilisateur.

Un `catch {}` sans binding avale l'erreur : interdit d'en ajouter
(ratchet [037a]), capturer la variable et la passer en `cause`.

## Edge functions — un point de sortie

- **Réponse d'erreur HTTP** : toujours `createErrorResponse(message, status, { cause, fn })`
  (`_shared/cors.ts`). Les 5xx, 402 et 429 (quotas IA) sont reportés à Sentry
  en arrière-plan (`EdgeRuntime.waitUntil`), no-op si `SENTRY_DSN` absent.
  Dans un catch : passer `cause` (stack trace) et `fn` (nom de la fonction).
  Ne PAS appeler `reportEdgeError` en plus — double événement (check [037d]).
- **`reportEdgeError` direct** (`_shared/sentry.ts`) : réservé aux chemins qui
  ne rendent pas de `Response` d'erreur JSON standard — crons fire-and-forget,
  webhooks à format de réponse imposé (Stripe…), erreurs partielles d'un batch.
- Les réponses d'erreur construites à la main (`new Response(JSON.stringify({ error ... }))`)
  sont de la dette : ratchet [037b], migrer vers `createErrorResponse` au fil de l'eau.

## Configuration requise (dashboard)

- Secret Supabase `SENTRY_DSN` : sans lui, tout le reporting edge est un no-op silencieux.
- Réglage `sentry_dsn` (Paramètres › Général) : init du front. Bouton de test
  (`sendSentryTestEvent`) pour vérifier la chaîne complète, y compris ad-blockers.

## Enforcement machine

- Check [037] : les points de passage existent (toastError, lib/toast, QueryClient, createErrorResponse).
- Check [037c] : pas d'import direct de sonner hors wrapper.
- Check [037d] : pas de reportEdgeError + createErrorResponse dans la même fonction.
- Ratchets [037a]/[037b] : la dette (catch avalés, réponses manuelles) ne peut que descendre
  (`scripts/rules-ratchet.txt`).
