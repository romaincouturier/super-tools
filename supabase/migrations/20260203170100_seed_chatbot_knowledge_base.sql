-- Seed initial knowledge base entries for the chatbot

-- =====================================================
-- FONCTIONNALITÉS
-- =====================================================

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('fonctionnalite', 'Créer une nouvelle formation',
'Pour créer une nouvelle formation:
1. Allez dans le menu "Formations"
2. Cliquez sur le bouton "Nouvelle formation"
3. Remplissez les informations obligatoires:
   - Nom de la formation
   - Client
   - Dates de début et fin
   - Lieu
   - Format (intra-entreprise, inter-entreprises, ou e-learning)
4. Ajoutez les informations du commanditaire (sponsor)
5. Configurez les horaires dans l''onglet "Horaires"
6. Enregistrez la formation

Le format de la formation détermine le workflow d''emails et de documents.',
ARRAY['formation', 'créer', 'nouvelle', 'ajouter'], 100);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('fonctionnalite', 'Ajouter des participants à une formation',
'Pour ajouter des participants:
1. Ouvrez la fiche de la formation
2. Allez dans l''onglet "Participants"
3. Cliquez sur "Ajouter un participant"
4. Remplissez les informations:
   - Email (obligatoire)
   - Prénom et nom
   - Société
   - Poste
   - Pour les formations inter-entreprises: informations du sponsor individuel
5. Vous pouvez aussi importer plusieurs participants en une fois via "Import en masse"

Chaque participant recevra automatiquement les emails de convocation et de recueil des besoins.',
ARRAY['participant', 'ajouter', 'inscription', 'stagiaire'], 95);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('fonctionnalite', 'Générer les certificats de réalisation',
'Les certificats de réalisation sont générés automatiquement à la fin de la formation:
1. Allez dans le menu "Certificats"
2. Sélectionnez la formation
3. Les certificats sont générés pour chaque participant ayant émargé
4. Vous pouvez envoyer les certificats par email individuellement ou en masse
5. Le commanditaire peut également recevoir une copie

Les certificats incluent:
- Nom et prénom du participant
- Intitulé de la formation
- Dates de formation
- Durée totale
- Attestation de présence basée sur l''émargement',
ARRAY['certificat', 'attestation', 'réalisation', 'diplôme', 'fin'], 90);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('fonctionnalite', 'Créer un micro-devis',
'Le micro-devis permet de créer rapidement un devis simplifié:
1. Allez dans le menu "Micro-devis"
2. Sélectionnez le client ou créez-en un nouveau
3. Choisissez la formation dans le catalogue
4. Configurez:
   - Nombre de participants
   - Nombre de jours
   - Prix unitaire
   - Frais annexes éventuels
5. Générez le PDF du devis
6. Envoyez-le pour signature électronique si souhaité

Le devis inclut automatiquement les CGV et peut être signé électroniquement.',
ARRAY['devis', 'micro', 'proposition', 'commercial', 'prix'], 85);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('fonctionnalite', 'Émargement électronique',
'L''émargement électronique remplace la feuille de présence papier:
1. Chaque participant reçoit un lien unique d''émargement
2. Le participant signe sur son appareil (téléphone, tablette, PC)
3. La signature est horodatée et sécurisée
4. Les signatures sont regroupées dans la feuille d''émargement PDF

Pour configurer l''émargement:
- Les horaires doivent être définis dans la formation
- L''émargement se fait par demi-journée
- Le formateur peut envoyer les demandes d''émargement depuis la fiche formation

La feuille d''émargement générée est conforme aux exigences Qualiopi.',
ARRAY['émargement', 'signature', 'présence', 'feuille', 'signer'], 90);

