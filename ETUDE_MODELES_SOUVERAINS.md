# Étude de bascule vers des modèles français et chinois

Date : 2026-08-05. Périmètre : `supabase/functions/` (232 edge functions), `src/lib/`, `mcp-server/`.
Objectif posé : réduire la facture IA et supprimer la dépendance à un fournisseur unique.

## 1. Conclusion en dix lignes

Le blocage n'est pas le modèle, c'est le routage. Sur 62 edge functions qui appellent une API IA payante,
**5 seulement passent par le helper centralisé `aiChat`** (`supabase/functions/_shared/ai.ts:171`). Les 57 autres
codent en dur leur `fetch`, leur URL de provider, leur nom de modèle et leur parsing de réponse. Dans cet état,
« basculer les modèles » signifie modifier 57 fichiers, et recommencer à chaque changement d'avis.

L'ordre correct est donc : centraliser d'abord, basculer ensuite. Une fois `aiChat` généralisé, un changement de
modèle est une ligne dans `app_settings`, avec rollback immédiat, ce que l'architecture prévoit déjà
(`_shared/ai.ts:37-54`).

Côté prix, le gain existe mais il est plus faible qu'attendu, parce que le gros du trafic tourne déjà sur du
low-cost (Gemini Flash via Lovable). Le gain net vient de trois postes précis, pas d'une bascule globale :
la transcription audio, le tier « smart » Claude Sonnet, et les tokens de sortie des fonctions de génération.

## 2. Ce qui est branché aujourd'hui

62 edge functions sur 232 appellent une API IA facturée, réparties sur **cinq fournisseurs distincts** :

| Voie d'appel | Fonctions | Modèle | Où |
|---|---|---|---|
| Gateway Lovable (OpenAI-compatible) | 32 | `google/gemini-2.5-flash`, `google/gemini-3-flash-preview` | `fetch` en dur par fonction |
| Anthropic direct | 14 | `CLAUDE_DEFAULT` / `CLAUDE_ADVANCED` | `_shared/claude-models.ts:16-17` |
| OpenAI direct | 5 | `gpt-4o-mini`, `text-embedding-3-small` | `fetch` en dur |
| Google Gemini direct | 3 | `gemini-2.0-flash` | module Arena |
| AssemblyAI | 11 | Universal | transcription audio |
| Helper `aiChat` | 5 | routé par réglage | `_shared/ai.ts` |

Trois constats structurants.

**Le helper existe mais n'est pas adopté.** `aiChat` sait déjà router vers Lovable, Anthropic ou OpenAI selon le
réglage `ai_provider`, avec retry, backoff et log de consommation (`_shared/ai.ts:76-96`, `_shared/ai.ts:191-204`).
Ses seuls appelants sont `tender-analyze`, `summarize-coaching`, `process-today-reminders`,
`crm-extract-opportunity`, `enrich-idea`.

**Le fallback est dupliqué à la main.** Exemple type dans `generate-daily-agenda/index.ts:65-100` : si la clé
Anthropic est absente, la fonction refait un `fetch` complet vers Lovable, avec son propre `logApiUsage`, son
propre parsing. Ce motif est recopié dans `network-ai-assistant/index.ts:95-109` et
`okr-ai-assistant/index.ts:194-209`. Trois implémentations du même repli, à maintenir en parallèle.

**Deux catalogues de modèles vivent séparément et ont déjà divergé.**
`supabase/functions/_shared/claude-models.ts:17` déclare `CLAUDE_ADVANCED = "claude-sonnet-5"`,
`src/lib/claude-models.ts:10` déclare `CLAUDE_ADVANCED = "claude-sonnet-4-6"`. Le commentaire du second dit
qu'il doit rester aligné sur le premier. Il ne l'est pas.

## 3. Les cinq familles d'appels, par difficulté de bascule

Toutes les fonctions ne se valent pas. Classées par ce qu'elles exigent du modèle :

**Famille A — génération structurée simple (48 fonctions, facile).**
Prompt système plus prompt utilisateur, sortie JSON ou texte. `generate-quiz`, `generate-mission-summary`,
`support-analyze-ticket`, `improve-email-content`, `analyze-evaluations`, etc. Aucune capacité exotique.
Tout candidat sérieux passe. C'est le lot qui porte l'essentiel du volume et donc l'essentiel du gain.

