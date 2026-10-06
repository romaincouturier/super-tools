# Certificat de réalisation de Sophie Bergaglio rejeté par l'OPCO EP : état et suite

Participante : Sophie Bergaglio (sophie.bergaglio@gmail.com). Commanditaire RH en copie : Maëva Lemoine.

## 1. Cause (vérifiée)

- Le certificat est généré automatiquement quand la stagiaire soumet son évaluation (07/08/2026), via le modèle PDF du certificat.
- Données transmises au modèle : stagiaire, entreprise, intitulé, dates, durée (« Xh en e-learning »), date du jour.
- Le champ « Entreprise » était rempli avec ce que la stagiaire tape dans son évaluation. Sophie l'avait laissé vide. Pour les formations en ligne et inter, il n'y avait pas de valeur de secours, donc le PDF affichait « — ».
- Sa fiche participant contenait pourtant « Ea'ters » et l'email de Maëva. Le lien entre participante et entreprise existait. Le modèle avait bien le champ. C'est un défaut de logique, pas une donnée manquante.
- Audit : c'est le seul certificat inter ou e-learning déjà envoyé avec ce défaut.

## 2. Mentions OPCO

| Mention | État |
|---|---|
| Raison sociale de l'employeur | Corrigée (voir 4) |
| Stagiaire, intitulé, dates, durée | Présentes |
| Organisme, nature de l'action, signature | Écrites en dur dans le modèle PDF, non vérifiables depuis l'app : à contrôler sur le PDF régénéré |

Point d'attention : la formation est enregistrée du **03/06/2026** au 01/07/2026, pas du 27/05. Ces dates apparaîtront sur le certificat.

## 3. Convention (rejet de mai)

- En ligne : « Du [début] au [fin] » de la formation. Présentiel et classe virtuelle : dates du planning.
- Faille corrigée : avant, une formation en ligne sans date de début donnait « Accès permanent », et une formation en présentiel sans planning donnait un champ vide. La génération est maintenant bloquée avec un message clair.

## 4. Corrections déjà faites et mises en ligne

- L'entreprise du certificat vient en priorité de la fiche participant, puis de l'évaluation, puis du client de la formation (intra seulement). Même règle pour le générateur manuel.
- La fiche de Sophie indique « EA'TERS Entreprise Adaptée ».
- La convention ne peut plus être générée sans dates.

## 5. Reste à faire

1. Confirmer la bonne date de début (27/05 ou 03/06) et corriger la formation si besoin.
2. Régénérer le certificat de Sophie en remplaçant l'ancien PDF, avec un premier envoi à romain@ seulement pour contrôle. Je peux le faire depuis l'app si tu restes connecté au navigateur de test. Sinon, utilise le générateur de certificats avec l'option de régénération.
3. Contrôler sur ce PDF l'organisme, « Nature de l'action : action de formation » et la signature. Si un élément manque, je te guide pour modifier le modèle PDF.
4. Une fois validé, envoyer le certificat à Maëva Lemoine, et à Sophie si tu veux, pour qu'elle le transmette à l'OPCO EP.
5. Optionnel : ajouter l'adresse et le SIRET de l'employeur sur la fiche participant et le certificat. Le modèle officiel ne les exige pas.

## Détails techniques

- Helper `_shared/certificate-company.ts`, utilisé par `process-evaluation-submission` et `generate-certificates` (déployées).
- Garde `conventionDates` dans `generate-convention-formation` (déployée), réponse 400 si vide.
- Régénération : `generate-certificates` avec `forceRegenerate: true`, `trainingId=8b78800b-…`, `participantId=faa4bcea-…`, appel authentifié requis.
