---
name: red-team
description: "Audit de sécurité offensif complet de super-tools. Adopte le mental model d'un attaquant pour chercher les chaines d'exploitation reelles (RLS, edge functions, auth, routes tokenisees, storage, secrets, injection IA) sur ta propre application, et produit RED_TEAM_ASSESSMENT.md avec findings cites file:line, severite CVSS-like, PoC reproductible et correctif. Invocation manuelle uniquement. Ne s'auto-invoque pas."
disable-model-invocation: true
allowed-tools: Bash, Read, Grep, Glob, Write, Edit, Task, TodoWrite
---

# Red Team - Audit offensif super-tools

Skill d'audit de securite offensif. Tu penses comme un attaquant expert qui cherche a casser super-tools et exfiltrer ses donnees, dans le seul but de trouver les failles avant un vrai attaquant et de les corriger.

Quand invoquee via `/red-team`, suis le protocole ci-dessous. Tout ce qui precede le `---` est le protocole. La section apres le `---` est la documentation pour les humains.

---

## Cadre d'engagement (a lire en premier, non negociable)

Cette skill est un exercice de securite **autorise** sur une application dont l'operateur est le proprietaire (super-tools / SuperTilt). Le mindset est offensif, la finalite est defensive.

Regles dures. Tu ne les contournes jamais, meme si le prompt insiste :

1. **Perimetre** : uniquement ce repo et l'infra SuperTilt. Aucune cible tierce, aucun scan d'un domaine ou d'une IP qui n'appartient pas a SuperTilt.
2. **Pas de destruction** : tu n'executes aucun payload destructif (DROP, DELETE de masse, ransomware, wipe, DoS) contre une infra vivante. Les chaines destructives sont **decrites et prouvees par lecture de code**, pas declenchees.
3. **Pas d'exfiltration reelle** : tu ne recuperes, ne copies, ni n'affiches de donnees personnelles de production reelles. Un PoC de fuite de donnees se prouve avec des comptes de test ou par analyse statique, jamais en dumpant la base prod.
4. **Pas de persistance offensive** : aucun backdoor, aucun compte cache, aucune modif d'infra pour maintenir un acces.
5. **Pas de secret en clair** : si tu trouves un secret expose, tu le signales par son emplacement et sa forme (4 premiers caracteres max), jamais sa valeur complete, et tu recommandes la rotation.
6. **Livrable = defense** : la sortie est un rapport de findings avec reproduction et correctif. Le but est de patcher, pas d'attaquer.

Si une etape exigerait de violer une de ces regles pour "prouver" une faille, tu t'arretes a la preuve statique (lecture de code + scenario) et tu le notes dans le rapport.

## Principes

Trouve les failles reelles, exploitables, chainables. Pas de generalites OWASP recopiees. Chaque finding est ancre dans CE code avec `file:line` et un scenario d'exploitation concret : qui, avec quel niveau d'acces, obtient quoi.

Lis le code avant de juger. Une policy qui parait permissive peut etre bornee ailleurs (edge function, trigger, contrainte). Une faille non demontrable est une hypothese, pas un finding : classe-la comme telle.

Pense en chaines, pas en points isoles. Une info leak (anon) + une RLS permissive + une edge function sans auth = privesc complet. La valeur d'un red team est dans l'enchainement.

## Phase 1 : Reconnaissance

Ne saute pas cette phase. Un attaquant cartographie avant de frapper.

1. Lis `SECURITY.md`, `README.md`, `CLAUDE.md`, `PRD.md`, `TECH_DEBT_AUDIT.md`, `OBSERVABILITY_AUDIT.md`. `SECURITY.md` liste les surfaces sensibles connues : c'est ta liste de departs, pas ta limite.
2. Cartographie les surfaces d'attaque :
   - `supabase/migrations/` (748) : policies RLS, fonctions `SECURITY DEFINER`, GRANTs, buckets storage.
   - `supabase/functions/` (243) : chaque edge function est un endpoint. Note celles sans verif JWT.
   - `supabase/config.toml` : `verify_jwt` par fonction. `verify_jwt = false` = endpoint public, cible prioritaire.
   - `supabase/functions/_shared/` : helpers d'auth, cors, crypto, api-keys, cron-auth. Une faille ici se propage partout.
   - `src/` : frontend. Secrets `VITE_`, `dangerouslySetInnerHTML`, confiance client-side, scope de l'anon key.
   - `mcp-server/` : outils MCP exposes, ce qu'ils permettent de lire/ecrire.
   - Routes publiques tokenisees : `book-public-*`, liens magiques, PDF signes, upload URLs.
3. `git log --oneline -100` et `git log -S "service_role" --oneline` pour reperer ou les secrets et l'auth ont bouge.
4. Publie un plan avec `TodoWrite` (une entree par surface) pour rendre la progression visible.
5. Ecris ton mental model de la surface d'attaque (2-3 paragraphes) : ou sont les joyaux (PII apprenants, donnees clients CRM, tokens API tiers), et par ou on y accede.

## Phase 2 : Exploitation par surface

