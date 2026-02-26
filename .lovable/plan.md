

# Envoi des livrables de mission par email

## Vue d'ensemble

Ajout d'un bouton dans le drawer de mission pour envoyer un email de livraison aux contacts choisis, avec preview du mail. Le template de cet email sera configurable dans les parametres generaux (onglet Emails), comme tous les autres templates.

## Composants a creer / modifier

### 1. Template email dans Parametres (`src/pages/Parametres.tsx`)

Ajout d'une entree `mission_deliverables` dans `DEFAULT_TEMPLATES` (avant la fermeture du `Record`, ligne ~739) :

- **Timing** : `"manual"`
- **Variables** : `first_name`, `mission_title`, `deliverables_link`
- **Contenu FR (tu)** : Message chaleureux invitant a telecharger les livrables via le lien de synthese
- **Contenu FR (vous)** : Version formelle equivalente
- **Objet** : "Vos livrables sont disponibles - {{mission_title}}"

Ce template sera editable dans l'onglet "Emails" des parametres, comme tous les autres.

### 2. Nouveau composant : `src/components/missions/SendDeliverablesDialog.tsx`

Dialog modale avec :
- Chargement des contacts de la mission via `useMissionContacts(missionId)`
- Checkboxes pour selectionner les destinataires (seuls ceux avec un email sont affichables ; le contact primaire est pre-coche)
- Champ objet pre-rempli (editable)
- Preview HTML du mail en temps reel (adapte au premier contact selectionne : prenom + langue)
- Bouton "Envoyer" qui appelle `supabase.functions.invoke("send-mission-deliverables", ...)`
- Toast de succes/erreur

### 3. Nouvelle edge function : `supabase/functions/send-mission-deliverables/index.ts`

- Recoit : `mission_id`, `recipients: { email, first_name, language }[]`, `subject`
- Charge le template depuis `email_templates` (type `mission_deliverables_tu` / `mission_deliverables_vous`), avec fallback sur le contenu par defaut
- Construit le lien : `APP_URL/mission-info/{mission_id}`
- Pour chaque destinataire : personnalise le HTML (prenom), ajoute signature Signitic + BCC
- Envoi sequentiel avec delai 600ms (rate limit Resend)
- Utilise les modules partages existants : `sendEmail`, `getSigniticSignature`, `getBccSettings`, `processTemplate`, `textToHtml`

### 4. Modification : `src/components/missions/MissionDetailDrawer.tsx`

- Import `Package` (lucide-react) et `SendDeliverablesDialog`
- Ajout d'un bouton `Package` dans le header (a cote des boutons IA et partage)
- State `showDeliverables` pour ouvrir/fermer le dialog

### 5. Configuration : `supabase/config.toml`

Ajout de :
```toml
[functions.send-mission-deliverables]
verify_jwt = false
```

## Contenu par defaut du mail

**Version tutoiement :**
```
Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Bonne nouvelle ! Les livrables de la mission "{{mission_title}}" sont prets pour toi.

Tu peux les consulter et les telecharger a tout moment en cliquant ci-dessous :

[Acceder aux livrables] -> {{deliverables_link}}

N'hesite pas a revenir vers moi si tu as la moindre question.

A tres bientot !
```

**Version vouvoiement :** equivalente avec formules de politesse adaptees.

## Resume des fichiers

| Fichier | Action |
|---|---|
| `src/pages/Parametres.tsx` | Ajout template `mission_deliverables` dans `DEFAULT_TEMPLATES` |
| `src/components/missions/SendDeliverablesDialog.tsx` | Creation (dialog selection contacts + preview + envoi) |
| `supabase/functions/send-mission-deliverables/index.ts` | Creation (edge function envoi via Resend) |
| `src/components/missions/MissionDetailDrawer.tsx` | Ajout bouton + import dialog |
| `supabase/config.toml` | Ajout config fonction |

