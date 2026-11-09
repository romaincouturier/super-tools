# Modules LMS et transcripts de formation

## Périmètre demandé
- Ajouter la création, la modification et la liste des modules LMS, y compris les modules vides.
- Rattacher les transcripts aux formations et les afficher dans leur fiche.
- Inclure les extensions de sources de veille et la mise à jour des couvertures déjà demandées ; vérifier les outils existants avant tout ajout.
- Ne modifier aucun contenu de leçon, aucune automatisation ni aucun autre parcours.

## Point à débloquer avant les outils MCP
Le serveur existant `mcp-server` utilise une intégration historique et une authentification personnalisée. La procédure de maintenance disponible impose désormais le SDK `defineMcp`, un endpoint `mcp` et une publication. Elle ne fournit pas de voie autorisée pour étendre directement ce serveur historique.

Romain confirme le 09/11 qu’il souhaite ces évolutions. Conserver le serveur historique et les connexions existantes. Préparer les outils demandés sur le format supporté en parallèle seulement après vérification de la compatibilité de l’authentification existante avec OAuth géré ; si cette compatibilité ne peut pas être établie, suspendre cette partie et indiquer le blocage exact. Ne pas basculer les utilisateurs ni retirer le serveur historique sans validation explicite et essai complet. Ne pas migrer l’ensemble des anciens outils pour ce périmètre limité.

## Livrables
### 1. Modules LMS
- `create_lms_module(course_id, title, description?, position?)` : création additive, en fin par défaut ; insertion à une position explicite avec décalage des suivants.
- `update_lms_module(module_id, patch)` : seuls titre, description et position sont autorisés ; réordonnancement limité aux frères du même cours ; retour avant/après.
- `list_lms_modules(course_id)` : identifiant, titre, description, position et nombre de leçons, même pour les modules vides.
- Vérification des droits staff sur le cours et journalisation des écritures. Aucune suppression.
- Réordonnancement transactionnel pour éviter un décalage partiellement enregistré ou une collision en concurrence.

### 2. Transcripts liés aux formations
- Créer `training_transcripts`, avec formation, transcript, date et auteur du rattachement ; unicité du couple formation/transcript, index et droits explicites.
- Réserver la lecture et l’écriture aux personnels autorisés ; ne pas ouvrir les transcripts aux apprenants par cette liaison.
- Étendre la liste partagée des affectations : une liaison formation rend le transcript affecté et participe à la confirmation `allow_multiple`.
- Ajouter la cible `training` à `assign_transcript`, avec création idempotente du lien et attribution au demandeur vérifié.
- Afficher une section « Transcripts » dans la fiche formation : titre, date, durée et lien ciblé vers le transcript.

## Détails techniques
- Réutiliser les règles de sécurité des outils LMS et le modèle de liaison événement, avec les politiques staff actuelles plutôt que les anciennes politiques publiques.
- Étendre `get_transcript_assignments()` sans perdre les cibles existantes, notamment les contacts Réseau.
- Respecter le flux écran → hook → service pour la nouvelle section formation.
- Appliquer les changements de schéma par l’outil de migration et conserver les droits/RLS.

## Vérifications
- Tests : ajout en fin, insertion et déplacement dans les deux sens, isolation des cours, refus d’accès non autorisé, champs interdits.
- Tests : doublon de liaison, confirmation multi-cibles, exclusion des transcripts liés de la liste non affectée, permissions.
- Vérification connectée de la section formation et de son lien vers le transcript ; aucun cours réel ni contenu de leçon modifié pour les essais.

## État
Évolutions demandées ; plan révisé pour préserver les connexions existantes. Aucune modification du serveur, de l’authentification ou du schéma liée à ces extensions effectuée. La publication du nouveau connecteur restera nécessaire après les essais et la génération du manifeste ; une génération seule ne prouve pas sa disponibilité.