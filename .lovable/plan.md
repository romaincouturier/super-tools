

# Plan: Ajouter une option de type de subrogation pour les devis

## Contexte

Actuellement, le formulaire Micro-devis genere automatiquement 2 PDFs (avec et sans subrogation) et les envoie par email. L'utilisateur souhaite pouvoir choisir quel(s) type(s) de devis generer parmi:
- Sans subrogation
- Avec subrogation (prise en charge OPCO)
- Les deux (comportement actuel, par defaut)

## Modifications a effectuer

### 1. Frontend - Formulaire (src/pages/MicroDevis.tsx)

**Ajout d'un nouvel etat:**
```typescript
const [typeSubrogation, setTypeSubrogation] = useState<"sans" | "avec" | "les2">("les2");
```

**Ajout d'un nouveau champ dans la section Formation:**
- Position: apres le champ "Frais de dossier de 150 EUR HT"
- Type: RadioGroup avec 3 options
- Labels:
  - "Devis sans subrogation de paiement"
  - "Devis avec subrogation de paiement (prise en charge OPCO)"
  - "Les 2" (selectionne par defaut)

**Mise a jour du payload:**
- Ajouter `typeSubrogation` dans les donnees envoyees a l'edge function
- Mettre a jour le message de succes selon le choix:
  - "les2": "Les 2 devis ont ete generes..."
  - "sans" ou "avec": "Le devis a ete genere..."

### 2. Backend - Edge Function (supabase/functions/generate-micro-devis/index.ts)

**Mise a jour de l'interface RequestBody:**
```typescript
interface RequestBody {
  // ... champs existants
  typeSubrogation: "sans" | "avec" | "les2";
}
```

**Logique de generation conditionnelle:**
- Si `typeSubrogation === "les2"`: generer les 2 PDFs (comportement actuel)
- Si `typeSubrogation === "sans"`: generer uniquement le PDF sans subrogation
- Si `typeSubrogation === "avec"`: generer uniquement le PDF avec subrogation

**Mise a jour de l'envoi d'email:**
- Adapter le contenu HTML de l'email selon le nombre de devis envoyes
- Adapter les pieces jointes (1 ou 2 PDFs)
- Adapter le texte explicatif dans le corps de l'email

## Details techniques

### Structure du nouveau champ UI

```text
+-----------------------------------------------+
| Type de devis a generer *                     |
+-----------------------------------------------+
| ( ) Devis sans subrogation de paiement        |
| ( ) Devis avec subrogation (prise en charge   |
|     OPCO)                                     |
| (o) Les 2 (defaut)                            |
+-----------------------------------------------+
```

### Adaptation du contenu email

**Pour 1 seul devis:**
- Sujet: "Votre devis pour la formation..."
- Corps: "Vous trouverez en piece jointe notre devis [avec/sans] subrogation..."

**Pour les 2 devis (actuel):**
- Comportement inchange

### Compatibilite retroactive

Le champ `typeSubrogation` sera optionnel dans l'edge function avec une valeur par defaut de `"les2"` pour assurer la compatibilite avec d'eventuels appels existants.

