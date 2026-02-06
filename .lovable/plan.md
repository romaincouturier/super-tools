
# Acceder a la convention envoyee par participant (inter-entreprise)

## Constat actuel

Aujourd'hui, quand une convention est generee pour un participant en inter-entreprise :
- Le PDF est telecharge localement et envoye par email au commanditaire
- Mais **aucune trace n'est conservee** sur le participant (pas de colonne `convention_file_url` dans `training_participants`)
- L'icone convention (parchemin) affiche toujours "Generer la convention", sans distinction entre "deja generee" et "a generer"
- Impossible de retrouver ou re-telecharger une convention deja envoyee

## Solution proposee

Adopter le meme pattern ergonomique que l'attestation (icone Award) : une icone qui change d'apparence selon l'etat, avec un menu deroulant offrant les actions contextuelles.

### Comportement visuel

- **Convention non generee** : icone parchemin grisee (comme aujourd'hui), clic = generer
- **Convention generee** : icone parchemin en couleur primaire, clic = menu deroulant avec :
  - "Telecharger la convention" (re-telechargement via l'URL stockee, avec refresh automatique si l'URL S3 a expire)
  - "Re-generer la convention" (ecrase et re-envoie)
  - "Voir le statut de signature" (si une signature en ligne a ete demandee, affiche le statut : en attente / signee)

## Details techniques

### 1. Migration base de donnees

Ajouter deux colonnes a `training_participants` :
- `convention_file_url` (TEXT, nullable) : URL du PDF de convention
- `convention_document_id` (TEXT, nullable) : ID du document PDFMonkey (pour refresh d'URL expiree)

### 2. Mise a jour de la Edge Function `generate-convention-formation`

Apres generation reussie du PDF, sauvegarder `convention_file_url` et `convention_document_id` sur le participant concerne :

```text
UPDATE training_participants
SET convention_file_url = pdfUrl,
    convention_document_id = documentId
WHERE id = participantId
```

### 3. Mise a jour du composant `ParticipantList.tsx`

- Ajouter `convention_file_url` et `convention_document_id` a l'interface `Participant`
- Remplacer le bouton simple par un composant conditionnel :
  - Si pas de convention : bouton simple qui declenche la generation (comportement actuel)
  - Si convention existante : `DropdownMenu` avec les options de telechargement, re-generation, et statut signature
- L'icone passe de `text-muted-foreground` a `text-primary` quand une convention existe

### 4. Gestion des URLs expirees (S3/PDFMonkey)

Conformement a la logique deja en place pour les autres documents, avant le telechargement :
- Tenter un fetch de l'URL stockee
- Si erreur 403 (URL expiree), extraire le `document_id` et appeler l'API PDFMonkey pour obtenir une nouvelle URL
- Mettre a jour l'URL en base

### 5. Statut de signature

Enrichir l'affichage en croisant avec la table `convention_signatures` (via `training_id` + `recipient_email` correspondant au `sponsor_email` du participant) pour afficher :
- Pas de signature demandee
- En attente de signature
- Signee (avec date)