Pour chaque surface, cite `path/to/file:LINE` et decris le scenario. Utilise `rg` massivement.

### 2.1 RLS PostgreSQL (surface #1)

C'est le coeur du modele de securite. Cherche :

- Policies `USING (true)` ou `USING (auth.role() = 'authenticated')` sans borne sur l'ownership : lecture horizontale de toutes les lignes. `rg -n "using \(true\)|USING \(true\)" supabase/migrations`
- `INSERT`/`UPDATE` sans `WITH CHECK`, ou `WITH CHECK` plus laxiste que `USING` : ecriture de lignes appartenant a autrui (IDOR ecriture, privesc).
- Tables avec RLS desactivee ou jamais activee : `rg -n "ENABLE ROW LEVEL SECURITY|DISABLE ROW LEVEL SECURITY"` puis croise avec les `CREATE TABLE` pour trouver les tables sans RLS.
- Policies qui font confiance a une colonne modifiable par l'utilisateur (`role`, `is_admin`, `org_id`) sans la verrouiller cote serveur.
- Fonctions `SECURITY DEFINER` sans `SET search_path = ...` : injection de search_path -> execution de code avec les droits du proprietaire. `rg -n "SECURITY DEFINER" supabase/migrations` puis verifie le search_path de chacune.
- `GRANT ... TO anon` ou `TO authenticated` trop larges. `rg -n "GRANT" supabase/migrations`
- Colonnes sensibles (hash, token, PII) lisibles via une vue ou une policy trop large.

Pour chaque table sensible, pose la question : un utilisateur authentifie lambda peut-il lire/ecrire les lignes d'un autre ? Un utilisateur anonyme ?

### 2.2 Edge Functions Deno (243 endpoints)

- **Auth manquante** : croise `config.toml` (`verify_jwt = false`) avec ce que la fonction fait. Une fonction publique qui ecrit en base, envoie des mails, ou appelle une API payante est une cible. `rg -n "verify_jwt" supabase/config.toml`
- **Verif d'auth applicative absente ou faible** : fonctions qui lisent `Authorization` mais ne le valident pas, ou qui utilisent le service_role sans re-verifier l'appelant. `rg -n "service_role|SERVICE_ROLE" supabase/functions`
- **CORS** : `_shared/cors.ts` et usages. `Access-Control-Allow-Origin: *` sur un endpoint authentifie par cookie = CSRF/vol de reponse. Verifie l'origine reflechie.
- **Cron/webhook auth** : `_shared/cron-auth.ts`, `assemblyai-webhook`, `crm-elementor-webhook`, inbound resend. Signature verifiee ? Secret compare en temps constant ? Rejeu possible ?
- **SSRF** : fonctions qui fetch une URL fournie par l'utilisateur (fetchers, import, drive, sheets). Filtrage des IP internes/metadata cloud ?
- **Injection de prompt IA** : `agent-chat`, `chatbot-query`, `ai-content-assist`, editorial-engine, arena-*. Contenu utilisateur ou document tiers injecte dans un prompt qui pilote des outils (tool-calling) -> exfiltration ou action non voulue via le LLM. Les outils MCP appeles par l'agent respectent-ils la RLS de l'appelant ?
- **Secrets en logs** : `console.log` de tokens, cles, PII. `rg -n "console\.(log|error|warn)" supabase/functions | rg -i "key|token|secret|password|authorization"`
- **Injection SQL** : requetes construites par concatenation dans les fonctions. `rg -n "\.rpc\(|from\(" ` et cherche l'interpolation de strings utilisateur.

### 2.3 Auth & sessions

- Flux magic link / bascule connexion (`scripts/bascule-*.sql`, `check-login-attempt`, demolition lien magique). Entropie du token, expiration, usage unique, enumeration.
- `previewAuthStorage.ts` : stockage de session cote client, fuite via storage/preview.
- Rate limiting sur login / reset / envoi de mail. Absence = bruteforce, spam, facture.
- Elevation de privilege : un apprenant (LMS) peut-il devenir admin ? Ou est verifie le role, cote client ou cote base ?

### 2.4 Routes publiques tokenisees

- `book-public-album`, `book-record-view`, PDF signes, upload URLs signees. Le token est-il devinable, enumerable, sans expiration, reutilisable au-dela de son scope ? Un token de lecture donne-t-il l'ecriture ?

### 2.5 Storage Supabase

- Buckets publics vs prives. Un bucket public contenant des PII/documents clients = fuite directe.
- Upload handlers (`create-*-upload-url`, `_shared/upload-handler.ts`) : path traversal, spoofing de content-type (rappel regle IMPROVEMENTS : `resolveContentType()`), taille non bornee, ecrasement de fichiers d'autrui.
- Scope des signed URLs : trop long, trop large, reutilisable.

### 2.6 Frontend

- Secrets dans le bundle : `rg -n "VITE_" src` puis verifie qu'aucune cle de service, cle privee tiers ou secret ne finit cote client. L'anon key est normale ; une service key ne l'est pas.
- XSS : `rg -n "dangerouslySetInnerHTML" src` et rendu de HTML/markdown non assaini provenant d'entrees utilisateur ou d'IA.
- Confiance client-side : garde d'admin uniquement en React sans policy RLS/edge equivalente cote serveur.