-- =====================================================
-- WORKFLOWS EMAIL
-- =====================================================

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('workflow', 'Workflow des emails de formation',
'Le workflow d''emails d''une formation suit ces étapes:

1. **Convocation** (J-X avant formation)
   - Email d''accueil avec informations pratiques
   - Lien vers la page récapitulative de la formation

2. **Recueil des besoins** (J-X avant formation)
   - Questionnaire personnalisé pour adapter la formation
   - Rappels automatiques si non complété

3. **Fin de formation**
   - Email de remerciement avec lien d''évaluation
   - Lien vers les supports de formation

4. **Post-formation** (automatique)
   - J+2: Rappel évaluation si non complétée
   - J+3: Demande de témoignage vidéo
   - J+5: Second rappel évaluation
   - J+10: Évaluation à froid pour le commanditaire

Les délais sont configurables dans les paramètres.',
ARRAY['email', 'workflow', 'automatique', 'séquence', 'envoi'], 95);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('email', 'Email de convocation',
'L''email de convocation est envoyé aux participants pour confirmer leur inscription:

Contenu:
- Confirmation de l''inscription
- Dates et horaires de la formation
- Lieu (adresse ou lien visio pour e-learning)
- Informations pratiques
- Lien vers la page récapitulative

Pour envoyer les convocations:
1. Ouvrez la formation
2. Allez dans l''onglet Participants
3. Cliquez sur "Envoyer convocation" pour chaque participant ou "Envoyer toutes les convocations"

Note: Cet email constitue la convocation officielle à la formation.',
ARRAY['convocation', 'email', 'invitation', 'inscription'], 85);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('email', 'Recueil des besoins',
'Le questionnaire de recueil des besoins permet d''adapter la formation:

Contenu du questionnaire:
- Niveau actuel sur le sujet
- Attentes principales
- Situations concrètes à traiter
- Questions spécifiques

Workflow:
1. Email envoyé automatiquement après la convocation
2. Le participant remplit le questionnaire en ligne
3. Les réponses sont visibles dans "Besoins" sur le dashboard
4. Rappels automatiques si non complété

Le formateur peut valider les besoins une fois analysés.',
ARRAY['besoins', 'questionnaire', 'attentes', 'recueil'], 85);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('email', 'Email de remerciement et évaluation',
'L''email de remerciement est envoyé à la fin de la formation:

Contenu:
- Remerciement pour la participation
- Lien vers le questionnaire d''évaluation à chaud
- Lien vers les supports de formation (si configuré)

L''évaluation à chaud comprend:
- Note globale sur la formation
- Évaluation du formateur
- Évaluation du contenu
- Évaluation de l''organisation
- Commentaires libres
- Recommandation NPS

Les résultats sont compilés dans le tableau de bord des évaluations.',
ARRAY['remerciement', 'évaluation', 'chaud', 'feedback', 'fin'], 85);

-- =====================================================
-- RÈGLES MÉTIER
-- =====================================================

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('regle_metier', 'Formats de formation',
'Il existe 3 formats de formation:

1. **Intra-entreprise**
   - Formation dédiée à une seule entreprise
   - Un commanditaire unique pour tous les participants
   - Convention de formation unique
   - Facturation à l''entreprise cliente

2. **Inter-entreprises**
   - Participants de différentes entreprises
   - Chaque participant peut avoir son propre commanditaire/sponsor
   - Convention individuelle par participant
   - Possibilité de financement OPCO par participant

3. **E-learning**
   - Formation 100% en ligne
   - Accès à une plateforme de formation
   - Pas de lieu physique
   - Certificat d''assiduité au lieu de feuille d''émargement',
ARRAY['format', 'intra', 'inter', 'elearning', 'type'], 100);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('regle_metier', 'Commanditaire vs Participant',
'Il est important de distinguer:

**Commanditaire (Sponsor)**
- Personne qui commande/finance la formation
- Peut être le responsable RH, le manager, etc.
- Reçoit les documents administratifs (convention, facture)
- Reçoit l''évaluation à froid après la formation

**Participant (Stagiaire)**
- Personne qui suit réellement la formation
- Reçoit les emails de convocation et d''évaluation
- Signe l''émargement
- Reçoit le certificat de réalisation

En **intra-entreprise**: un commanditaire pour tous les participants
En **inter-entreprises**: possibilité d''un commanditaire différent par participant',
ARRAY['commanditaire', 'sponsor', 'participant', 'stagiaire', 'différence'], 95);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('regle_metier', 'Financeur OPCO',
'Le financeur peut être différent du commanditaire:

**Cas classique**: L''entreprise finance directement
- Financeur = Commanditaire

**Cas OPCO**: Un OPCO finance la formation
- Financeur = OPCO (Akto, Atlas, Opco EP, etc.)
- Un email de rappel est envoyé au formateur pour préparer les documents OPCO

Configuration:
1. Dans la formation, cochez "Financeur différent du commanditaire"
2. Renseignez les informations du financeur (OPCO)
3. Un rappel sera programmé après la formation

Documents OPCO habituels:
- Convention de formation
- Programme
- Feuille d''émargement
- Certificat de réalisation
- Facture',
ARRAY['opco', 'financeur', 'financement', 'akto', 'atlas'], 90);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('regle_metier', 'Tutoiement vs Vouvoiement',
'Les emails peuvent utiliser le tutoiement ou le vouvoiement:

**Configuration par formation**
- Dans les paramètres de la formation
- Option "Tutoyer les participants"

**Impact sur les emails**
- Les templates d''emails sont adaptés automatiquement
- Deux versions existent pour chaque email type

**Recommandations**
- Tutoiement: formations créatives, startups, participants jeunes
- Vouvoiement: formations corporate, secteur public, contexte formel

Le paramètre s''applique à tous les participants de la formation.',
ARRAY['tutoiement', 'vouvoiement', 'politesse', 'formel', 'informel'], 80);

