

## Remise à zéro de l'évaluation de Nadine Rabu

**Constat** : L'évaluation de Nadine Rabu pour la formation "Facilitation intelligence collective" a été soumise le 25/02/2026 (ID: `65080a5a-...`). Son état est "soumis". Il faut la remettre à l'état initial pour qu'elle puisse la remplir normalement via son lien d'évaluation existant (token conservé).

**Action** : Exécuter une migration SQL qui remet tous les champs de réponse à NULL et l'état à `en_attente`, tout en conservant le token et les informations d'identification (participant_id, training_id, email, etc.) intacts.

### Détails techniques

Migration SQL :
```sql
UPDATE public.training_evaluations
SET etat = 'en_attente',
    appreciation_generale = NULL,
    recommandation = NULL,
    message_recommandation = NULL,
    objectifs_evaluation = NULL,
    objectif_prioritaire = NULL,
    delai_application = NULL,
    rythme = NULL,
    equilibre_theorie_pratique = NULL,
    amelioration_suggeree = NULL,
    freins_application = NULL,
    remarques_libres = NULL,
    conditions_info_satisfaisantes = NULL,
    formation_adaptee_public = NULL,
    qualification_intervenant_adequate = NULL,
    appreciations_prises_en_compte = NULL,
    consent_publication = NULL,
    certificate_url = NULL,
    date_soumission = NULL
WHERE id = '65080a5a-d2dc-41b1-8b25-4a2bcfedca6d';
```

Le token `c9d08c8c-...` est conservé : Nadine pourra réutiliser le même lien pour soumettre son évaluation.

