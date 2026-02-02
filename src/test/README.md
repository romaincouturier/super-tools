# Stratégie de Tests - SuperTools

## Vue d'ensemble

Ce projet utilise **Vitest** comme framework de test avec **React Testing Library** pour les tests de composants.

## Configuration

```bash
# Installer les dépendances de test
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8

# Lancer les tests
npm run test

# Lancer les tests avec couverture
npm run test:coverage

# Lancer les tests en mode watch
npm run test:watch
```

## Structure des Tests

```
src/
├── test/
│   ├── setup.ts          # Configuration globale des tests
│   ├── fixtures.ts       # Données de test réutilisables
│   ├── helpers.ts        # Fonctions utilitaires pour les tests
│   ├── README.md         # Cette documentation
│   └── e2e/
│       └── user-journey.test.ts  # Test E2E du parcours complet
├── lib/
│   ├── utils.ts
│   ├── utils.test.ts
│   ├── passwordValidation.ts
│   ├── passwordValidation.test.ts
│   ├── pdfGenerator.ts
│   └── pdfGenerator.test.ts
├── components/
│   └── Component.test.tsx
└── hooks/
    └── useHook.test.ts
```

## Types de Tests

### 1. Tests Unitaires (lib/, utils)

Tests des fonctions pures et utilitaires.

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "./myFunction";

describe("myFunction", () => {
  it("should do something", () => {
    expect(myFunction(input)).toBe(expectedOutput);
  });
});
```

### 2. Tests de Composants (components/)

Tests des composants React avec React Testing Library.

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestWrapper } from "@/test/helpers";
import MyComponent from "./MyComponent";

describe("MyComponent", () => {
  it("should render correctly", () => {
    render(<MyComponent />, { wrapper: createTestWrapper() });
    expect(screen.getByText("Expected Text")).toBeInTheDocument();
  });

  it("should handle user interaction", async () => {
    const user = userEvent.setup();
    render(<MyComponent />, { wrapper: createTestWrapper() });
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Result")).toBeInTheDocument();
  });
});
```

### 3. Tests de Hooks (hooks/)

Tests des hooks personnalisés avec renderHook.

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { createTestWrapper } from "@/test/helpers";
import { useMyHook } from "./useMyHook";

describe("useMyHook", () => {
  it("should return initial state", () => {
    const { result } = renderHook(() => useMyHook(), {
      wrapper: createTestWrapper(),
    });
    expect(result.current.value).toBe(initialValue);
  });
});
```

### 4. Tests E2E (e2e/)

Tests de flux complets simulant le parcours utilisateur.

```typescript
import { describe, it, expect, vi } from "vitest";
import { mockUser, mockOrganization } from "../fixtures";

describe("User Journey", () => {
  it("should complete onboarding to BPF flow", async () => {
    // Test complet du parcours
  });
});
```

## Fixtures et Données de Test

Les fixtures sont définies dans `src/test/fixtures.ts` :

| Fixture | Description |
|---------|-------------|
| `mockUser` | Utilisateur authentifié |
| `mockOrganization` | Organisation de test |
| `mockUserProfile` | Profil utilisateur avec rôle |
| `mockSubscription` | Abonnement (plan gratuit) |
| `mockTrainer` | Formateur par défaut |
| `mockTraining` | Formation complète |
| `mockTrainingSchedules` | Plannings de formation |
| `mockParticipants` | Participants (2) |
| `mockEvaluations` | Évaluations soumises |
| `mockAttendanceSignatures` | Signatures émargement |
| `mockUsageTracking` | Suivi consommation |
| `mockBpfData` | Données BPF complètes |
| `mockEmailTemplates` | Templates emails |
| `mockIntegrations` | Intégrations externes |

## Helpers

Les fonctions utilitaires sont dans `src/test/helpers.ts` :

| Helper | Usage |
|--------|-------|
| `createSupabaseMock()` | Mock chainable pour Supabase queries |
| `createMockSupabaseClient()` | Client Supabase complet mocké |
| `mockAuthenticatedSession()` | Configure une session authentifiée |
| `createTestWrapper()` | Wrapper avec providers (QueryClient, Router) |
| `flushPromises()` | Attend la résolution des promesses |

## Parcours E2E Testé

Le test `user-journey.test.ts` couvre le parcours complet :

| Étape | Description | Validations |
|-------|-------------|-------------|
| 1. Signup | Création compte utilisateur | Auth, erreurs |
| 2. Onboarding | Création organisation | RPC, subscription, trainer, templates |
| 3. Create Training | Création de formation | Validation limite, schedules, usage |
| 4. Add Participants | Ajout des participants | Insert, emails besoins |
| 5. Conduct Training | Émargement électronique | Signatures, IP/User-Agent |
| 6. Evaluations | Évaluations post-formation | Submit, certificats, relances |
| 7. Sponsor Feedback | Feedback commanditaire | Qualiopi compliance |
| 8. Generate BPF | Bilan Pédagogique | Stats, missing elements |
| 9. Eval Summary | Synthèse évaluations | Envoi commanditaire |

## Mocks

### Supabase Client

```typescript
import { vi } from "vitest";
import { createMockSupabaseClient } from "@/test/helpers";

const mockSupabase = createMockSupabaseClient({
  trainings: mockTraining,
  user_profiles: mockUserProfile,
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));
```

### Edge Functions

```typescript
mockSupabase.functions.invoke.mockResolvedValue({
  data: { success: true },
  error: null,
});
```

### Navigation

```typescript
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});
```

## Couverture de Code

Objectifs de couverture :

| Type | Objectif |
|------|----------|
| Fonctions utilitaires | 90%+ |
| Services (PDF, etc.) | 85%+ |
| Hooks | 80%+ |
| Composants | 70%+ |
| E2E | Parcours critiques |

## Priorités de Test

### Haute priorité
- Logique métier critique (emails, certificats, BPF)
- Validation des données
- Authentification et autorisation
- Parcours utilisateur complet

### Moyenne priorité
- Composants de formulaire
- Navigation
- État des applications
- Intégrations externes

### Basse priorité
- Composants UI purs
- Styles
- Animations

## Exécution des Tests

```bash
# Tous les tests
npm run test

# Tests spécifiques
npm run test -- user-journey
npm run test -- pdfGenerator

# Tests avec couverture
npm run test:coverage

# Mode watch
npm run test:watch
```

## Bonnes Pratiques

1. **Nommer les tests clairement** : Descriptions explicites du comportement attendu
2. **Un test = un concept** : Chaque test vérifie une seule chose
3. **AAA Pattern** : Arrange, Act, Assert
4. **Éviter les tests fragiles** : Tester le comportement, pas l'implémentation
5. **Utiliser les fixtures** : Réutiliser les données de test
6. **Mocker les dépendances externes** : Supabase, APIs, etc.
7. **Tester les cas d'erreur** : Pas seulement les happy paths
