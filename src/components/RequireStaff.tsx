import { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Spinner } from "@/components/ui/spinner";

type Status = "loading" | "ok" | "learner" | "anon";

export function RequireStaff() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { setStatus("anon"); return; }
      if (session.user.user_metadata?.role === "learner") { setStatus("learner"); return; }
      setStatus("ok");
    });
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
