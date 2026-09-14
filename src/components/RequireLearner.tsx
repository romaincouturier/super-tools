import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/hooks/useSession";
import { buildLoginPath } from "@/lib/authRouting";

/**
 * Garde de l'espace apprenant (lot 2). Le staff y est admis : il consulte son
 * propre espace, ou celui d'un apprenant en prévisualisation.
 */
export function RequireLearner() {
  const { status } = useSession();
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
  return <Outlet />;
}
