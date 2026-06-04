import { Outlet, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Spinner } from "@/components/ui/spinner";

type Status = "loading" | "ok" | "learner" | "anon";

async function fetchStaffStatus(): Promise<Status> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return "anon";

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (profile) return "ok";
  if (session.user.user_metadata?.role === "learner") return "learner";
  return "ok";
}

export function RequireStaff() {
  const { data: status = "loading", isLoading } = useQuery({
    queryKey: ["require-staff-status"],
    queryFn: fetchStaffStatus,
    staleTime: 60_000,
    retry: false,
  });

  if (isLoading || status === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Spinner size="lg" className="text-primary" />
    </div>
  );
  if (status === "anon") return <Navigate to="/auth" replace />;
  if (status === "learner") return <Navigate to="/espace-apprenant" replace />;
  return <Outlet />;
}
