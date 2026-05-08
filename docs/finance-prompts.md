# Prompts d'implémentation — Use cases Finance Pennylane

Ces prompts ont été calibrés sur l'archi réelle de SuperTools après audit
(branche `claude/validate-pennylane-usecases-9xys2`). Ils respectent
`IMPROVEMENTS.md` et réutilisent les hooks/composants existants.

**Ordre recommandé** : Étape 0 → UC3 → UC1 → UC2 → UC4.

---

## Étape 0 — Prérequis (à lancer en premier, prompt unique)

```
Contexte : on prépare 4 features Finance dans SuperTools (React/Vite +
Supabase). Avant de les coder, prépare le terrain en respectant
strictement IMPROVEMENTS.md.

TÂCHES :

1. EXTRAIRE LE KPI CARD PARTAGÉ
   - Le composant `KpiCard` est défini inline dans
     `src/pages/Finances.tsx:55-82`. Extraire vers
     `src/components/finance/KpiCard.tsx` (export par défaut).
   - Garder la même API (title, value, hint, icon, tone).
   - Mettre à jour l'import dans Finances.tsx.

2. AJOUTER `expected_close_date` SUR `crm_cards`
   - Créer une migration `supabase/migrations/<timestamp>_add_close_date_to_crm_cards.sql`
   - Colonnes à ajouter (nullable) :
     `expected_close_date DATE`, `closed_at TIMESTAMPTZ`
   - PAS de default. PAS de backfill. RLS inchangée.
   - Mettre à jour `src/types/crm.ts` (ou équivalent) si typage existe.

3. AJOUTER `html2canvas` AUX DEPS
   - `npm install html2canvas` (jsPDF est déjà présent).

4. ÉTENDRE LE PROXY PENNYLANE SI NÉCESSAIRE
   - La whitelist est dans
     `supabase/functions/pennylane-proxy/index.ts:12-22`.
   - Vérifier que `transactions` et `categories` y sont (ils y sont).
   - Si le P&L mensuel a besoin d'un endpoint absent, l'ajouter ici
     (ne pas créer un proxy alternatif).

5. PRÉPARER LE LAYOUT FINANCE EN ONGLETS
   - Refactor `src/pages/Finances.tsx` pour que ses 3 tabs actuels
     (Factures clients / fournisseurs / Trésorerie) deviennent des
     sous-tabs d'un onglet "Comptabilité", et préparer 4 nouveaux
     onglets vides : "Dashboard", "Trésorerie prévisionnelle",
     "Point mort", "Rapport mensuel". Chaque onglet vide rend juste
     `<p className="text-muted-foreground">À venir</p>`.
   - Garder `ModuleLayout` + `PageHeader` (règle #015).
   - Si `Finances.tsx` dépasse 400 lignes après refactor, extraire
     les sous-composants existants (InvoicesTable, etc.) dans
     `src/components/finance/` (règle #014).

CONTRAINTES (à respecter dans tous les commits) :
- Aucune couleur hardcodée : utiliser les vars Tailwind HSL
  (`bg-primary`, `text-emerald-600` ok, `#abc123` interdit).
- Pages < 400 lignes, hooks < 300 lignes.
- Avant chaque commit : `bash scripts/check-rules.sh` doit passer.

Commit séparé par tâche. Push sur la branche actuelle.
```

---

## Use case 3 — BreakEvenSimulator (à lancer en premier)

```
Tu travailles sur SuperTools (React/Vite + Supabase). Tu vas créer
un simulateur de point mort dans `src/components/finance/`.

PRÉREQUIS : étape 0 effectuée.