**Famille B — tool calling (4 fonctions, moyen).**
`agent-chat/index.ts` (1411 lignes, l'agent conversationnel), `mcp-server/index.ts`,
`generate-transcript-content`, `generate-quote-lines`. Le tool use fonctionne chez Mistral, DeepSeek, Kimi et
Qwen, mais la fiabilité sur des boucles d'outils longues varie beaucoup d'un modèle à l'autre. À valider par
mesure, pas sur brochure.

**Famille C — vision et documents (2 fonctions, moyen).**
`analyze-admin-document/index.ts` et `extract-balance-sheet/index.ts` envoient des PDF et images en base64 à
Claude Sonnet. Les modèles chinois texte-seul ne couvrent pas ce besoin. Mistral OCR 4 est l'alternative
directe, avec un modèle de facturation différent (à la page, pas au token).

**Famille D — embeddings (7 tables, structurant).**
`_shared/embeddings.ts:4` fixe `text-embedding-3-small`, 1536 dimensions, et ces 1536 sont gravées dans le schéma :
`20260331100000_create_watch_module.sql:30`, `20260331200000_create_agent_rag_infrastructure.sql:21`,
`20260629130000_ideas_embeddings_ai.sql:6`, `20260702120000_editorial_engine.sql:12,40`,
`20260708100000_editorial_themes_backfill.sql:19`. Changer de modèle d'embedding impose de **tout ré-indexer** :
deux vecteurs issus de modèles différents ne sont pas comparables, même à dimension identique. Coût en calcul,
pas en risque, mais à planifier.

**Famille E — audio (11 fonctions, AssemblyAI).**
Poste de coût réel et mesuré à part (`api-usage.ts:56`, 0,27 $ par heure d'audio). Hors périmètre « modèles de
langage » mais dans le périmètre « facture », et c'est là que le ratio de gain est le plus élevé.

## 4. Candidats et prix

Prix relevés le 2026-08-05, en USD par million de tokens. Sources en fin de document. **À revérifier avant
décision** : ces tarifs bougent tous les deux à trois mois et les sources publiques se contredisent sur les
versions Mistral Medium et Qwen Max, écart signalé ci-dessous.

Colonne « panier » = coût d'un appel type de SuperTools, normalisé à 1 M tokens en entrée et 250 k en sortie
(ratio observé sur les fonctions de génération). Référence 1,00x = la situation actuelle sur Gemini Flash.

| | Modèle | In | Out | Panier | vs actuel |
|---|---|---|---|---|---|
| Actuel | gemini-2.5-flash (Lovable) | 0,30 | 2,50 | 0,925 $ | 1,00x |
| Actuel | claude-haiku-4-5 | 1,00 | 5,00 | 2,250 $ | 2,43x |
| Actuel | claude-sonnet | 3,00 | 15,00 | 6,750 $ | 7,30x |
| Actuel | gpt-4o-mini | 0,15 | 0,60 | 0,300 $ | 0,32x |
| FR | Ministral 3 3B | 0,10 | 0,10 | 0,125 $ | 0,14x |
| FR | Mistral Small 4 | 0,15 | 0,60 | 0,300 $ | 0,32x |
| FR | Mistral Large 3 | 0,50 | 1,50 | 0,875 $ | 0,95x |
| FR | Mistral Medium 3.5 | 1,50 | 7,50 | 3,375 $ | 3,65x |
| CN | DeepSeek V4 Flash | 0,14 | 0,28 | 0,210 $ | 0,23x |
| CN | DeepSeek V4 Pro | 0,435 | 0,87 | 0,652 $ | 0,71x |
| CN | MiniMax M2 | 0,255 | 1,02 | 0,510 $ | 0,55x |
| CN | Kimi K2.5 | 0,60 | 2,50 | 1,225 $ | 1,32x |
| CN | Kimi K2.6 | 0,58 | 3,40 | 1,430 $ | 1,55x |
| CN | Kimi K3 | 3,00 | 15,00 | 6,750 $ | 7,30x |
| CN | Qwen3-Max | ~1,20 | ~6,00 | 2,700 $ | 2,92x |

Lectures utiles :

- **Le prix de sortie fait le résultat.** DeepSeek V4 Flash n'est que 2x moins cher en entrée que Gemini Flash,
  mais 9x moins cher en sortie. Sur des fonctions qui génèrent beaucoup (programmes de formation, synthèses de
  mission, emails), c'est là que se joue la facture.
- **Le haut de gamme chinois n'est pas bon marché.** Kimi K3 est au tarif exact de Claude Sonnet. La bascule
  « modèles chinois » ne fait pas économiser en soi ; c'est le choix DeepSeek V4 Flash ou MiniMax M2 qui fait
  économiser.
- **Mistral Large 3 est au niveau de Gemini Flash en prix.** Une souveraineté française sur la famille A est
  donc quasiment neutre financièrement, ce qui est une bonne nouvelle pour l'argument autonomie.
- **Le cache DeepSeek change l'équation sur l'agent.** 0,0028 $ le million en cache-hit contre 0,14 $ en
  cache-miss. Les prompts système longs et stables de `agent-chat` sont le cas d'usage exact. La règle [046]
  d'`IMPROVEMENTS.md` note déjà que le cache actuel est mal posé, à corriger avant de mesurer quoi que ce soit.
- **Audio.** Voxtral Mini transcription est annoncé autour de 0,002 $ la minute, soit environ 0,12 $ l'heure
  contre 0,27 $ chez AssemblyAI. Ratio supérieur à 2, sur un poste déjà identifié comme coûteux. Qualité en
  français à mesurer sur vos propres enregistrements de mission avant tout basculement.
- **Embeddings.** `mistral-embed` sort en 1024 dimensions, ce qui imposerait de modifier les 7 colonnes
  `vector(1536)` du schéma. `text-embedding-v4` de Qwen accepte 1536 en sortie, ce qui évite la migration de
  schéma. Dans les deux cas, la ré-indexation complète reste obligatoire.

## 5. Chiffrer le gain réel

Cette étude ne chiffre pas d'économie en euros, pour une raison à assumer : **la table `api_usage_events` n'est
pas lisible depuis cet environnement** (hors allowlist du MCP). Toute économie annoncée ici serait inventée.

Les données existent en production, la règle [045] d'`IMPROVEMENTS.md` impose que chaque appel payant y écrive
une ligne. Requête à passer dans le SQL editor Supabase pour obtenir la base de décision :

```sql
SELECT provider, model,
       count(*)                    AS appels,
       sum(input_tokens)           AS in_tokens,
       sum(output_tokens)          AS out_tokens,
       sum(cache_read_tokens)      AS cache_read,
       round(sum(cost_usd), 2)     AS usd_30j,
       round(sum(audio_seconds)/3600.0, 1) AS heures_audio
FROM api_usage_events
WHERE created_at > now() - interval '30 days'
GROUP BY 1, 2
ORDER BY usd_30j DESC;
```

Et la même par `origin` pour savoir quelle fonction brûle le budget :

```sql
SELECT origin, operation, trigger_source,
       count(*) AS appels, round(sum(cost_usd), 2) AS usd_30j
FROM api_usage_events
WHERE created_at > now() - interval '30 days'
GROUP BY 1, 2, 3
ORDER BY usd_30j DESC
LIMIT 30;
```

Deux angles morts que ces requêtes ne couvrent pas, à traiter à part :

1. **La gateway Lovable n'est pas facturée en dollars mais en crédits d'abonnement.** Le code applique les
   tarifs publics Google pour obtenir un ordre de grandeur (`api-usage.ts:47-53`), ce qui est honnête mais ne
   correspond à aucune ligne de facture. Sortir de Lovable change la nature du coût, pas seulement son montant :
   il faut comparer l'abonnement Lovable réel aux tokens facturés à l'usage.
2. **32 fonctions dépendent d'un revendeur.** C'est le point de dépendance le plus lourd du système, davantage
   qu'Anthropic. Il concentre à la fois le risque de prix, le risque de disponibilité et le risque de
   changement de modèle sous-jacent sans préavis.

## 6. Risques

**Données personnelles et Qualiopi.** SuperTools traite des données de stagiaires, des évaluations nominatives,
des dossiers clients, des comptes rendus de mission. Envoyer ces contenus vers une API hébergée en Chine
(DeepSeek, Moonshot, Alibaba, MiniMax en direct) est une décision RGPD, pas une décision technique : transfert
hors UE, sans décision d'adéquation. La voie praticable pour garder les modèles chinois sans le problème
juridique est de consommer les **poids ouverts hébergés en Europe** (Scaleway, OVHcloud, Nebius, Infomaniak,
ou instances dédiées), ce qui sert directement l'objectif d'autonomie mais déplace le coût vers du GPU à
l'heure. Mistral en revanche est hébergé en UE avec DPA, sans montage particulier.

Ce point est structurant pour le plan : il n'existe pas de scénario « tout chinois via API publique » qui soit
à la fois le moins cher et conforme. Il faut choisir entre trois combinaisons, et c'est la seule décision que
je ne peux pas prendre à votre place.

**Qualité en français.** Aucun des candidats ne peut être adopté sur la foi d'un benchmark public. Les prompts
métier sont en français, très contextualisés, avec un vocabulaire de la formation professionnelle. Mistral part
avantagé, DeepSeek et Qwen sont corrects en français mais dérivent parfois vers l'anglais sur des sorties
longues, et cela se voit sur des livrables envoyés à des clients.

**Sorties JSON.** Une bonne partie de la famille A parse du JSON sans `response_format` (aucune occurrence dans
le code). La discipline de format est aujourd'hui portée par le prompt seul. Des modèles moins alignés casseront
ce parsing. C'est le principal risque de régression silencieuse de toute la bascule, et il se traite en passant
aux structured outputs à schéma, pas en priant.

**Le nom du fichier ment déjà.** `_shared/claude-models.ts` deviendra un contresens dès le premier modèle non
Claude. À renommer en `models.ts` au moment du lot 1, sinon la dette de nommage se fige.

## 7. Plan de bascule proposé

**Lot 0 — mesurer (avant toute décision).**
Passer les deux requêtes SQL ci-dessus, corriger le cache de `agent-chat` (règle [046]), aligner les deux
catalogues de modèles divergents. Sortie : le vrai top 10 des origines coûteuses. Sans cela, tout le reste est
de l'optimisation à l'aveugle.

**Lot 1 — centraliser le routage (le vrai travail).**
Étendre `_shared/ai.ts` : ajouter les providers `mistral`, `deepseek`, `qwen`, `moonshot`, `minimax` dans
`MODEL_MAP` (`_shared/ai.ts:28-32`), ajouter un tier `reasoning`, et migrer les 57 fonctions qui codent leur
`fetch` en dur vers `aiChat`. Supprimer au passage les trois fallbacks recopiés à la main. Un check dans
`scripts/check-rules.sh` doit interdire tout nouveau `fetch` direct vers une URL de provider hors `_shared/`,
faute de quoi la centralisation se re-dégradera (règle [034] : toute règle doit être appliquée par un mécanisme
bloquant). C'est le lot le plus long et il ne produit aucune économie par lui-même. Il rend toutes les autres
possibles et réversibles.

**Lot 2 — bascule de la famille A, par vagues.**
Une fois `aiChat` généralisé, tester en conditions réelles sur les fonctions les moins exposées d'abord
(`support-analyze-ticket`, `archive-resolved-tickets`, `commercial-challenge`), puis les fonctions visibles par
les clients. Candidat par défaut sur ce lot : Mistral Small 4 ou Large 3 si la souveraineté prime,
DeepSeek V4 Flash ou MiniMax M2 si le prix prime. Critère de sortie par fonction : taux de parsing JSON réussi
et qualité de sortie jugée sur 20 cas réels, pas sur un exemple.

**Lot 3 — audio.**
Comparer Voxtral et AssemblyAI sur 5 enregistrements de mission réels, en français, avec accents et plusieurs
locuteurs. Décider sur le WER constaté, pas sur le prix affiché. Ratio de gain potentiel supérieur à 2 sur un
poste mesuré.

**Lot 4 — embeddings.**
Uniquement si les lots précédents ont tenu. Choisir `text-embedding-v4` de Qwen en 1536 dimensions pour éviter
la migration de schéma, ou `mistral-embed` en acceptant de migrer les 7 colonnes. Prévoir une ré-indexation
complète et un basculement par table, avec les deux colonnes coexistantes le temps de la bascule.

**Ce qu'il ne faut pas migrer maintenant.**
`agent-chat` et `mcp-server` restent sur Claude jusqu'à ce que les lots 1 et 2 aient prouvé la fiabilité du tool
calling des candidats. Ce sont 1400 lignes de boucle d'outils, c'est le cœur du produit, et un tool calling qui
part en boucle coûte plus cher qu'il ne fait économiser. Idem pour la famille C (vision et documents) tant que
Mistral OCR n'a pas été mesuré sur vos bilans et documents administratifs réels.

## 8. Un actif déjà présent : Arena

Le module Arena (`arena-orchestrate`, `arena-orchestrator`, `arena-suggest-experts`, `src/lib/arena/`) sait déjà
faire dialoguer plusieurs modèles de plusieurs providers, avec gestion de clés par provider
(`src/lib/arena/api.ts:80-84`). Étendre ses trois providers actuels aux candidats de cette étude en fait le banc
d'essai de la migration, sans construire d'outillage neuf. C'est le chemin le plus court pour comparer des
sorties françaises réelles sur vos propres prompts.

## 9. Décisions attendues

1. **Priorité entre souveraineté et prix.** Mistral coûte à peu près le prix actuel et règle le sujet RGPD.
   DeepSeek divise le coût de sortie par 9 mais impose soit un transfert hors UE, soit un hébergement européen
   des poids ouverts. Les deux objectifs annoncés (réduire la facture, développer l'autonomie) ne pointent pas
   vers le même choix.
2. **Sortir de Lovable ou non.** 32 fonctions en dépendent, et c'est la dépendance la plus concentrée du
   système, avant même Anthropic.
3. **Accepter que le lot 1 ne rapporte rien à court terme.** C'est le prix de l'autonomie réelle : après lui,
   changer de modèle est un réglage ; avant lui, c'est un chantier à chaque fois.

## Sources

Prix relevés le 2026-08-05, tous indicatifs, à revérifier avant engagement.

- [Mistral API Pricing (August 2026) - BenchLM](https://benchlm.ai/mistral/api-pricing)
- [Mistral API Pricing In 2026 - CloudZero](https://www.cloudzero.com/blog/mistral-api-pricing/)
- [Pricing - Mistral AI](https://mistral.ai/pricing/api/)
- [Mistral Embed - Mistral Docs](https://docs.mistral.ai/models/model-cards/mistral-embed-23-12)
- [Voxtral - Mistral AI](https://mistral.ai/news/voxtral/)
- [Mistral OCR 4 - Mistral AI](https://mistral.ai/news/ocr-4/)
- [Function Calling - Mistral Docs](https://docs.mistral.ai/studio-api/conversations/function-calling)
- [DeepSeek API Pricing (August 2026) - BenchLM](https://benchlm.ai/deepseek/api-pricing)
- [DeepSeek API Pricing 2026 - deepseek.ai](https://deepseek.ai/pricing)
- [Kimi API Pricing (August 2026) - BenchLM](https://benchlm.ai/moonshot/api-pricing)
- [Kimi K2.5 - OpenRouter](https://openrouter.ai/moonshotai/kimi-k2.5)
- [Qwen API Pricing (August 2026) - BenchLM](https://benchlm.ai/alibaba/api-pricing)
- [Embedding - Alibaba Cloud Model Studio](https://www.alibabacloud.com/help/en/model-studio/embedding)
- [MiniMax API Pricing 2026 - pricepertoken](https://pricepertoken.com/pricing-page/provider/minimax)
- [EU GDPR Cloud GPU 2026: Hetzner, Scaleway, OVHcloud](https://www.promptquorum.com/local-llms/eu-cloud-gpu-gdpr-2026)
- [Open-Weight LLM Showdown 2026 - Wavect](https://wavect.io/blog/open-weight-llm-comparison-2026/)
