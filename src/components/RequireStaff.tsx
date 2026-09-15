import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/hooks/useSession";
import { buildLoginPath } from "@/lib/authRouting";

/**
 * Garde des routes back-office (lot 2).
 * Seul un compte portant une ligne dans `profiles` entre. Un compte sans profil
 * n'est plus considéré comme staff par défaut : il part vers l'espace apprenant.
 */
export function RequireStaff() {
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
    return <Navigate to={buildLoginPath("/auth", location.pathname + location.search)} replace />;
  }
  if (status === "none") return <Navigate to="/compte-sans-acces" replace />;
  if (status === "learner") return <Navigate to="/espace-apprenant" replace />;
  return <Outlet />;
}
