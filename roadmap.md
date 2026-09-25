# Roadmap

## Terminé (18/09)
- [x] Mot de passe obligatoire à la première ouverture du lien apprenant
  - [x] Écran de création de mot de passe centré, conforme à la charte
  - [x] Suppression de la sortie « Plus tard » dans `ConnexionLien.tsx`
  - [x] Garde-fou pour les sessions déjà ouvertes sans mot de passe (`/connexion/definir-mot-de-passe`)
  - [x] Réécriture des modèles d'email `elearning_magic_link_tu/vous`
  - [x] Renvoi du mail corrigé à Colette Nico
- [x] Nom affiché dans le cours en ligne : plus jamais « Administrateur » pour un apprenant connecté
- [x] Nom et prénom repris de l'inscription dans les informations personnelles (+ reprise automatique à chaque inscription)
- [x] Lien « Créer un compte gratuitement » : écran de création de compte avec choix de la formation gratuite

- [ ] Retry/backoff sur le refresh Google (internal_failure) + échec géré proprement
- [ ] Bandeau réassort ECHO : bloqué, mail envoyé par AutomateWoo (boutique), accès admin requis
