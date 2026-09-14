import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Identité de l'apprenant pour les écrans LMS.
 *
 * Lot 1 de la refonte de connexion : la session prime sur le paramètre d'URL.
 * Un apprenant connecté ne peut plus consulter ni écrire la progression d'un
 * tiers en changeant `?email=`. Le staff conserve la prévisualisation, et le
 * paramètre reste servi quand il n'y a pas de session, pour les liens envoyés
 * avant que tous les apprenants aient un compte.
 */
export function resolveLearnerEmail(params: {
  sessionEmail: string | null;
  urlEmail: string;
  isStaff: boolean;
}): string {
  const { sessionEmail, urlEmail, isStaff } = params;
  if (isStaff) return urlEmail || sessionEmail || "";
  if (sessionEmail) return sessionEmail;
  return urlEmail;
}

export function useLearnerIdentity(urlEmail: string) {
  const [state, setState] = useState<{ email: string; resolved: boolean }>({
    email: "",
    resolved: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const sessionEmail = session?.user?.email?.toLowerCase() ?? null;
      let isStaff = false;
      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        isStaff = !!data;
      }
      if (cancelled) return;
      setState({
        email: resolveLearnerEmail({ sessionEmail, urlEmail: urlEmail.toLowerCase(), isStaff }),
        resolved: true,
      });
    })();
    return () => { cancelled = true; };
  }, [urlEmail]);

  return state;
}