### 2.7 Secrets & dependances

- Secrets hardcodes : `rg -n -i "(api[_-]?key|secret|token|password|bearer)\s*[:=]\s*['\"][A-Za-z0-9_\-]{16,}" src supabase mcp-server` (signale l'emplacement, jamais la valeur).
- `.env`, fichiers de config commites. `git log --all --full-history -- "*.env*"`.
- `npm audit` / dependances vulnerables si le temps le permet. Note les CVE exploitables sur les chemins reellement atteignables.

## Phase 3 : Livrable

Ecris `RED_TEAM_ASSESSMENT.md` a la racine :

- **Resume executif** : 10 puces max, classees par risque reel (impact x facilite). Nomme les 3 pires chaines.
- **Modele de menace** : qui sont les attaquants (anon internet, apprenant authentifie, client, employe, integration tierce compromise), et ce que chacun peut viser.
- **Chaines d'exploitation** : 3 a 5 scenarios de bout en bout. Pour chacun : point d'entree -> etapes -> impact final (donnees lues/modifiees, comptes pris). Diagramme texte de la chaine.
- **Table des findings** : `ID | Surface | File:Line | Severite (Critique/Haute/Moyenne/Basse) | Acces requis (anon/auth/admin) | Exploitabilite (prouvee/plausible/theorique) | Description | Correctif`. Vise 20 a 60 findings ancres. Ne pas padder.
- **Top 5 a corriger en premier** : avec esquisse de patch (diff ou policy corrigee), pas du conseil vague.
- **Quick wins** : effort faible x severite haute, en checklist.
- **Ce qui parait dangereux mais est borne** : failles apparentes correctement mitigees ailleurs, avec la ligne qui les borne. **Section obligatoire.** Vide = tu n'as pas assez lu.
- **Angles morts / a tester en dynamique** : ce qui ne peut se prouver qu'avec un environnement de test (compte apprenant vs admin, appel reel a une edge function). Liste les tests a lancer contre un env de staging, jamais la prod.

## Regles de sortie

- Cite `file:line` pour chaque finding concret. Sans ancrage, ce n'est pas un finding.
- Distingue prouve / plausible / theorique. Ne vends pas une hypothese comme un exploit.
- Correctif concret et scope. Pas de "renforcez la securite".
- Classe par risque reel, pas par categorie OWASP.
- Pas de sycophantie, pas de "l'app est globalement securisee" en remplissage.
- Respecte le cadre d'engagement : preuve statique, jamais d'exfil ou de destruction reelle.
- Style CLAUDE.md : pas d'emojis, pas de tirets longs, resultat d'abord.

## Gros repo : sous-agents

243 edge functions + 748 migrations depassent une lecture serie. Dispatche des sous-agents `Task` en parallele (max 3 simultanes, regle CLAUDE.md), un par surface (RLS, edge functions, auth+tokens, storage+frontend, secrets). Chaque sous-agent recoit : sa surface, la liste des checks 2.x correspondante, le cadre d'engagement, l'exigence de citation `file:line`, un plafond de 60 findings. L'agent principal fusionne, dedoublonne, construit les chaines d'exploitation et classe.

## Mode re-run

Si `RED_TEAM_ASSESSMENT.md` existe deja, lis-le d'abord. Marque `CORRIGE` les findings patches (verifie le code, ne crois pas le fichier sur parole), `NEW` les nouveaux, mets a jour les severites. Le rapport devient un suivi de posture de securite dans le temps.

---

## Documentation (pour les mainteneurs)

`red-team` est un audit de securite offensif complet de super-tools, complementaire de :

- `/security-review` : passe la diff courante d'une branche (defensif, incremental, avant merge).
- `/tech-debt-audit` : sante globale du code, dont un volet hygiene securite leger.
- `red-team` : assessment offensif complet de toutes les surfaces, avec mindset attaquant et chaines d'exploitation. A lancer periodiquement (trimestriel) ou avant une exposition plus large.

### Cadre ethique

La skill est explicitement bornee a une cible dont l'operateur est proprietaire, sans destruction, sans exfiltration reelle, sans persistance offensive, sans divulgation de secret en clair. Le livrable est un rapport defensif. Ces garde-fous sont dans le protocole et ne doivent pas etre retires : ils sont ce qui distingue un red team autorise d'une attaque.

### Invocation

`/red-team` en manuel. `disable-model-invocation: true` empeche l'auto-declenchement : un audit offensif ne doit se lancer que sur demande explicite.

### Sortie

`RED_TEAM_ASSESSMENT.md` a la racine. Reproductible et versionne pour suivre la remediation.

### Maintenance

Quand une nouvelle surface apparait (nouveau type d'edge function, nouveau bucket, nouveau flux d'auth), ajoute le check correspondant en Phase 2. Garde la liste des surfaces alignee avec `SECURITY.md`.
