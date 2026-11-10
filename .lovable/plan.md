# Attestations de bonne exécution signées en ligne

## Objectif

Produire, depuis une mission ou une formation, une attestation pré-remplie et modifiable. SuperTools fournit un lien de signature : le client signe en ligne sans compte, puis le PDF signé est archivé et envoyé par email à romain@supertilt.fr, avec une copie au signataire. Aucun email n'est envoyé au client avant la signature : la demande de signature est rédigée à part, en brouillon Gmail.

## Ce qui existe déjà et sera réutilisé

- Le parcours de signature des devis, conventions et contrats de location : page publique `/signature-…/:token`, tracé de la signature, journal du parcours, adresse IP, appareil, empreinte du document et page de preuve ajoutée au PDF (`_shared/generate-signed-pdf.ts`, `_shared/signature-helpers.ts`, `_shared/crypto.ts`).
- L'envoi d'emails avec copie cachée systématique, signature Signitic et journalisation de 100 % des envois.
- Le serveur MCP récent : outils dans `src/lib/mcp/tools`, accès par connexion OAuth, droits de l'appelant respectés. L'ancien serveur MCP n'est pas modifié.

## Parcours

```text
Mission / Formation -> "Nouvelle attestation" (pré-remplie) -> Brouillon (modifiable)
  -> "Générer le lien" -> Envoyée (lien copiable, aucun email)
  -> Client : relit, complète nom/fonction, signe, coche le consentement, valide
  -> Signée : PDF signé + page de preuve, figé ; email à Romain + copie au signataire
  -> Refusée (bouton "Je refuse" + motif) ou Expirée (date dépassée)
```

## Modèle de données

Table `execution_attestations` :
- **Source :** `mission_id` ou `training_id`, exactement l'un des deux (contrainte).
- **Statut :** `draft` / `sent` / `signed` / `refused` / `expired`, avec `sent_at`, `signed_at`, `refused_at`, `refusal_reason`, `expires_at` (30 jours par défaut, modifiable).
- **Prestataire, copié à la création pour figer le document :** raison sociale, SIRET, n° de déclaration d'activité et adresse, lus depuis un réglage central à créer s'il n'existe pas.
- **Client :** organisme, adresse, nom, fonction et email du signataire.
- **Prestation :** objet, date de début, date de fin, lieu, nombre de participants, nombre de jours, montant HT, texte libre et mention de certification (texte par défaut modifiable).
- **Signature :** empreinte (hash) du token et non le token en clair, tracé de la signature, nom et fonction saisis, adresse IP, appareil, journal du parcours, empreinte du contenu signé, chemin du PDF signé, empreinte du PDF.
- **Traçabilité :** `created_by`, `updated_by`, horodatages, et chaque changement de statut tracé dans le journal d'activité existant.

Accès (RLS) : administrateurs et comptes ayant accès au module missions ou formations, selon la source. Aucun accès anonyme à la table : la page publique passe par une fonction serveur.

Stockage : fichiers privés `attestations/<id>/signed.pdf`, ouverts par des liens signés de courte durée.

## Pré-remplissage

- **Depuis une mission :** organisme et contact client, titre, dates, lieu, nombre de jours, montant HT (montant facturé, sinon initial).
- **Depuis une formation :** client, commanditaire comme signataire, intitulé, dates, lieu, nombre d'inscrits, prix HT.

Tout reste modifiable tant que l'attestation est en brouillon. Après génération du lien, une modification remet l'attestation en brouillon et invalide le lien.

## Écrans

- **Fiche mission et fiche formation :** section « Attestations » listant statut, signataire et dates, avec les actions Nouvelle, Modifier, Générer ou copier le lien, Télécharger le PDF signé et Annuler.
- **Formulaire d'édition :** tous les champs, plus un aperçu du rendu.
- **Liste globale « Attestations » :** filtres par statut, type de source et client ; lien vers la source.
- **Page publique `/attestation/:token`,** aux couleurs SuperTilt, sans mention SuperTools : lecture de l'attestation, nom et fonction modifiables, tracé à la souris ou au doigt avec un bouton Effacer, case « Je certifie… et j'accepte la signature électronique », boutons Signer et Refuser. Les cas déjà signée, expirée ou lien invalide ont chacun un message clair.

## Fonctions serveur