ARCHITECTURE OBLIGATOIRE (cf. IMPROVEMENTS.md règle #014) :
- Composant UI : `src/components/finance/BreakEvenSimulator.tsx` (< 400 lignes)
- Hooks dédiés : `src/hooks/useBreakEvenScenarios.ts` (< 300 lignes)
- Aucun `supabase.from()` ni `fetch()` dans le .tsx.
- Aucun appel direct à `supabase.functions.invoke` (règle #020).

1. MIGRATION SUPABASE
   `supabase/migrations/<timestamp>_create_breakeven_scenarios.sql`
   - Table `breakeven_scenarios` :
     id UUID PK, user_id UUID REFERENCES auth.users(id),
     name TEXT NOT NULL, fixed_costs NUMERIC(12,2),
     variable_cost_rate NUMERIC(5,4), avg_unit_price NUMERIC(12,2),
     monthly_units NUMERIC, notes TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ
   - RLS : pattern `user_module_access` du projet (cf. autres
     migrations finances) — l'admin email + les users avec module
     `finances` voient leurs propres lignes.
   - Trigger updated_at standard.

2. MAPPING CATÉGORIES PENNYLANE → FIXE/VARIABLE
   Créer `src/lib/pennylaneCategoryMap.ts` exportant :
   - `FIXED_COST_KEYWORDS` (loyer, abonnement, salaire, assurance,
     téléphonie, électricité, internet, comptable)
   - `isFixedCost(label: string): boolean` (matching insensible à la casse)
   - Tester avec quelques labels Pennylane réels si exposés via
     l'endpoint `categories`.

3. HOOK `useBreakEvenScenarios.ts`
   - `useBreakEvenScenarios()` : liste des scénarios de l'user (React Query).
   - `useSaveBreakEvenScenario()` : mutation (insert ou update).
   - `useDeleteBreakEvenScenario()` : mutation.
   - `useDetectedFixedCosts()` : agrège les factures fournisseurs
     des 6 derniers mois via `useSupplierInvoices` (déjà existant
     dans `src/hooks/usePennylane.ts`), filtre via `isFixedCost`,
     retourne le total mensuel moyen + détail par fournisseur.

4. COMPOSANT `BreakEvenSimulator.tsx`
   - 4 sliders shadcn (Slider) : charges fixes mensuelles / taux de
     charges variables (0-100%) / prix moyen prestation / nb prestations/mois.
   - Initialiser les charges fixes via `useDetectedFixedCosts`
     (afficher Badge "auto-détecté" vs "manuel").
   - Recharts : LineChart avec 2 séries (CA = prix × volume,
     Charges totales = fixes + variables × CA). Marquer le point
     d'intersection avec un ReferenceDot.
   - Encart résultat : Point mort en € et en jours sur l'année
     (formule : `fixed / (1 - varRate)` puis `pointMortEUR / CA_annuel * 365`).
   - Bouton "Sauvegarder ce scénario" → ouvre Dialog avec un Input
     name + Textarea notes → appelle `useSaveBreakEvenScenario`.
   - Liste des scénarios sauvegardés (max 2 sélectionnables pour
     comparaison côte à côte).

5. INTÉGRATION
   - Insérer dans le tab "Point mort" préparé en étape 0.

6. RÈGLES À RESPECTER
   - Spinner via `<Spinner />` (règle #017), jamais `<Loader2 animate-spin>`.
   - Toasts d'erreur via `toastError(toast, ...)` (règle #019).
   - Suppression de scénario via `useConfirm()` (règle #021).
   - Pas de `confirm()` natif, pas de `window.alert`.

7. VÉRIFICATION FINALE
   `bash scripts/check-rules.sh` puis commit + push.
```

---

## Use case 1 — FinancialDashboard (après UC3)

```
Tu travailles sur SuperTools. Tu vas créer un dashboard financier
synthétique dans le tab "Dashboard" préparé à l'étape 0.

PÉRIMÈTRE RÉDUIT après revue archi :
- PAS de table `pennylane_sync` (React Query suffit comme cache).
- PAS de prop `pdfData` (aucune infra extraction PDF côté projet).
- Réutiliser `useCustomerInvoices` et `useSupplierInvoices`
  existants (`src/hooks/usePennylane.ts`).

ARCHITECTURE :
- Composant : `src/components/finance/FinancialDashboard.tsx` (< 400 lignes)
- Hook : `src/hooks/useFinancialKPIs.ts` (calcule les KPIs depuis
  les factures Pennylane, < 300 lignes)
- Réutiliser le `KpiCard` extrait à l'étape 0 (`src/components/finance/KpiCard.tsx`).

1. HOOK `useFinancialKPIs.ts`
   Signature : `useFinancialKPIs(period: { from: string; to: string })`
   - Consomme `useCustomerInvoices({ limit: 500 })` et
     `useSupplierInvoices({ limit: 500 })`.
   - Calcule : CA encaissé (status=paid, date∈période),
     CA en attente, CA en retard, dépenses, résultat net (CA - dépenses),
     marge brute (CA - dépenses variables / CA).
   - Calcule la série mensuelle 12 mois pour LineChart
     (agrégation par mois).
   - Calcule la répartition charges fixes/variables via
     `isFixedCost` (créé en UC3).
   - Compare période courante vs période précédente, retourne
     l'évolution en % par KPI.
   - Utilise `todayAsISO()` et helpers de `src/lib/dateFormatters.ts`
     (règle #023).

2. COMPOSANT `FinancialDashboard.tsx`
   - Sélecteur de période shadcn Select : "12 derniers mois" /
     "Année en cours" / "Année précédente" / "Personnalisé" (avec
     DateRangePicker si custom).
   - 4 KpiCard en haut : CA réalisé, Résultat net, Taux de marge,
     Trésorerie. Chacune affiche la flèche ↑↓ et le % vs période
     précédente.
   - Recharts LineChart pour évolution mensuelle 12 mois (CA + Charges).
   - Recharts PieChart (donut) pour répartition charges fixes/variables.
   - États : skeleton pendant load (réutiliser le pattern Loader
     déjà présent dans `Finances.tsx:17-23`).
   - Si pas de token Pennylane : Alert avec lien vers
     `/parametres` (cf. pattern existant `Finances.tsx:181-189`).

3. RÈGLES
   - Spinner `<Spinner />`, toastError, formatters EUR via
     `Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })`
     (déjà utilisé dans Finances.tsx — extraire dans
     `src/lib/financeFormatters.ts` si dupliqué dans 2+ fichiers, règle #003).
   - Couleurs via vars Tailwind (text-emerald-600 / text-rose-600 ok).

4. VÉRIFICATION
   `bash scripts/check-rules.sh` + commit + push.
```

---

## Use case 2 — CashFlowBudget (après UC1)

```
Tu travailles sur SuperTools. Tu vas créer le budget de trésorerie
prévisionnel dans le tab "Trésorerie prévisionnelle" préparé en étape 0.

PRÉREQUIS validés à l'étape 0 :
- `crm_cards.expected_close_date` existe.
- Le tab existe.

⚠️ POINT IMPORTANT :
- La table CRM s'appelle `crm_cards`, PAS `deals` ni `opportunities`.
- Le champ montant est `estimated_value`, le statut `sales_status`
  (OPEN/WON/LOST/CANCELED). Voir `supabase/migrations/20260204100000_create_crm_module.sql:28-47`.
- Le pipeline prévisionnel = `crm_cards` où
  `sales_status = 'OPEN' AND expected_close_date >= today`.

ARCHITECTURE :
- Composant : `src/components/finance/CashFlowBudget.tsx` (< 400 lignes)
- Hooks :
  - `src/hooks/useCashFlowForecast.ts` (CRUD table cashflow_forecast)
  - `src/hooks/useCashFlowAggregator.ts` (assemble Pennylane + CRM + forecast
    en table mensuelle)
  - `src/hooks/useRecurringExpenseDetection.ts` (détection auto)

1. MIGRATION SUPABASE
   `supabase/migrations/<timestamp>_create_cashflow_forecast.sql`
   - Table `cashflow_forecast` :
     id UUID PK, user_id UUID, month DATE (1er du mois),
     category TEXT, amount NUMERIC(12,2),
     type TEXT CHECK (type IN ('income','expense')),
     is_recurring BOOLEAN DEFAULT FALSE,
     source TEXT CHECK (source IN ('manual','crm_deal','recurring_detected')),
     source_ref UUID NULL (pour lier à un crm_card.id si applicable),
     notes TEXT, created_at, updated_at.
   - Index sur (user_id, month).
   - RLS pattern user_module_access + admin email (cf. autres tables finance).
   - Trigger updated_at.

2. HOOK `useRecurringExpenseDetection.ts`
   - Consomme `useSupplierInvoices` (12 mois).
   - Groupe par fournisseur, détecte les fournisseurs avec ≥ 3
     factures dont le montant varie de moins de 10%.
   - Retourne `{ supplierId, avgAmount, lastDate, occurrences }[]`.
   - Pas d'écriture en base ici — juste détection.

3. HOOK `useCashFlowAggregator.ts`
   - Pour chaque mois (12 mois glissants) :
     - Réalisé = somme des factures clients/fournisseurs Pennylane
       de ce mois (via `useCustomerInvoices` + `useSupplierInvoices`).
     - Prévu = `cashflow_forecast` du mois + `crm_cards` OPEN avec
       `expected_close_date` dans ce mois (× `estimated_value`,
       pondéré 100%, pas de pondération par étape pour ne pas
       sur-engineerer).
     - Écart = Réalisé - Prévu.
   - Solde cumulé : initialise au solde Pennylane
     (`useBankAccounts`) puis cumule mois par mois.

4. COMPOSANT `CashFlowBudget.tsx`
   - Tableau 12 mois (lignes = mois, colonnes = Prévu / Réalisé / Écart / Solde cumulé).
   - Alert visuel sur les mois où solde cumulé prévu < seuil
     configurable (slider, par défaut 5000€, sauvegardé en localStorage
     simple — pas la peine d'une table).
   - Bouton "+ Ligne prévisionnelle" → Dialog : month picker,
     category Select (libre), amount Input, type Radio (income/expense),
     is_recurring Switch → appelle `useCashFlowForecast.create`.
   - Bouton "Importer pipeline CRM" → liste les `crm_cards` OPEN
     avec expected_close_date, checkbox multi → crée des
     `cashflow_forecast` avec source='crm_deal' et source_ref=card.id.
   - Bouton "Détecter charges récurrentes" → consomme
     `useRecurringExpenseDetection`, propose la liste, checkbox
     multi → crée des `cashflow_forecast` source='recurring_detected'.
   - Édition inline cellule Prévu : double-clic → input → save
     via `useEntityAutoSave` (règle #024) si possible, sinon
     `useAutoSaveForm` (règle #001).
   - Export CSV : générer côté client à partir du tableau,
     download via `URL.createObjectURL(blob)`.

5. RÈGLES
   - Pas de `supabase.from()` dans le .tsx.
   - Spinner, toastError, useConfirm pour toute suppression de ligne.
   - Format date via `dateAsISO` / `todayAsISO` (règle #023).

6. VÉRIFICATION
   `bash scripts/check-rules.sh` + commit + push.
```

---

## Use case 4 — MonthlyReport (à lancer en dernier)

```
Tu travailles sur SuperTools. Tu vas créer le rapport de pilotage
mensuel dans le tab "Rapport mensuel" préparé à l'étape 0.

DÉCISION ARCHI : génération **on-demand** (pas de cron mensuel pour
l'instant). Le rapport est calculé au clic et persisté pour qu'on
puisse y revenir. Une scheduled function pourra être ajoutée plus
tard sans casser cette base.

ARCHITECTURE :
- Composant : `src/components/finance/MonthlyReport.tsx` (< 400 lignes)
- Hooks :
  - `src/hooks/useMonthlyReport.ts` : lecture/génération via Edge Function
- Edge Function : `supabase/functions/generate-monthly-report/index.ts`
- Service : tout le calcul vit dans l'Edge Function (pas de
  `reportGenerator.ts` côté client comme initialement proposé —
  ça maintient l'archi #014).

1. MIGRATION
   `supabase/migrations/<timestamp>_create_monthly_reports.sql`
   - Table `monthly_reports` :
     id UUID PK, user_id UUID, month DATE (1er du mois, UNIQUE par user),
     payload JSONB NOT NULL (snapshot complet),
     generated_at TIMESTAMPTZ DEFAULT NOW().
   - RLS pattern user_module_access.
   - INDEX UNIQUE (user_id, month).

2. EDGE FUNCTION `generate-monthly-report`
   - Auth : exige Bearer JWT (cf. pattern de `pennylane-proxy/index.ts:36-51`).
   - Body : `{ month: "YYYY-MM" }`.
   - Appelle l'API Pennylane via le token de `app_settings`
     (réutiliser le pattern de récupération du token de
     pennylane-proxy/index.ts:71-84).
   - Récupère :
     - factures clients/fournisseurs du mois,
     - factures clients/fournisseurs du mois précédent (pour M-1),
     - `crm_cards` du user : closed_at dans le mois (gagnés) +
       OPEN avec expected_close_date dans M+1 (pipeline).
   - Calcule : CA, résultat net, taux de marge, nb clients actifs
     (distinct customer_id sur factures du mois), panier moyen,
     évolution vs M-1, prévision M+1 (somme estimated_value pipeline).
   - Génère 3 faits marquants auto (règles simples :
     "+X% de marge", "N nouveaux clients", "Y deals fermés").
   - Upsert dans `monthly_reports` avec ON CONFLICT (user_id, month).
   - Retourne le payload.
   - PAS de PDF côté serveur — l'export PDF se fait côté client.

3. HOOK `useMonthlyReport.ts`
   - `useMonthlyReport(month)` : SELECT monthly_reports si existe.
   - `useGenerateMonthlyReport()` : invoque la fonction via
     `useEdgeFunction("generate-monthly-report", ...)` (règle #020).
   - Invalide la query après génération.

4. COMPOSANT `MonthlyReport.tsx`
   - Sélecteur de mois (month picker — utiliser shadcn Calendar
     en mode month si dispo, sinon Select 12 derniers mois).
   - Si pas de rapport pour ce mois : bouton "Générer le rapport".
   - Si rapport existe : affichage en sections :
     - "Résumé dirigeant" : 5 KpiCard avec sparkline recharts.
     - "Ce mois" : 3 faits marquants en bullet.
     - "Mois prochain" : pipeline CRM converti en CA prévisionnel.
   - Bouton "Régénérer" (utilise `useConfirm` pour l'écrasement, règle #021).
   - Bouton "Exporter en PDF" :
     - Utilise html2canvas (ajouté à l'étape 0) sur la div racine
       du rapport,
     - jsPDF pour assembler le canvas en PDF A4,
     - Nom fichier : `rapport-pilotage-YYYY-MM.pdf`.
     - Style : header avec nom de la company depuis
       `usePennylaneMe()`, pas de logo hardcodé (chercher s'il y a
       un logo dans `public/` ou `src/assets/`).

5. PAS DE NOTIFICATION POUR L'INSTANT
   La table `content_notifications` actuelle est typée pour le
   module content. Étendre l'enum pour les rapports introduirait
   un couplage prématuré. À ajouter quand le cron mensuel sera
   décidé (use case suivant).

6. RÈGLES
   - Spinner, toastError, useEdgeFunction, useConfirm.
   - Pas de `supabase.from()` ni `supabase.functions.invoke` direct
     dans le .tsx.
   - Composant < 400 lignes — si le PDF generator + le render
     dépassent, extraire `MonthlyReportPDFExporter.tsx` à part.

7. VÉRIFICATION
   `bash scripts/check-rules.sh` + commit + push.
```
