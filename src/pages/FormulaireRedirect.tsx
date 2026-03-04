import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle } from "lucide-react";

/**
 * Public redirect page for e-learning integrations (LearnDash / WordPress).
 *
 * URLs:
 *   /formulaire/besoins?email=xxx&product_id=123
 *   /formulaire/evaluation?email=xxx&product_id=123
 *
 * Resolves the participant via email + WooCommerce product ID,
 * creates the form record if needed, and redirects to the actual form.
 */
const FormulaireRedirect = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  const email = searchParams.get("email");
  const productId = searchParams.get("product_id");
  const formType = location.pathname.includes("besoins") ? "besoins" : "evaluation";

  useEffect(() => {
    const resolve = async () => {
      if (!email || !productId) {
        setError("Paramètres manquants : email et product_id sont requis.");
        return;
      }

      const pid = parseInt(productId, 10);
      if (isNaN(pid)) {
        setError("product_id invalide.");
        return;
      }

      const { data: token, error: rpcError } = await supabase.rpc(
        "resolve_formulaire_token",
        { p_email: email, p_product_id: pid, p_form_type: formType }
      );

      if (rpcError) {
        console.error("resolve_formulaire_token error:", rpcError);
        setError("Une erreur technique est survenue. Veuillez réessayer.");
        return;
      }

      if (!token) {
        setError(
          "Aucun participant trouvé pour cet email et cette formation. " +
          "Vérifiez que vous êtes bien inscrit(e)."
        );
        return;
      }

      const target = formType === "besoins"
        ? `/questionnaire/${token}`
        : `/evaluation/${token}`;
      navigate(target, { replace: true });
    };

    resolve();
  }, [email, productId, formType, navigate]);

  if (error) {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Redirection vers le formulaire...</p>
      </div>
    </div>
  );
};

export default FormulaireRedirect;
