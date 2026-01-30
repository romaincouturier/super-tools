
# Réorganisation des blocs Documents et Emails programmés

## Objectif
Déplacer les blocs "Documents et communication" et "Emails programmés" de la page d'édition vers la page de visualisation d'une formation.

## Changements prévus

### 1. Page de visualisation (`FormationDetail.tsx`)

**Ajouter les éléments suivants dans la colonne de droite (après les participants) :**

- **Bloc "Documents et communication"** : Upload facture, feuilles d'émargement, lien supports, envoi de documents au commanditaire ou autre destinataire, envoi du mail de remerciement aux participants
- **Bloc "Emails programmés"** : Synthèse des emails automatisés (bienvenue, questionnaire besoins, rappels, etc.)

**Données à récupérer depuis la base :**
- `supports_url` (déjà dans le training mais pas dans l'interface Training)
- Les documents sont déjà chargés (`invoice_file_url`, `attendance_sheets_urls`)

### 2. Page d'édition (`FormationEdit.tsx`)

**Retirer les éléments suivants :**
- Le composant `DocumentsManager`
- Les states associés (`invoiceFileUrl`, `attendanceSheetsUrls`, `supportsUrl`)
- Les champs dans le formulaire de soumission liés aux documents (garder juste les données de base de la formation)

### 3. Adaptation du composant `DocumentsManager`

Le composant doit pouvoir :
- Mettre à jour directement en base (pas via un formulaire parent)
- Appeler `supabase.from("trainings").update(...)` après chaque upload/suppression
- Rafraîchir les données après modification

### 4. Nouvelle disposition de la page de visualisation

```text
+------------------+------------------------------------+
|   Informations   |     Participants                   |
+------------------+------------------------------------+
|  Commanditaire   |     Documents et communication     |
+------------------+------------------------------------+
|    Prérequis     |     Emails programmés              |
+------------------+------------------------------------+
|    Objectifs     |                                    |
+------------------+------------------------------------+
```

## Fichiers modifiés

| Fichier | Action |
|---------|--------|
| `src/pages/FormationDetail.tsx` | Ajouter DocumentsManager et ScheduledEmailsSummary, récupérer `supports_url` |
| `src/pages/FormationEdit.tsx` | Retirer DocumentsManager et les states associés |
| `src/components/formations/DocumentsManager.tsx` | Adapter pour sauvegarder directement en base au lieu de passer par un callback parent |

## Détails techniques

### DocumentsManager - Mode autonome

Actuellement, `DocumentsManager` utilise des callbacks (`onDocumentsChange`, `onSupportsUrlChange`) pour remonter les changements au parent. Pour la page de visualisation, il devra :

1. Recevoir les valeurs initiales en props
2. Après chaque upload/suppression, faire un `UPDATE` direct sur la table `trainings`
3. Appeler un callback `onUpdate()` optionnel pour rafraîchir les données dans le parent

```typescript
// Nouveau comportement après upload
const handleInvoiceUpload = async (...) => {
  // ... upload vers storage ...
  
  // Sauvegarde directe en base
  await supabase
    .from("trainings")
    .update({ invoice_file_url: publicUrl })
    .eq("id", trainingId);
  
  // Rafraîchir le parent
  onUpdate?.();
};
```

### FormationDetail - Intégration

```typescript
// Ajouter supports_url dans l'interface Training
interface Training {
  // ... existant ...
  supports_url: string | null;
}

// Dans le JSX, après le bloc Participants
<DocumentsManager
  trainingId={training.id}
  invoiceFileUrl={training.invoice_file_url}
  attendanceSheetsUrls={training.attendance_sheets_urls || []}
  sponsorEmail={training.sponsor_email}
  sponsorName={...}
  supportsUrl={training.supports_url}
  onUpdate={fetchTrainingData}
/>

<ScheduledEmailsSummary 
  trainingId={training.id}
  participants={participants}
/>
```

### FormationEdit - Simplification

Retirer :
- Les states `invoiceFileUrl`, `attendanceSheetsUrls`, `supportsUrl`
- Le composant `<DocumentsManager />` du JSX
- Les champs correspondants dans `handleSubmit`

La page d'édition se concentrera uniquement sur les informations de la formation (nom, dates, lieu, client, prérequis, objectifs, etc.).
