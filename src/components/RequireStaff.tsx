import { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Spinner } from "@/components/ui/spinner";

type Status = "loading" | "ok" | "learner" | "anon";

export function RequireStaff() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setStatus("anon"); return; }

      // An account can be both staff/admin AND a learner.
      // We trust the profiles table over user_metadata: if the user has a
      // profile row (i.e. is staff) or is_admin, treat them as staff.
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const isStaff = !!profile;
      if (isStaff) { setStatus("ok"); return; }

      if (session.user.user_metadata?.role === "learner") {
        setStatus("learner");
        return;
      }
      setStatus("ok");
    })();
  }, []);

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Spinner size="lg" className="text-primary" />
    </div>
  );
  if (status === "anon") return <Navigate to="/auth" replace />;
  if (status === "learner") return <Navigate to="/espace-apprenant" replace />;
  return <Outlet />;
}
