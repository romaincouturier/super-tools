
# Plan : Émargement électronique

## Contexte

L'objectif est de créer un système d'émargement électronique permettant aux participants de signer leur présence numériquement pour chaque demi-journée de formation, avec une signature reconnue légalement en France (conformément au règlement eIDAS).

## Vue d'ensemble de la fonctionnalité

```text
+----------------------------+       +---------------------------+
|   Page FormationDetail     |       |   Email automatique       |
|   (Jour J)                 | ----> |   par demi-journée        |
|   Bloc "Émargement"        |       |   "Signez votre présence" |
+----------------------------+       +---------------------------+
                                              |
                                              v
                              +-----------------------------------+
                              |   Page publique /emargement/:token|
                              |   - Titre formation               |
                              |   - Nom Prénom                    |
                              |   - Lieu, Date, Horaire           |
                              |   - Canvas de signature           |
                              |   - Bouton "Signer"               |
                              +-----------------------------------+
                                              |
                                              v
                              +-----------------------------------+
                              |   Stockage signature + horodatage |
                              |   dans la base de données         |
                              +-----------------------------------+
```

---

## 1. Schéma de base de données

### Nouvelle table : `attendance_signatures`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid | Clé primaire |
| `training_id` | uuid | Référence à la formation |
| `participant_id` | uuid | Référence au participant |
| `schedule_date` | date | Date de la demi-journée |
| `period` | text | "AM" (matin) ou "PM" (après-midi) |
| `token` | varchar | Token unique pour accéder à la page de signature |
| `signature_data` | text | Image de signature encodée en base64 (data URL) |
| `signed_at` | timestamptz | Horodatage de la signature (preuve légale) |
| `ip_address` | text | Adresse IP du signataire |
| `user_agent` | text | Navigateur/appareil utilisé |
| `email_sent_at` | timestamptz | Date d'envoi de l'email d'invitation |
| `email_opened_at` | timestamptz | Date de première ouverture |
| `created_at` | timestamptz | Date de création |

**Politiques RLS :**
- Les utilisateurs authentifiés peuvent voir et gérer les signatures
- Le public peut mettre à jour sa propre signature via token

---

## 2. Edge Function : `send-attendance-signature-request`

Cette fonction sera invoquée pour envoyer les emails de demande de signature.

**Paramètres :**
- `trainingId` : ID de la formation
- `scheduleDate` : Date ciblée
- `period` : "AM" ou "PM"

**Comportement :**
1. Récupère tous les participants de la formation
2. Génère un token unique pour chaque participant/demi-journée
3. Crée les enregistrements dans `attendance_signatures`
4. Envoie un email personnalisé à chaque participant avec le lien de signature

**Email envoyé :**
```
Objet : ✍️ Émargement – NOM_FORMATION – Date Matin/Après-midi

Bonjour Prénom,

Merci de bien vouloir signer ta présence pour la formation "NOM_FORMATION".

📍 Lieu : LIEU
📅 Date : DATE
🕐 Horaire : HORAIRE

👉 Clique ici pour signer : [Lien]

Cette signature électronique a valeur légale conformément au règlement eIDAS.

À tout de suite !
```

---

## 3. Page publique : `/emargement/:token`

### Composant : `src/pages/Emargement.tsx`

**Éléments affichés :**
- Logo SuperTilt en en-tête
- Titre : "Émargement électronique"
- Informations de la formation :
  - Nom de la formation
  - Nom et prénom du participant
  - Lieu
  - Date
  - Horaire de demi-journée (ex: "9h00 - 12h30")
- Zone de signature (canvas)
- Bouton "Signer ma présence"
- Mention légale sur la valeur juridique

**Librairie de signature :**
- Utilisation de `signature_pad` (npm) - 170k téléchargements/semaine
- Génère une image en base64 de la signature manuscrite
- Compatible mobile (tactile) et desktop (souris)

**Validation juridique (eIDAS) :**
- La signature simple est légalement reconnue en France
- L'horodatage + IP + User-Agent constituent une preuve
- Mention explicite : "En signant, j'atteste de ma présence à cette demi-journée de formation."

---

## 4. Bloc "Émargement électronique" dans FormationDetail

### Affichage le jour J uniquement

Le bloc apparaît dans la page de détail de formation lorsque :
- La date du jour correspond à une date de la formation

