# Agent autonome SuperTools

Cible : *un système capable d'atteindre un objectif avec une supervision
limitée, en s'appuyant sur des agents IA et des outils.*

Constat de départ : **la flotte d'outils existait déjà.** 224 edge functions,
dont 36 d'analyse ou de génération IA (`editorial-engine`,
`crm-extract-opportunity`, `generate-mission-summary`,
`analyze-transcript-editorial`, `okr-ai-assistant`...) et 21 processeurs cron.
Ce sont autant d'agents à tâche unique, chacun dans son coin, et l'agent
SuperTools ignorait leur existence. Ce qui manquait n'était pas de l'IA, mais
un chef d'orchestre : un but, un déclencheur, une trace, un moyen de défaire.

## Les quatre briques

| Table | Rôle |
|---|---|
| `agent_objectives` | Un but qui survit à la conversation, avec son critère de fin et l'historique de ce qui a été tenté |
| `agent_action_log` | Ce que l'agent a fait seul, avec l'état avant et après |
| `agent_autonomy_policy` | Ce qu'il a le droit de faire seul, par action |
| `agent_memory` | Ce qu'il retient d'une conversation à l'autre |

Une vue `agent_daily_digest` agrège le journal par jour, métier et action.

## Politique d'autonomie

Trois niveaux, réglables sans déploiement dans **Paramètres > Agent** :

- **auto** : l'agent agit et le mentionne.
- **notify** : l'agent agit, puis signale explicitement ce qu'il a changé.
- **confirm** : l'agent décrit, demande, et ne rappelle l'action qu'avec
  `params.confirmed = true`.

Le serveur applique la règle, y compris dans le chat. **Une action absente de
la table est traitée comme `confirm`** : l'absence de décision n'autorise rien.

Réglage de départ, à ajuster : autonomie totale sur ce qui reste interne à
SuperTools, confirmation dès qu'un tiers reçoit quelque chose ou qu'un montant
change. C'est un choix d'exploitation, pas une propriété du code.

## Les quatre métiers

| Métier | Objectif | Autonomie |
|---|---|---|
| Facilitateur | Chaque atelier produit sa synthèse | Totale, rien ne sort de SuperTools |
| Contenus | Le pipeline éditorial ne se vide jamais et s'alimente des transcripts | Élevée, rien n'est publié |
| Commerce | Aucune opportunité ne dort | Rédige, n'envoie jamais |
| Transformation | Livrable à jour, budget maîtrisé | Alerte oui, montants non |

Sur le commerce, la limite est délibérée : un email parti au nom de
l'utilisateur est irréversible et engage sa signature. L'agent signale, il ne
relance pas à sa place.

## Déclenchement

**Événementiel** (dans la migration) : l'ajout d'un média de mission rend
immédiatement dû l'objectif « facilitateur », l'ajout d'un transcript celui de
« contenus ». Le trigger remet `last_run_at` à NULL, sans appel HTTP depuis SQL.

**Périodique** : à poser une fois dans le SQL Editor, hors migration
versionnée (la règle [036] proscrit `vault.decrypted_secrets` dans les
migrations) :

```sql
SELECT cron.schedule(
  'agent-objectives-tick',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := '<SUPABASE_URL>/functions/v1/agent-objectives',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Manuel** : boutons « Constater » et « Exécuter » dans Paramètres > Agent.
« Constater » (`dry_run`) montre ce que l'agent ferait sans rien écrire. C'est
la bonne façon d'évaluer un objectif avant de l'activer.

## Réversibilité

Toute action ayant modifié une ligne existante est annulable en un clic :
`before_state` est conservé, `revert_action_id` le rétablit. Les créations de
contenu ne sont pas annulables par l'agent : les supprimer relèverait d'un
droit de suppression qu'il n'a pas et n'aura pas.

## Mémoire

`agent_memory` porte des faits et préférences réutilisables, bornés à 40
entrées injectées, chacune datée et remplaçable par sa clé. Les entrées de type
`contexte` expirent au bout de 90 jours et cessent d'être injectées.

L'agent écrit dedans avec `execute_action`, action `remember`. Le prompt lui
interdit d'y mettre quoi que ce soit de sensible et lui rappelle qu'une mémoire
peut être périmée : elle informe, elle ne fait pas foi.

## Objectifs créés depuis le chat

Quand une demande s'inscrit dans la durée (« assure-toi que… », « surveille… »),
l'agent ne se contente plus de répondre : il crée un objectif avec
`execute_action`, action `create_objective`. C'est le pont entre la
conversation et le système qui dure.

## Ce qui n'est volontairement pas fait

**Catalogue d'outils métier généralisé.** L'idée était d'exposer à l'agent les
224 edge functions via un registre. La politique d'autonomie joue déjà ce rôle
pour les actions, et construire le registre avant d'en avoir besoin serait de
l'abstraction prématurée. À reprendre quand le code en dur de `execute_action`
commencera réellement à peser.

**Sous-agents dans `agent-chat`.** La décomposition est aujourd'hui
structurelle (un objectif, une routine par métier) plutôt que décidée par le
modèle, ce qui est plus prévisible et se déboggue. Des sous-agents ne se
conçoivent qu'en connaissant les tâches qui échouent : cela suppose les évals
(AG-10), pas une intuition.

**Envoi d'emails autonome.** Jamais, quel que soit le réglage : la politique
classe `send_email` en `confirm` et la valeur par défaut ne changera pas sans
décision explicite.
