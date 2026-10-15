import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";

export interface TestimonialRequestRow {
  id: string;
  mission_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  created_at: string;
  missions: { title: string; client_name: string | null } | null;
}

export function useTestimonialRequests() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["testimonial-requests-todo"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("testimonial_requests")
        .select("id, mission_id, contact_name, contact_email, created_at, missions(title, client_name)")
        .eq("status", "todo")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TestimonialRequestRow[];
    },
  });

  const mark = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "done" | "dismissed" }) => {
      const { data: u } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const { error } = await (supabase as any)
        .from("testimonial_requests")
        .update({ status, done_at: now, done_by: u.user?.id ?? null, updated_at: now })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "done" ? "Marqué comme fait" : "Demande abandonnée");
      qc.invalidateQueries({ queryKey: ["testimonial-requests-todo"] });
      qc.invalidateQueries({ queryKey: ["testimonial-requests-count"] });
    },
    onError: () => toast.error("Impossible d'enregistrer, réessayez"),
  });

  return { ...query, mark };
}
