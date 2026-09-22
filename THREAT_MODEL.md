# Threat Model super-tools

Modele de menace et strategie de defense de super-tools (SuperTilt, organisme Qualiopi).
Document defensif. Complement de `SECURITY.md` (surfaces connues) et `RED_TEAM_ASSESSMENT.md` (findings ancres).

Surface reelle a proteger : frontend React, Supabase Auth, PostgreSQL avec RLS, 243 Edge Functions Deno (dont 227 en `verify_jwt = false`), storage Supabase, routes publiques tokenisees, portail apprenant (header `x-learner-email`), agent IA + RAG transverse, MCP server, integrations tierces (Pennylane, Google, Resend, AssemblyAI, WordPress, Slack, Brevo).

Joyaux (ce que l'attaquant veut) :
- PII apprenants et stagiaires (obligations Qualiopi/RGPD), emargements, evaluations, conventions signees.
- Donnees clients CRM, opportunites, devis, factures Pennylane.
- Secrets : `SUPABASE_SERVICE_ROLE_KEY` (contourne toute RLS = game over), tokens OAuth Google, cles API IA (cout), secrets webhooks.
- Contenu editorial, corpus RAG (`document_embeddings`), comptes admin.

---

## 1. Profils d'attaquants

Cinq profils, du plus bruyant au plus cible. Chacun est hostile, sans limite morale, bien outille.

### P1 - Opportuniste de masse (automatise)
- **Qui** : botnets, scanners, script kiddies outilles. Non cible : frappe tout ce qui repond.
- **Acces de depart** : anonyme, internet.
- **Outils** : nuclei, sqlmap, ffuf/gobuster, trufflehog/gitleaks (scan de secrets sur GitHub public), credential stuffing (bases de mots de passe fuitees), scanners de buckets, dependabot-style CVE matching. Capacite de calcul : bruteforce distribue, enumeration massive.
- **Cibles dans super-tools** : les 227 edge functions publiques, buckets storage mal configures, secrets commites, endpoints d'auth (bruteforce/stuffing), formulaires tokenises (enumeration de tokens faibles).
- **Impact recherche** : ransomware, revente de donnees, minage, et surtout **deni de portefeuille** : appeler en boucle une fonction publique qui declenche une API IA payante fait exploser la facture.
- **Ce qui l'arrete aujourd'hui** : RLS (si correcte), `cron-auth` fail-closed sur les fonctions recentes. **Ce qui manque** : rate limiting global, CORS restreint, garde d'auth sur les fonctions publiques qui coutent de l'argent.

### P2 - Attaquant cible et patient (APT-like)
- **Qui** : acteur finance qui veut TES donnees precises (concurrent, revente ciblee de fichiers Qualiopi, chantage).
- **Acces de depart** : anonyme puis pivot ; construit des chaines d'exploitation.
- **Outils** : reconnaissance manuelle, Burp Suite, exploitation d'IDOR via RLS trop permissive, **injection de prompt** sur `agent-chat`/RAG, usurpation du header `x-learner-email`, SSRF vers les metadata cloud, cracking de hash/tokens avec GPU. Patience : semaines.
- **Cibles** : donnees clients CRM, PII apprenants, corpus RAG transverse, tout secret permettant le pivot vers le service_role.
- **Techniques cle** : (1) info leak anon + RLS permissive + fonction publique sans garde = privesc complet ; (2) prompt injection qui detourne les outils de l'agent pour lire hors perimetre ; (3) token de route publique devinable -> acces direct.
- **Ce qui l'arrete** : defense en profondeur reelle (pas une seule couche). **Ce qui manque** : revue systematique des chaines, isolation RLS de l'agent IA.

### P3 - Insider / compte compromis
- **Qui** : apprenant ou client authentifie malveillant, ou compte admin/employe phishe.
- **Acces de depart** : session authentifiee legitime (bas privilege).
- **Outils** : le navigateur, l'API Supabase directe avec son propre JWT (contourne le frontend), manipulation des colonnes envoyees (role, is_admin, org_id).
- **Cibles** : elevation de privilege (apprenant -> admin), lecture horizontale (ses lignes -> celles des autres), RPC `SECURITY DEFINER` transverses, abus des fonctions qui font confiance a une garde client-side.
- **Ce qui l'arrete** : RLS bornee sur l'ownership + `WITH CHECK` cote ecriture + gardes serveur (jamais client-only). **Ce qui manque** : audit des policies FOR INSERT/UPDATE et des DEFINER sans `search_path`.

### P4 - Chaine d'approvisionnement / integration tierce compromise
- **Qui** : attaquant qui compromet une dependance (npm/Deno) ou detourne un webhook/cle d'integration.
- **Acces de depart** : la confiance implicite accordee a une integration.
- **Outils** : typosquatting de paquets, webhook forge (si signature non verifiee : assemblyai, elementor, resend inbound), cle OAuth/API tierce volee, donnees empoisonnees injectees dans le RAG.
- **Cibles** : execution de code via dependance, injection de donnees de confiance, exfiltration via un canal legitime (email sortant, Drive, Slack).
- **Ce qui l'arrete** : verification de signature des webhooks en temps constant + anti-rejeu, lockfiles epingles, moindre privilege des cles tierces. **Ce qui manque** : audit signature webhooks, revue des scopes OAuth.

### P5 - Attaquant de la couche infra / hebergement
- **Qui** : celui qui vise sous l'application : secrets, config, DNS, storage, service_role.
- **Acces de depart** : un secret expose (repo, log, bundle, .env commite) ou une mauvaise config de projet Supabase.
- **Outils** : scan de secrets, analyse du bundle JS livre au client, lecture des logs d'edge functions, test des buckets publics, prise de sous-domaine (dangling DNS).
- **Cibles** : `SUPABASE_SERVICE_ROLE_KEY` (**game over** : lecture/ecriture totale, RLS ignoree), tokens OAuth, secrets webhooks, buckets storage publics contenant des documents.
- **Ce qui l'arrete** : aucun secret sensible cote client ni en log, buckets prives par defaut, rotation. **Ce qui manque** : verification qu'aucune service key ne fuit dans le bundle/logs, revue des buckets publics.

**Matrice profil x couche** (X = surface principale du profil) :

| Couche              | P1 masse | P2 cible | P3 insider | P4 supply | P5 infra |
|---------------------|:--------:|:--------:|:----------:|:---------:|:--------:|
| Hebergement/secrets |    X     |    X     |            |     X     |    X     |
| Auth/session        |    X     |    X     |     X      |           |          |
| RLS/donnees         |          |    X     |     X      |           |    X     |
| Edge functions/API  |    X     |    X     |     X      |     X     |          |
| Storage             |    X     |    X     |            |           |    X     |
| Agent IA/RAG        |          |    X     |     X      |     X     |          |
| Frontend            |    X     |    X     |            |           |    X     |

---

## 2. Strategie d'audit et de defense

Principe directeur : **defense en profondeur**. Aucune couche n'est le seul rempart. La RLS reste le dernier filet meme si une edge function est mal gardee ; une edge function garde meme si le frontend est contourne.

### 2.1 Invariants de securite (verifiables)
1. **La RLS est le sol, pas le plafond.** Toute table contenant de la PII ou des donnees clients a la RLS activee, une policy SELECT bornee a l'ownership, et une policy INSERT/UPDATE avec `WITH CHECK` au moins aussi stricte que le `USING`.
2. **Aucune fonction publique ne coute d'argent ou n'ecrit sans garde.** `verify_jwt = false` exige une garde applicative : `isInternalCall()`, JWT verifie, signature webhook, ou token a usage unique valide en base.
3. **Le service_role ne quitte jamais le serveur.** Jamais dans le bundle, jamais en log, jamais renvoye dans une reponse.
4. **Tout header d'identite non authentifie est hostile.** `x-learner-email` ne donne acces qu'a ce que la RLS autorise apres verification d'une session reelle, jamais sur la seule foi du header.
5. **L'agent IA opere avec les droits de l'appelant.** Le RAG ne renvoie que ce que l'appelant a le droit de lire ; le contenu injecte ne pilote pas d'outil a privilege.
6. **Les webhooks verifient une signature** en temps constant, avec anti-rejeu (timestamp/nonce).

### 2.2 Controles par couche (mappes aux profils)

| Couche | Controle | Contre |
|--------|----------|--------|
| Hebergement/secrets | Scan de secrets en CI, rotation, service_role serveur-only, buckets prives par defaut | P1, P5 |
| Auth/session | Rate limiting login/reset/envoi mail, anti-stuffing, tokens forts (>=128 bits, expiration, usage unique) | P1, P2, P3 |
| RLS/donnees | RLS activee partout, ownership borne, `WITH CHECK`, DEFINER avec `search_path` fixe | P2, P3, P5 |
| Edge/API | Garde d'auth sur toute fonction publique sensible, CORS restreint a APP_ORIGIN, pas de secret en log | P1, P2, P4 |
| Storage | Buckets prives, signed URLs a scope et TTL courts, content-type resolu serveur, taille bornee | P1, P2, P5 |
| Agent IA/RAG | RLS de l'appelant appliquee au RAG, isolation prompt/instructions, outils MCP a moindre privilege | P2, P3, P4 |
| Frontend | Aucun secret sensible cote client, pas de garde admin client-only, assainissement HTML/markdown | P2, P5 |
| Supply chain | Lockfiles epingles, signatures webhook, scopes OAuth minimaux, audit dependances | P4 |

### 2.3 Cadence d'audit
- **A chaque PR** : `bash scripts/check-rules.sh` (81 checks, deja en place) + `/security-review` sur la diff.
- **Trimestriel ou avant exposition** : `/red-team` (assessment offensif complet, produit `RED_TEAM_ASSESSMENT.md`).
- **Continu** : Sentry (deja branche via `_shared/sentry.ts`) pour les 5xx et anomalies ; ajouter des alertes sur pics d'appels aux fonctions payantes (signal P1 deni de portefeuille).
- **Ratchet** : chaque faille de classe corrigee devient un check dans `scripts/check-rules.sh` (convention CLAUDE.md) pour empecher la regression.

### 2.4 Priorisation (impact x facilite)
1. **Bloquer le deni de portefeuille et l'ecriture anonyme** : garde d'auth sur les fonctions publiques sensibles. (P1)
2. **Fermer les IDOR RLS** : policies SELECT/`WITH CHECK` sur donnees sensibles. (P2, P3)
3. **Durcir CORS** : APP_ORIGIN au lieu de `*`. (P1, P2)
4. **Verifier qu'aucun secret ne fuit** (bundle, logs). (P5)
5. **Isoler l'agent IA** et verifier les signatures webhooks. (P2, P4)

Les findings ancres (`file:line`), leur severite et leur correctif sont dans `RED_TEAM_ASSESSMENT.md`. L'implementation du durcissement suit cette priorisation.
