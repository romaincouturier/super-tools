import { Navigate, useLocation } from "react-router-dom";

/** Redirige vers `to` en conservant la query string et le hash (anciens liens envoyés par email). */
export function RedirectKeepQuery({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search}${hash}`} replace />;
}
