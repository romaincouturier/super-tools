import { Navigate, useSearchParams } from "react-router-dom";

/**
 * Ancienne porte des liens d'accès, conservée pour les emails en circulation
 * (chapitre 17.3 : les anciennes URL restent servies 90 jours).
 *
 * Elle ne demande plus de mot de passe et n'affiche plus d'erreur : avec un
 * jeton elle mène à l'ouverture de lien, sans jeton à la page de connexion.
 */
export default function ApprenantConnexionRedirect() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  if (!token) return <Navigate to="/connexion" replace />;
  return <Navigate to={`/connexion/lien?token=${encodeURIComponent(token)}`} replace />;
}