1. **`attestation-public` :** lecture par token pour la page publique, renvoyant uniquement les champs affichés, et enregistrement des étapes du parcours.
2. **`submit-attestation-signature` :**
   - vérifie le token, le statut et l'expiration, puis enregistre la signature et les preuves en une seule fois, avec verrou contre la double signature ;
   - génère le PDF avec pdf-lib : en-tête et couleurs SuperTilt, blocs prestataire, client et prestation, texte libre, mention, date, nom et fonction, signature incrustée, page de preuve ;
   - stocke le PDF, calcule son empreinte, passe l'attestation en Signée ;
   - envoie l'email à romain@supertilt.fr avec copie au signataire et PDF joint. C'est le seul email automatique, il est journalisé.
3. **`refuse-attestation` :** refus par token avec un motif ; aucun email au client, notification interne seulement si tu la demandes.
4. **Expiration :** passage en Expirée calculé au moment de la lecture, sans nouvelle tâche planifiée.
5. **Génération du lien :** côté staff, le token est tiré au hasard (256 bits) et seule son empreinte est stockée. Le lien est affiché une fois puis peut être régénéré, ce qui invalide l'ancien.

## Outils MCP (serveur récent, OAuth, droits de l'appelant)

- **`create_execution_attestation` :** depuis `mission_id` ou `training_id`, avec le texte libre et des champs optionnels qui remplacent le pré-remplissage. Crée un brouillon et le trace.
- **`update_execution_attestation` :** modifie un brouillon.
- **`list_execution_attestations` :** filtres par statut et par source ; renvoie statut, signataire et dates.
- **`get_execution_attestation_link` :** génère ou régénère le lien de signature (passage en Envoyée), sans email.
- **`get_execution_attestation_pdf` :** lien de téléchargement temporaire du PDF signé.

Aucun outil d'envoi au client ni de suppression. Après ces ajouts, il faudra republier l'application pour que les outils MCP soient disponibles.

## Points de vigilance

- **Sécurité du token :** aléatoire et long, stocké uniquement en empreinte, expiration, utilisable une seule fois après signature, régénération qui invalide l'ancien, limitation des tentatives sur la page publique, aucune donnée hors attestation renvoyée.
- **Valeur probante :** c'est une signature électronique simple au sens du règlement eIDAS, recevable comme commencement de preuve, comme pour les devis actuels. Elle est renforcée par le contenu figé et son empreinte au moment de la signature, l'horodatage serveur, l'IP, l'appareil, le journal du parcours, la case de consentement, la page de preuve dans le PDF et l'empreinte du PDF. En option, on peut ajouter une vérification par code envoyé par email au signataire, comme pour le contrat auteur. Ce serait un second email automatique, donc seulement si tu le demandes.
- **RGPD :** les données sont limitées au signataire (nom, fonction, email, IP, tracé), avec une mention d'information sur la page de signature. L'accès reste réservé au staff concerné, le PDF est privé et les liens sont temporaires. Conservation proposée : 10 ans pour les preuves contractuelles (à valider), avec purge de l'IP et de l'appareil des attestations refusées ou expirées après 1 an.
- **Sauvegardes :** la nouvelle table et les fichiers sont ajoutés à la sauvegarde quotidienne.
- **Marque :** « SuperTilt » uniquement sur la page publique, le PDF et les emails.

## Étapes de réalisation

1. Modification de la base (table, droits, stockage, réglage des informations légales SuperTilt) et tests d'isolation des droits.
2. Fonctions serveur : lecture publique, signature avec PDF et email, refus.
3. Écrans : sections sur les fiches mission et formation, formulaire, liste globale, page publique.
4. Outils MCP, puis génération du manifeste.
5. Ajout aux sauvegardes.

## Tests prévus

- Une attestation exige exactement une source.
- Pré-remplissage depuis une mission et depuis une formation.
- Token invalide, expiré ou déjà utilisé : refusé.
- Une double signature n'en garde qu'une.
- Modifier une attestation envoyée la remet en brouillon et invalide le lien.
- Un compte sans droit ne voit pas les attestations.
- Le PDF contient la signature, et son empreinte correspond.
- L'email part uniquement à Romain et au signataire, et seulement à la signature.

## Questions ouvertes

- Où trouver le SIRET et le n° de déclaration d'activité : réglage existant, ou valeurs à me fournir ?
- Faut-il le code de vérification par email au signataire ? Proposé désactivé.
- Durée de validité du lien : 30 jours proposés.
- Durée de conservation : 10 ans proposés.

## Impact sécurité (PR)

- Nouvelle table accessible seulement aux comptes connectés concernés, sans accès anonyme.
- Fonctions publiques limitées au token, avec limitation des tentatives.
- Fichiers privés.
- Outils MCP soumis aux droits de l'appelant.