### Contenu du bloc

```text
+----------------------------------------+
| ✍️ Émargement électronique             |
+----------------------------------------+
| 15/02 Matin     [12/15 signés] [Envoyer] |
| 15/02 Après-midi [8/15 signés] [Envoyer] |
| 16/02 Matin     [0/15 signés] [Envoyer] |
| 16/02 Après-midi [0/15 signés] [Envoyer] |
+----------------------------------------+
```

**Bouton "Envoyer" :**
- Déclenche l'envoi des emails de signature pour cette demi-journée
- Devient "Renvoyer" si déjà envoyé
- Affiche le nombre de signatures reçues / total participants

---

## 5. Intégration dans les emails programmés

### Nouveau type d'email : `attendance_signature`

Le système existant `scheduled_emails` sera enrichi pour afficher les emails d'émargement :
- Label : "Émargement"
- Prévisualisation du contenu
- Possibilité de forcer l'envoi

---

## 6. Fichiers à créer/modifier

| Fichier | Action |
|---------|--------|
| `supabase/migrations/xxx.sql` | Créer la table `attendance_signatures` |
| `src/pages/Emargement.tsx` | Nouvelle page publique de signature |
| `src/App.tsx` | Ajouter la route `/emargement/:token` |
| `supabase/functions/send-attendance-signature-request/index.ts` | Edge function d'envoi des emails |
| `src/components/formations/AttendanceSignatureBlock.tsx` | Nouveau composant bloc émargement |
| `src/pages/FormationDetail.tsx` | Intégrer le bloc émargement |
| `src/components/formations/ScheduledEmailsSummary.tsx` | Ajouter le type `attendance_signature` |
| `supabase/functions/force-send-scheduled-email/index.ts` | Supporter le nouveau type d'email |
| `package.json` | Ajouter la dépendance `signature_pad` |

---

## Détails techniques

### Installation de signature_pad

```bash
npm install signature_pad
```

### Exemple d'utilisation dans le composant

```typescript
import SignaturePad from "signature_pad";

// Dans le composant
const canvasRef = useRef<HTMLCanvasElement>(null);
const [signaturePad, setSignaturePad] = useState<SignaturePad | null>(null);

useEffect(() => {
  if (canvasRef.current) {
    const pad = new SignaturePad(canvasRef.current, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "rgb(0, 0, 0)",
    });
    setSignaturePad(pad);
  }
}, []);

const handleSign = async () => {
  if (!signaturePad || signaturePad.isEmpty()) {
    toast({ title: "Erreur", description: "Veuillez signer avant de valider" });
    return;
  }
  
  const signatureData = signaturePad.toDataURL("image/png");
  
  // Envoyer à Supabase
  await supabase
    .from("attendance_signatures")
    .update({
      signature_data: signatureData,
      signed_at: new Date().toISOString(),
      ip_address: // récupéré via edge function
      user_agent: navigator.userAgent,
    })
    .eq("token", token);
};
```

### Structure de l'email d'émargement

```html
<p>Bonjour {{prénom}},</p>
<p>Merci de bien vouloir signer ta présence pour la formation <strong>{{nom_formation}}</strong>.</p>
<ul>
  <li>📍 Lieu : {{lieu}}</li>
  <li>📅 Date : {{date}}</li>
  <li>🕐 Horaire : {{horaire}}</li>
</ul>
<p><a href="{{lien}}" style="...">✍️ Signer ma présence</a></p>
<p><small>Cette signature électronique a valeur légale conformément au règlement européen eIDAS.</small></p>
```

---

## Conformité légale

### Signature électronique simple (eIDAS)

La signature électronique simple est reconnue en France et dans l'UE. Pour garantir sa valeur probante :

1. **Horodatage précis** : Date et heure de signature enregistrées
2. **Identification** : Email du signataire + nom/prénom
3. **Intégrité** : Signature stockée en base de données immuable
4. **Traçabilité** : IP, User-Agent, date d'envoi de l'email
5. **Intention** : Mention explicite "J'atteste de ma présence"

### Mentions légales sur la page

> "En signant, j'atteste de ma présence à cette demi-journée de formation et accepte que cette signature électronique ait valeur légale conformément au règlement européen eIDAS (UE n° 910/2014)."
