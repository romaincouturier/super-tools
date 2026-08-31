# Convention de formation depuis un devis

Objectif : pouvoir remettre au client une convention de formation correspondant à un devis déjà envoyé (demande OPCO), sans passer par la création d'une session de formation.

## Ce qui change pour l'utilisateur

Dans la carte CRM, bloc historique « emails & devis » (`SentDevisSection`) :

- Sur chaque devis de formation, le bouton « Dupliquer » est remplacé par « Télécharger la convention de formation ».
- Si le devis a été envoyé en 2 versions (avec / sans subrogation), deux boutons apparaissent : « Convention sans subrogation » et « Convention avec subrogation ».
- Un clic génère le PDF de convention (même modèle PDFMonkey que les conventions de formation existantes) et l'ouvre dans un nouvel onglet. Aucun email n'est envoyé, aucun programme n'est joint.
- Les dates et le lieu reprennent exactement le texte du devis (y compris « à définir » ou une date en texte libre) ; les horaires restent la mention par défaut du modèle.

## Détails techniques

Nouvelle fonction edge `generate-devis-convention` :

- Entrée : `activityLogId` du devis (`activity_logs.action_type = 'micro_devis_sent'`) + `subrogation: boolean`.
- Relit `details.form_data` du log (client, adresse, CP, ville, commanditaire, formation, formule, date/date libre, lieu/lieu autre, participants, prix, durée, nb participants, `offrirFraisAdmin`, `typeSubrogation`).
- Construit le payload PDFMonkey du modèle Convention (`CONVENTION_TEMPLATE_ID` déjà utilisé par `generate-convention-formation`) : `CLIENT`, `ADRESSE`, `TITRE_FORMATION`, `FORMAT` (intra / inter), `PARTICIPANTS`, `STAGIAIRES` (liste saisie dans le devis, sinon placeholders), `DATES` (texte du devis tel quel), `LIEU`, `PRIX` (prix × nb participants + frais de dossier selon subrogation, mêmes règles que `generate-micro-devis`), `TVA`, `PRIX_TTC`, `SUBROGATION`, `URL_PROGRAMME_FORMATION` (programme de la config formation), `HORAIRES` / `JOURS` valeurs par défaut.
- Poll PDFMonkey (même boucle que la fonction existante), puis retourne `{ pdfUrl, fileName }` et journalise `action_type: 'convention_devis_generated'` dans `activity_logs` avec `crm_card_id`.
- Pas de nouvelle table : la convention n'est pas persistée côté session puisqu'aucune formation n'existe encore.

Front :

- `src/components/crm/SentDevisSection.tsx` : remplacer le bouton « Dupliquer » (pour les devis de formation) par un ou deux boutons de convention, avec état de chargement et gestion d'erreur via `toastError`. Les devis de jeu (`game_devis_sent`) ne sont pas concernés.
- Déclarer la fonction dans `supabase/config.toml` et dans la liste de santé `src/lib/edgeFunctionsHealth.ts`.

## Hors périmètre

- Envoi par email de la convention et signature électronique (peut être ajouté plus tard).
- Jonction du programme de formation.
