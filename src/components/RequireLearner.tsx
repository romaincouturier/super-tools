import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/hooks/useSession";
import { buildLoginPath } from "@/lib/authRouting";

/**
 * Garde de l'espace apprenant (lot 2). Le staff y est admis : il consulte son
 * propre espace, ou celui d'un apprenant en prévisualisation.
 */
export function RequireLearner() {
  const { status, passwordSet } = useSession();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }
  if (status === "anon") {
    return <Navigate to={buildLoginPath("/connexion", location.pathname + location.search)} replace />;
  }
  if (status === "none") return <Navigate to="/compte-sans-acces" replace />;
  // Session ouverte par un lien avant que le mot de passe devienne obligatoire :
  // elle passe par l'écran de création avant d'entrer dans l'espace.
  if (!passwordSet) {
    return (
      <Navigate
        to={buildLoginPath("/connexion/definir-mot-de-passe", location.pathname + location.search)}
        replace
      />
    );
  }
  return <Outlet />;
}
