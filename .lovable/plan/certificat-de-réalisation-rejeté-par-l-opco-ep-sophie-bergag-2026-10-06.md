# Certificat de réalisation rejeté par l'OPCO EP (Sophie Bergaglio)

## Diagnostic (vérifié)

**Cause du rejet : le certificat ignore l'entreprise de la fiche participant.**
- Le certificat envoyé le 07/08 est généré automatiquement à la soumission de l'évaluation.
- La case « Entreprise » du PDF est remplie avec l'entreprise saisie *par la stagiaire dans son évaluation*. Sophie ne l'a pas renseignée (vide).
- Pour les formations e-learning et inter, il n'y a aucun repli : le PDF affiche « — ». Pour l'intra, il reprend le client de la formation.
- Or la fiche participant de Sophie contient bien l'entreprise (« Ea'ters ») et l'email RH. La donnée existait, elle n'a juste pas été utilisée.
- Ce n'est donc ni un lien manquant ni une inscription boutique mal rattachée : c'est un défaut de logique, qui touche potentiellement tous les certificats inter/e-learning dont l'apprenant n'a pas saisi son entreprise.

**Autres constats**
- La fiche participant ne stocke que le nom court « Ea'ters », pas la raison sociale complète (« EA'TERS Entreprise Adaptée »), ni adresse ni SIRET.
- La formation de Sophie est enregistrée du 03/06/2026 au 01/07/2026, pas du 27/05 comme indiqué : dates à confirmer avant régénération.
- Le modèle PDF reçoit seulement : stagiaire, entreprise, intitulé, dates, durée (+ « en e-learning »), date du jour. L'organisme, la nature de l'action et la signature sont figés dans le modèle PDF lui-même, que je ne peux pas lire depuis ici : à contrôler visuellement sur le PDF de Sophie.

**Convention (rejet de mai)**
- Le code actuel met les dates : e-learning = « Du [début] au [fin] » de la formation ; présentiel/classe virtuelle = dates du planning.
- Risques restants : e-learning sans date de début → « Accès permanent » (pas de dates) ; présentiel sans planning saisi → champ dates vide. À bloquer.

## Mentions du modèle officiel de certificat de réalisation

| Mention | Présente aujourd'hui |
|---|---|
| Organisme de formation | Figée dans le modèle PDF (à vérifier) |
| Raison sociale de l'employeur | Non fiable (cause du rejet) |
| Nom du stagiaire | Oui |
| Intitulé de l'action | Oui |
| Dates | Oui |
| Durée | Oui |
| Nature de l'action (action de formation, bilan, VAE, apprentissage) | À vérifier dans le modèle PDF |
| Lieu / signature du responsable | Date oui ; signature à vérifier |

## Corrections proposées

1. **Entreprise sur le certificat** : prendre en priorité l'entreprise de la fiche participant, puis celle saisie en évaluation, puis le client de la formation (intra). Ne plus jamais produire « — » : si aucune entreprise, alerte interne avant envoi pour les participants financés (OPCO/employeur).
2. **Raison sociale complète** : utiliser la raison sociale complète quand elle est connue (fiche participant ou financeur). Pour Sophie, saisir « EA'TERS Entreprise Adaptée ».
3. **Modèle PDF** : vérifier/ajouter dans le modèle les mentions « Nature de l'action : Action de formation », l'organisme (nom, NDA) et la signature. Modification à faire dans l'outil PDF (je te guide si un champ manque).
4. **Générateur manuel de certificats** : même règle d'entreprise.
5. **Convention** : refuser la génération si aucune date n'est disponible (e-learning sans date de début, présentiel sans planning), avec un message clair, plutôt que produire une convention sans dates.
6. **Audit** : lister les certificats inter/e-learning déjà envoyés avec entreprise vide alors que la fiche participant en a une (aucun renvoi automatique).

## Régénération pour Sophie Bergaglio

1. Confirmer les dates (03/06 ou 27/05) et corriger la formation si besoin.
2. Mettre la raison sociale « EA'TERS Entreprise Adaptée » sur sa fiche.
3. Régénérer son certificat (remplacement du PDF existant), te l'envoyer d'abord pour contrôle.
4. Après ton accord seulement : envoi à Maëva Lemoine (et Sophie si tu veux) pour transmission à l'OPCO EP.

## Détails techniques

- `process-evaluation-submission/index.ts` l.266/304 : `ENTREPRISE` = `evaluation.company` puis `client_name` hors inter/e-learning, sinon `"—"`. Lire `training_participants.company` via `evaluation.participant_id`.
- `generate-certificates/index.ts` : `entreprise` vient du body (`CertificateGenerator.tsx`) ; appliquer le même ordre de repli par participant.
- Helper partagé `_shared/certificate-company.ts` utilisé par les deux fonctions.
- `generate-convention-formation/index.ts` l.442 : erreur explicite si `DATES` vide ou « Accès permanent » pour une convention financée.
- Régénération via `generate-certificates` avec `forceRegenerate: true`, `trainingId`, `participantId`, envoi limité à romain@ pour la preuve.