-- =====================================================
-- QUALIOPI
-- =====================================================

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('qualiopi', 'Exigences Qualiopi - Vue d''ensemble',
'Qualiopi est la certification qualité des organismes de formation.

**Indicateurs clés gérés par le logiciel:**

- **Indicateur 4**: Analyse des besoins (questionnaire de recueil des besoins)
- **Indicateur 11**: Suivi des présences (émargement électronique)
- **Indicateur 19**: Évaluations (évaluation à chaud et à froid)
- **Indicateur 30**: Traitement des réclamations (améliorations)
- **Indicateur 32**: Amélioration continue (axes d''amélioration)

**Documents générés:**
- Convention de formation
- Programme de formation
- Feuille d''émargement
- Certificat de réalisation
- Bilan des évaluations',
ARRAY['qualiopi', 'certification', 'qualité', 'indicateur', 'audit'], 100);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('qualiopi', 'Traçabilité des évaluations',
'Le logiciel assure la traçabilité complète des évaluations:

**Évaluation à chaud** (fin de formation)
- Collectée via questionnaire en ligne
- Horodatée et archivée
- Statistiques par formation et global

**Évaluation à froid** (J+10)
- Envoyée au commanditaire
- Mesure l''impact de la formation
- Suivi des compétences acquises

**Tableau de bord**
- Taux de satisfaction global
- Évolution dans le temps
- Identification des points d''amélioration

Ces éléments sont essentiels pour l''indicateur 19 de Qualiopi.',
ARRAY['évaluation', 'traçabilité', 'qualiopi', 'indicateur', 'satisfaction'], 90);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('qualiopi', 'Suivi des améliorations',
'Le module Améliorations permet de suivre l''amélioration continue:

**Sources d''amélioration:**
- Commentaires négatifs des évaluations
- Réclamations
- Observations du formateur
- Audits internes

**Workflow:**
1. Identification d''un axe d''amélioration
2. Création d''une fiche amélioration
3. Plan d''action avec échéance
4. Suivi de la mise en œuvre
5. Évaluation de l''efficacité

**Statuts:**
- À traiter
- En cours
- Résolu
- Clos

Ce suivi répond aux indicateurs 30 et 32 de Qualiopi.',
ARRAY['amélioration', 'qualiopi', 'réclamation', 'continue', 'suivi'], 90);

