import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, UserPlus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Public redirect page for e-learning integrations (LearnDash / WordPress).
 *
 * URLs:
 *   /formulaire/besoins?email=xxx&course_id=123
 *   /formulaire/evaluation?email=xxx&course_id=123
 *
 * Flow:
 * 1. Calls resolve-formulaire Edge Function (with IP rate limiting)
 * 2. If participant found → redirect to form
 * 3. If participant not found → show first_name / last_name form
 * 4. On registration → creates orphan entry and redirects
 */

interface ResolveResult {
  status: "ok" | "product_not_found" | "participant_not_found" | "invalid_params";
  token?: string;
  catalog_id?: string;
}

const FormulaireRedirect = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRegistration, setShowRegistration] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const email = searchParams.get("email");
  const courseId = searchParams.get("course_id");
  const formType = location.pathname.includes("besoins") ? "besoins" : "evaluation";

  const formLabel = formType === "besoins" ? "recueil des besoins" : "évaluation";

  const callResolve = useCallback(
    async (body: Record<string, unknown>): Promise<ResolveResult | null> => {
      const { data, error: fnError } = await supabase.functions.invoke(
        "resolve-formulaire",
        { body }
      );

      if (fnError) {
        console.error("resolve-formulaire error:", fnError);
        // Check for rate limiting
        if (fnError.message?.includes("429") || fnError.message?.includes("Trop de requêtes")) {
          setError("Trop de requêtes. Veuillez réessayer dans quelques minutes.");
        } else {
          setError("Une erreur technique est survenue. Veuillez réessayer.");
        }
        return null;
      }

      return data as ResolveResult;
    },
    []
  );

  const redirectToForm = useCallback(
    (token: string) => {
      const target =
        formType === "besoins"
          ? `/questionnaire/${token}`
          : `/evaluation/${token}`;
      navigate(target, { replace: true });
    },
    [formType, navigate]
  );

  // Initial resolution
  useEffect(() => {
    const resolve = async () => {
      if (!email || !courseId) {
        setError("Paramètres manquants : email et course_id sont requis.");
        setLoading(false);
        return;
      }

      const cid = parseInt(courseId, 10);
      if (isNaN(cid)) {
        setError("course_id invalide.");
        setLoading(false);
        return;
      }

      const result = await callResolve({
        email,
        course_id: cid,
        form_type: formType,
      });

      if (!result) {
        setLoading(false);
        return;
      }

      switch (result.status) {
        case "ok":
          redirectToForm(result.token!);
          break;

        case "product_not_found":
          setError(
            "Ce lien n'est pas valide. Le produit référencé n'existe pas dans notre système."
          );
          setLoading(false);
          break;

        case "participant_not_found":
          setShowRegistration(true);
          setLoading(false);
          break;

        case "invalid_params":
          setError("Paramètres invalides.");
          setLoading(false);
          break;

        default:
          setError("Une erreur inattendue est survenue.");
          setLoading(false);
      }
    };

    resolve();
  }, [email, courseId, formType, callResolve, redirectToForm]);

  // Handle registration form submit
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) return;

    setRegistering(true);
    setError(null);

    const cid = parseInt(courseId!, 10);
    const result = await callResolve({
      email,
      course_id: cid,
      form_type: formType,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    });

    if (!result) {
      setRegistering(false);
      return;
    }

    if (result.status === "ok" && result.token) {
      redirectToForm(result.token);
    } else {
      setError("Impossible de créer votre formulaire. Veuillez réessayer.");
      setRegistering(false);
    }
  };

  // Error state
  if (error && !showRegistration) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <h1 className="text-xl font-semibold">Formulaire inaccessible</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // Registration form for unknown participants
  if (showRegistration) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border p-6 space-y-6">
          <div className="text-center space-y-2">
            <UserPlus className="h-10 w-10 text-primary mx-auto" />
            <h1 className="text-xl font-semibold">
              Formulaire de {formLabel}
            </h1>
            <p className="text-sm text-muted-foreground">
              Votre email n'a pas été trouvé dans nos participants.
              Veuillez compléter vos informations pour accéder au formulaire.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email || ""}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom *</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Votre prénom"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Nom *</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Votre nom"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={registering || !firstName.trim() || !lastName.trim()}
            >
              {registering ? (
                <>
                  <Spinner className="mr-2" />
                  Chargement...
                </>
              ) : (
                "Accéder au formulaire"
              )}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <Spinner size="lg" className="mx-auto text-primary" />
        <p className="text-muted-foreground">Redirection vers le formulaire...</p>
      </div>
    </div>
  );
};

export default FormulaireRedirect;
