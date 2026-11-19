# Preuves d'audit blanc enregistrables par un agent (MCP)

## Constat actuel
- Les questions manuelles sont définies en dur dans `supabase/functions/_shared/qualiopi-checks.ts` (`PLANS[n].questions`, id stable `"<indicateur>.<clé>"`, `label`, `hint`).
- Indicateur 1 : `1.publie` (« Ces informations sont-elles accessibles au public, hors de l'application ? ») et `1.trompeuse` (« La communication est-elle exempte de mention pouvant induire le public en erreur ? »).
- Les réponses sont stockées dans `audit_runs.answers` (jsonb `{ "1.publie": "oui" }`), sans preuve, sans date par question, sans source. L'écran `/audit-blanc` (`AuditBlanc.tsx` + `useAuditRuns.ts`) insère un nouveau passage avec toutes les réponses.
- `run-qualiopi-audit` reprend les réponses du dernier passage manuel **seulement si l'échantillon de formations est identique** ; sinon toutes les réponses sont perdues. Aucune notion d'ancienneté.
- Droits : une seule règle sur `audit_runs` : admin ou accès au module `audit` ou `formations`.

## Stockage proposé (migration additive)
Nouvelle table `audit_question_evidence` (historique, jamais écrasé) :
- `id`, `question_id` (text, ex. `1.publie`), `indicator` (int)
- `answer` (`oui` | `non`)
- `evidence_summary` (text, requis), `evidence_urls` (text[]), `evidence_details` (jsonb : texte libre ou citations par page/élément, mentions vérifiées/trompeuses)
- `checked_at` (date du contrôle, fournie), `recorded_at` (now)
- `source_type` (`human` | `agent`), `source_label` (ex. `agent:controle-site-mensuel`)
- `recorded_by` (utilisateur connecté, toujours issu de la session, jamais de l'entrée)
- `audit_run_id` (nullable, passage de rattachement)
- Index `(question_id, recorded_at desc)`.

Droits : mêmes conditions que `audit_runs` (admin / module audit / formations) pour lecture et ajout ; **aucune règle UPDATE ni DELETE** (journal immuable). Déclencheur de validation : `question_id` doit exister dans le référentiel (liste figée en SQL ou vérifiée côté outil), `checked_at` pas dans le futur.

La « réponse actuelle » d'une question = dernière ligne par `recorded_at`. `audit_runs.answers` reste alimenté pour compatibilité (historique des passages).

## Outils MCP (connexion staff existante, droits de l'appelant)
1. `list_audit_questions({ indicator?: number })` lecture seule
   - Retour par question : `question_id`, `indicator`, `label`, `hint`, `current` : `{ answer, evidence_summary, evidence_urls, checked_at, recorded_at, source_type, source_label, age_days, status: "valide" | "a_confirmer" | "perimee" } | null`.
2. `record_audit_evidence({ question_id, answer: "oui"|"non", evidence_summary, evidence_urls: string[] (URL valides, max 50), evidence_details: string | object, checked_at: ISO, source: "agent:<nom>" })`
   - Ajoute une ligne (`source_type = agent`), retourne la ligne créée et la précédente. Rejet si question inconnue, source mal formée, URL invalide. Pas de suppression ni de modification d'une preuve existante.

## Règle de validité (verdict et tâches)
Helper pur partagé `_shared/audit-evidence.ts` : une réponse compte si elle a moins de **45 jours** (`checked_at`). Au-delà : question « à confirmer » et la tâche « Confirme avec une preuve » revient. Une réponse « non » valide compte comme problème (comportement actuel).
- `run-qualiopi-audit` : fusionne les réponses manuelles existantes avec les preuves valides (la preuve la plus récente l'emporte), sans dépendre de l'échantillon pour ces questions.
- L'écran utilise le même helper, donc écran, email et tâches concordent.

## Écran /audit-blanc
- Sous chaque question : dernière preuve (réponse, résumé, date du contrôle, source « Agent : … » ou nom de la personne, badge « Périmée » si > 45 j), liens cliquables.
- Bouton « Voir le détail » : panneau avec citations / détails et historique des preuves précédentes.
- Un humain peut toujours répondre oui/non ; son clic crée une nouvelle preuve `human` (résumé optionnel saisi) qui prend la main sur celle de l'agent, l'historique restant visible.
- Flux : page -> hook `useAuditEvidence` -> service `auditEvidenceService` -> base.

## Tests
- Helper : validité < 45 j, périmée à 45 j+, dernière preuve gagnante, « non » compté comme problème, question inconnue ignorée.
- `qualiopi-summary` : tâche « Confirme avec une preuve » absente avec preuve oui récente, présente si périmée ou absente.
- Outil `record_audit_evidence` : validation des entrées (question inconnue, URL invalide, source sans `agent:`), aucune opération de suppression exposée.
- Test pgTAP : un utilisateur sans droit audit/formations ne lit ni n'ajoute ; personne ne peut modifier ni supprimer.

## Hors périmètre
Aucun email, aucune modification de cron ni de la tâche Claude mensuelle ; pas de reprise des anciennes réponses en preuves. Publication nécessaire ensuite (MCP compris).

## Point à confirmer
Durée de validité : 45 jours pour toutes les questions, ou seulement pour celles contrôlées mensuellement (indicateur 1) ?