-- =====================================================
-- DOCUMENTS
-- =====================================================

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('documents', 'Convention de formation',
'La convention de formation est générée automatiquement:

**Contenu:**
- Intitulé et objectifs de la formation
- Programme détaillé
- Dates et durée
- Lieu
- Informations du commanditaire
- Conditions financières
- CGV

**Génération:**
1. Ouvrez la formation
2. Cliquez sur "Générer convention"
3. Le PDF est créé via PDFMonkey
4. Possibilité d''envoi pour signature électronique

**Pour les inter-entreprises:**
Une convention est générée par participant (avec son sponsor respectif).',
ARRAY['convention', 'document', 'contrat', 'pdf', 'signature'], 90);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('documents', 'Feuille d''émargement',
'La feuille d''émargement atteste de la présence:

**Format:**
- Une ligne par participant
- Une colonne par demi-journée
- Signature électronique horodatée

**Génération:**
1. Les participants signent via leur lien d''émargement
2. Allez dans Documents > Émargement
3. Générez le PDF récapitulatif

**Conformité:**
- Horodatage de chaque signature
- Empreinte numérique unique
- Conservation des données pendant 5 ans minimum

Ce document est obligatoire pour la certification Qualiopi.',
ARRAY['émargement', 'présence', 'feuille', 'signature', 'pdf'], 90);

-- =====================================================
-- FAQ
-- =====================================================

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('faq', 'Un participant n''a pas reçu son email',
'Si un participant n''a pas reçu un email:

**Vérifications:**
1. Vérifiez l''adresse email dans la fiche participant
2. Demandez au participant de vérifier ses spams
3. Consultez l''historique des emails dans la formation

**Solutions:**
- Renvoyer l''email depuis la fiche participant
- Modifier l''adresse email si incorrecte
- Vérifier que l''email n''est pas bloqué par un antispam

**Historique:**
Tous les emails envoyés sont tracés dans le menu "Historique".',
ARRAY['email', 'reçu', 'spam', 'problème', 'envoi'], 85);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('faq', 'Comment modifier une formation déjà commencée',
'Pour modifier une formation en cours:

**Modifications possibles:**
- Horaires des journées à venir
- Ajout de participants
- Informations logistiques

**Modifications déconseillées:**
- Dates de la formation (impacte les documents)
- Suppression de participants ayant déjà émargé

**Procédure:**
1. Ouvrez la formation
2. Cliquez sur "Modifier"
3. Effectuez vos changements
4. Enregistrez

Note: Les emails déjà envoyés ne sont pas mis à jour automatiquement.',
ARRAY['modifier', 'changer', 'cours', 'commencée', 'éditer'], 80);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('faq', 'Annuler une formation',
'Pour annuler une formation:

**Avant la formation:**
1. Prévenez les participants par email
2. Changez le statut en "Annulée"
3. Les emails automatiques seront désactivés

**Si des participants ont déjà été convoqués:**
- Utilisez le bouton "Annuler et notifier" pour envoyer un email d''annulation

**Impact:**
- La formation reste dans l''historique
- Les statistiques l''excluent des indicateurs
- Les documents restent accessibles

Note: Les formations annulées ne comptent pas dans les métriques Qualiopi.',
ARRAY['annuler', 'supprimer', 'formation', 'annulation'], 80);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('faq', 'Exporter les données',
'Plusieurs exports sont disponibles:

**Export formations:**
- Liste des formations avec participants
- Format CSV ou Excel

**Export évaluations:**
- Résultats détaillés
- Statistiques par période

**Export participants:**
- Liste avec coordonnées
- Historique de participation

**Sauvegarde complète:**
- Menu Paramètres > Sauvegarde
- Export de toutes les données
- Format JSON

Les exports sont conformes RGPD et n''incluent que les données nécessaires.',
ARRAY['export', 'données', 'csv', 'excel', 'télécharger'], 75);

INSERT INTO chatbot_knowledge_base (category, title, content, keywords, priority) VALUES
('faq', 'Accès et permissions utilisateurs',
'Le logiciel gère plusieurs niveaux d''accès:

**Rôles:**
- **Admin**: Accès complet, gestion des utilisateurs
- **Formateur**: Accès aux formations assignées
- **Collaborateur**: Accès en lecture seule

**Configuration:**
1. Menu Paramètres > Utilisateurs
2. Invitez un nouvel utilisateur par email
3. Définissez son rôle
4. L''utilisateur reçoit un email d''activation

**Modules par rôle:**
Les accès aux modules (formations, évaluations, etc.) sont configurables par utilisateur.',
ARRAY['accès', 'utilisateur', 'permission', 'rôle', 'admin'], 85);
