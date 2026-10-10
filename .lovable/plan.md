# Outil MCP `check_picto_entries` (backlog SuperTools)

## Objectif
Depuis le connecteur MCP SuperTools : vérifier si des mots existent déjà dans le backlog Picto-Dico, et pouvoir les ajouter sinon. L'ajout existe déjà (`add_picto_requests`, déployé au tour précédent). Il manque seulement la vérification.

## Ce qui existe déjà
- Table `pictodico_words` : backlog des mots (publiés sur le site ou demandés), visible dans l'écran Picto-Dico.
- Tables `pictodico_words`, `pictodico_challenges`, `pictodico_rate_limit` déjà dans l'allowlist de `query_database` et `list_schema`.
- Outil `add_picto_requests` déjà déployé : enregistre des demandes (mot, type, commentaire) sans doublon.

## Travail à faire
1. **`supabase/functions/_shared/pictodico-tools.ts`** : ajouter la fonction `checkPictoEntries(words: string[])` :
   - normalise chaque mot (minuscules, trim, accents) ;
   - cherche dans `pictodico_words` (insensible à la casse/accents) ;
   - retourne pour chaque mot : `exists: true/false`, et si trouvé l'`id`, le libellé exact et le statut (ex. publié / demandé / en attente selon les colonnes réelles de la table).
2. **`supabase/functions/mcp-server/index.ts`** : déclarer l'outil `check_picto_entries` (input : liste de mots, 1 à 50), le dispatcher, l'ajouter aux instructions du serveur, incrémenter la version.
3. Déployer `mcp-server` et vérifier que l'outil apparaît dans la liste des outils.

## Usage combiné
L'assistant pourra alors faire : `check_picto_entries(["chien","chat"])` → pour les mots absents, `add_picto_requests([...])`.

## Limite assumée (validée)
La vérification porte sur le backlog SuperTools uniquement, pas sur les pictos publiés du site WordPress. Un picto publié mais jamais entré dans le backlog sera rapporté comme inexistant.

## Vérifications
- Tests unitaires de la normalisation/recherche.
- `bash scripts/check-rules.sh`.
- Appel MCP réel de `check_picto_entries` sur quelques mots connus après déploiement.
