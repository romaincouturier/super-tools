

## Plan: Envoyer un événement vers le board de contenus

### Objectif
Ajouter un bouton "Envoyer au board contenus" sur la page de détail d'un événement, qui crée automatiquement une carte dans le Kanban de contenu avec le titre de l'événement, un lien vers celui-ci, et les infos clés (date, lieu).

### Étapes

**1. Ajouter un composant `SendToContentBoardButton`**
- Nouveau fichier `src/components/events/SendToContentBoardButton.tsx`
- Un bouton (icône Newspaper ou Kanban) qui ouvre un petit dialog de confirmation
- Le dialog permet de choisir la colonne cible (fetch des `content_columns`) et optionnellement le type (article/post)
- Au clic sur "Envoyer", insère une nouvelle `content_cards` dans la colonne choisie :
  - **title** : titre de l'événement
  - **description** : bloc formaté avec date, lieu, lien vers `/events/{id}`, et description de l'événement
  - **card_type** : choisi par l'utilisateur (défaut "article")
  - **tags** : `["événement"]` pour identifier la source
- Toast de succès avec lien vers le board contenus

**2. Intégrer le bouton dans la page EventDetail**
- Ajouter `<SendToContentBoardButton event={event} />` à côté du bouton "Partager" existant dans `src/pages/EventDetail.tsx`

### Détails techniques
- Pas de migration nécessaire : la table `content_cards` a déjà les colonnes `title`, `description`, `tags`, `card_type`, `column_id`, `display_order`
- Le lien vers l'événement sera inclus dans la description en Markdown/HTML (selon le format du RichTextEditor utilisé dans les cartes)
- La colonne cible par défaut sera la première colonne non-système (position la plus basse)

