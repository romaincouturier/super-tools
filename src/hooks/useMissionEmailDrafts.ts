import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/sb/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface MissionEmailDraft {
  id: string;
  mission_id: string;
  email_type: string;
  contact_email: string;
  contact_name: string | null;
  subject: string;
  html_content: string;
  status: "pending" | "approved" | "scheduled" | "sent" | "rejected";
  scheduled_for: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  sent_at: string | null;
  created_at: string;
}

const sb = sb as any;
const TABLE = "mission_email_drafts";
const KEY = ["mission-email-drafts"];

export function useMissionEmailDrafts(missionId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: missionId ? [...KEY, missionId] : KEY,
    queryFn: async () => {
      let q = sb
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false });
      if (missionId) q = q.eq("mission_id", missionId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as MissionEmailDraft[];
    },
    enabled: !!user,
  });

  const pendingDrafts = (query.data || []).filter((d) => d.status === "pending");

  const approveDraft = useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await sb
        .from(TABLE)
        .update({
          status: "approved",
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Brouillon approuvé");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Erreur : ${msg}`);
    },
  });

  const rejectDraft = useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await sb
        .from(TABLE)
        .update({
          status: "rejected",
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Brouillon rejeté");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Erreur : ${msg}`);
    },
  });

  const updateDraftContent = useMutation({
    mutationFn: async ({ draftId, subject, html_content }: { draftId: string; subject: string; html_content: string }) => {
      const { error } = await sb
        .from(TABLE)
        .update({ subject, html_content } as any)
        .eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Contenu mis à jour");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Erreur : ${msg}`);
    },
  });

  const sendDraft = useMutation({
    mutationFn: async (draftId: string) => {
      const { data, error } = await supabase.functions.invoke("send-mission-email-draft", {
        body: { draftId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Envoi échoué");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Email envoyé");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Erreur d'envoi : ${msg}`);
    },
  });

  const approveAndSend = useMutation({
    mutationFn: async (draftId: string) => {
      // First approve
      const { error: approveError } = await sb
        .from(TABLE)
        .update({
          status: "approved",
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq("id", draftId);
      if (approveError) throw approveError;

      // Then send
      const { data, error } = await supabase.functions.invoke("send-mission-email-draft", {
        body: { draftId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Envoi échoué");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Email approuvé et envoyé");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Erreur : ${msg}`);
    },
  });

  const scheduleDraft = useMutation({
    mutationFn: async ({ draftId, scheduledFor }: { draftId: string; scheduledFor: string }) => {
      const { error } = await sb
        .from(TABLE)
        .update({
          status: "scheduled",
          scheduled_for: scheduledFor,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq("id", draftId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Email programmé");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Erreur : ${msg}`);
    },
  });

  return {
    drafts: query.data || [],
    pendingDrafts,
    isLoading: query.isLoading,
    approveDraft,
    rejectDraft,
    updateDraftContent,
    sendDraft,
    approveAndSend,
    scheduleDraft,
  };
}
