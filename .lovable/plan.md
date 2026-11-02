# Retours qualitatifs post-formation dans SuperTools

## Constat (base actuelle)
- `training_evaluations` (à chaud participant) et `sponsor_cold_evaluations` (à froid commanditaire, tokenisée, avec `consent_publication`) existent déjà, rattachées à `training_id` / `participant_id`.
- `stakeholder_appreciations` couvre les appréciations annuelles des parties prenantes.
- `improvements` porte déjà `source_type` / `source_id` / `training_id` (plan d'amélioration Ind. 32).
- `inbound_emails` reçoit déjà des emails avec `linked_training_id` / `linked_participant_id`.
- `testimonials` est orientée vidéos Drive, sans lien formation/participant.
- Il manque : un questionnaire à froid **participant** dans SuperTools, et un endroit pour les retours libres (email, oral).

## 1. Stockage
Une seule nouvelle table, `training_feedbacks`, pour tout retour libre ou importé :
- rattachement : `training_id`, `participant_id` (nullable), formation catalogue déduite via la session ;
- `source` : `cold_form_import`, `email`, `manual`, `mcp`, `phone` ; `source_ref` (id `inbound_emails`, ligne du formulaire) ; `author_role` participant/commanditaire ; `received_at` ;
- `content` (texte brut, citation exacte), `ai_summary`, `sentiment`, `themes[]` (ex. « temps / transfert au quotidien », « pédagogie ») ;
- témoignage : `quote_candidate`, `consent_status` (inconnu / demandé / accordé / refusé), `consent_at` ;
- suivi : `status` (nouveau / traité), lien vers `improvements` via `improvements.source_type='training_feedback'`.

Le questionnaire à froid participant devient natif : on réutilise le modèle tokenisé de `sponsor_cold_evaluations` (même écran, même envoi programmé), plutôt qu'une nouvelle table. Google Form abandonné à terme (cohérent avec la règle « jamais de Google Forms dans les évaluations »).

## 2. Entrée des retours
- **Historique Google Form** : import CSV ponctuel depuis l'onglet Évaluations ; rapprochement par email puis par formation/date ; lignes non rapprochées affichées pour affectation manuelle.
- **À l'avenir** : questionnaire à froid participant natif envoyé automatiquement (délai réglable, ex. J+90).
- **Email** : bouton « Enregistrer comme retour » sur un `inbound_emails` déjà lié, et ajout manuel depuis la fiche participant (coller le texte).
- **MCP** : outil `add_training_feedback` (email du participant + texte + source), rattachement automatique par email, propositions si plusieurs sessions.
- À l'enregistrement, l'IA remplit résumé, sentiment, thèmes et repère les citations publiables ; rien n'est publié ni envoyé automatiquement.

## 3. Exploitation
- **Fiche formation, onglet « Retours »** : liste unifiée (à chaud, à froid participant et commanditaire, retours libres) avec synthèse IA par thème, et bouton « Créer une action d'amélioration » qui alimente `improvements` (Ind. 30-32, source tracée).
- **Synthèse par formation catalogue** : agrégation multi-sessions sur 12 mois, exportable comme preuve Qualiopi.
- **Témoignages** : vue « Citations candidates » ; demande de consentement = signal manuel (comme `testimonial_requests`, pas d'email auto) ; une fois accordé, la citation est réutilisable (évaluations avec `consent_publication` incluses).
- **Suites à donner** : l'IA propose des actions (ex. « relancer l'accès e-learning », « proposer une séance de suivi ») créées comme actions du jour / tâches, validées à la main ; l'exemple de la participante donne : thème « manque de temps », action « renvoyer le lien de l'espace e-learning », citation « approche pédagogique généreuse » candidate.

## Ordre proposé
1. Table `training_feedbacks` + ajout manuel + outil MCP.
2. Onglet « Retours » et lien vers `improvements`.
3. Import CSV Google Form.
4. Questionnaire à froid participant natif.
5. Citations candidates et suites proposées.

## Questions ouvertes
- Délai du questionnaire à froid participant (3 mois ?) et questions à reprendre du Google Form actuel.
- Les citations validées doivent-elles alimenter la table `testimonials` existante (aujourd'hui vidéos) ou rester dans le module Évaluations ?
