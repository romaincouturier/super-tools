# Formation gratuite

Ajouter un interrupteur "Formation gratuite" sur une session de formation. Décoché par défaut partout : aucun changement de comportement existant.

## Comportement quand la formation est gratuite

- **Listing des formations** : badge 🎁 "Gratuite" sur la carte / la ligne de la session.
- **Fiche formation** : le champ "Prix vendu HT" de la session est masqué, ainsi que les champs BPF de la session (type de stagiaire, source de financement).
- **Participants** : la colonne "Montant HT" disparaît du tableau et de la carte mobile ; les champs "montant vendu", "type de stagiaire (BPF)" et "source de financement (BPF)" ne sont plus demandés ni signalés comme manquants (plus d'alerte orange).
- **Bilan pédagogique et financier** : la session et ses participants sont totalement exclus (effectifs, heures, produits).
- **Facturation** : plus aucune alerte ni action quotidienne de facturation / relance de paiement pour cette session.
- **Devis et convention** : pas de proposition de devis ni de convention de formation payante, et les envois automatiques d'email de convocation et d'email de convention sont supprimés pour cette session.

## Détails techniques

1. **Base** : nouvelle colonne `trainings.is_free boolean not null default false`.
2. **Formulaire d'édition** (`src/pages/FormationEdit.tsx`, `FormationFormFields.tsx`) : `Switch` "Formation gratuite" ; quand actif, masquage conditionnel de `sold_price_ht`, `type_stagiaire_bpf`, `source_financement_bpf` et remise à `null` de ces trois valeurs à l'enregistrement.
3. **Listing** (`src/pages/Formations.tsx`) : ajout de `is_free` au select et badge 🎁 à côté des badges existants (vue desktop et mobile).
4. **Participants** (`src/components/formations/FormationDetailParticipants.tsx`, `ParticipantList.tsx`, `participants/ParticipantTable.tsx`, `ParticipantMobileCard.tsx`, `types.ts`) : nouvelle prop `isFreeTraining` qui supprime la colonne Montant HT (et le tri associé) et neutralise les indicateurs de champs BPF manquants. Idem dans `EditParticipantDialog` / `AddParticipantDialog` pour masquer les champs devenus inutiles.
5. **BPF** (`src/pages/BPFReport.tsx`) : `toTrainingRow` renvoie `null` lorsque `is_free === true`, ce qui exclut mécaniquement la session, ses participants et ses heures de tous les blocs du rapport.
6. **Facturation / relances** (`supabase/functions/generate-daily-actions`, `check-daily-actions-completion`) : filtre `is_free = false` sur les requêtes de génération d'alertes de facturation.
7. **Convocation & convention** : filtre `is_free` dans `supabase/functions/_shared/reconcile-welcomes.ts`, `send-welcome-email`, `process-scheduled-emails` (types convocation et convention) et `check-convention-status`, plus masquage des boutons devis/convention côté fiche formation.
8. Redéploiement des fonctions modifiées.
