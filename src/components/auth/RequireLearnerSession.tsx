import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { REDIRECT_PARAM } from "@/lib/authRouting";
import { buildLearnerLoginPath } from "@/lib/learnerLoginRedirect";

/**
 * Les pages de cours exigent une vraie connexion : un lien `?email=` sans
 * session renvoie vers la connexion (email prérempli), puis revient au cours.
 */
export default function RequireLearnerSession({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<"loading" | "ok" | "login">("loading");

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setState(session ? "ok" : "login");
    });
    return () => { cancelled = true; };
  }, []);

  if (state === "loading") return null;
  if (state === "login") {
    return <Navigate to={buildLearnerLoginPath(location.pathname, location.search, REDIRECT_PARAM)} replace />;
  }
  return <>{children}</>;
}
