import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppModule =
  | "micro_devis"
  | "formations"
  | "evaluations"
  | "certificates"
  | "ameliorations"
  | "historique"
  | "contenu"
  | "besoins"
  | "emails"
  | "statistiques"
  | "crm"
  | "missions"
  | "okr"
  | "medias"
  | "events"
  | "monitoring"
  | "parametres"
  | "arena"
  | "reclamations"
  | "support"
  | "reseau"
  | "lms"
  | "screenshots"
  | "veille"
  | "supertilt";

export const ALL_MODULES: AppModule[] = [
  "micro_devis",
  "formations",
  "evaluations",
  "certificates",
  "ameliorations",
  "historique",
  "contenu",
  "besoins",
  "emails",
  "statistiques",
  "crm",
  "missions",
  "okr",
  "medias",
  "events",
  "monitoring",
  "parametres",
  "arena",
  "reclamations",
  "support",
  "reseau",
  "lms",
  "screenshots",
  "veille",
  "supertilt",
];

export const MODULE_LABELS: Record<AppModule, string> = {
  micro_devis: "Micro-devis",
  formations: "Formations",
  evaluations: "Évaluations",
  certificates: "Certificats",
  ameliorations: "Améliorations",
  historique: "Historique",
  contenu: "Contenu",
  besoins: "Besoins participants",
  emails: "Emails reçus",
  statistiques: "Statistiques",
  crm: "CRM",
  missions: "Missions",
  okr: "OKR",
  medias: "Médiathèque",
  events: "Événements",
  monitoring: "Monitoring",
  parametres: "Paramètres généraux",
  arena: "AI Arena",
  reclamations: "Réclamations",
  support: "Support",
  reseau: "Réseau",
  lms: "E-learning",
  screenshots: "Screenshots",
  veille: "Veille",
  supertilt: "Supertilt",
};

export function useModuleAccess() {
  const [accessibleModules, setAccessibleModules] = useState<AppModule[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const checkAccess = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAccessibleModules([]);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setUserEmail(user.email || null);

      // Check if user is admin via profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("user_id", user.id)
        .single();
      const isAdminUser = profile?.is_admin === true;
      setIsAdmin(isAdminUser);

      if (isAdminUser) {
        // Admin has access to all modules
        setAccessibleModules(ALL_MODULES);
      } else {
        // Check module access for each module using the has_module_access function
        const accessPromises = ALL_MODULES.map(async (module) => {
          const { data, error } = await supabase.rpc("has_module_access", {
            _user_id: user.id,
            _module: module,
          });
          if (error) {
            console.error(`Error checking access for ${module}:`, error);
            return null;
          }
          return data ? module : null;
        });

        const results = await Promise.all(accessPromises);
        const accessible = results.filter((m): m is AppModule => m !== null);
        setAccessibleModules(accessible);
      }
    } catch (error) {
      console.error("Error checking module access:", error);
      setAccessibleModules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Safety net: never block the whole app on an access check.
    // If something hangs at network level, we still want to render the UI.
    const timeout = window.setTimeout(() => {
      setLoading(false);
    }, 8000);

    checkAccess().finally(() => {
      window.clearTimeout(timeout);
    });

    return () => {
      window.clearTimeout(timeout);
    };
  }, [checkAccess]);

  const hasAccess = useCallback(
    (module: AppModule) => accessibleModules.includes(module),
    [accessibleModules]
  );

  return {
    accessibleModules,
    hasAccess,
    isAdmin,
    loading,
    userEmail,
    refetch: checkAccess,
    allModules: ALL_MODULES,
  };
}
