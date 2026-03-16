import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  mapAttachments,
  mapComments,
  mapActivity,
  mapEmails,
} from "@/lib/crmDataTransform";
import { CRM_QUERY_KEY } from "./useCrmMutation";

/** Fetch card details: attachments, comments, activity, emails. */
export const useCrmCardDetails = (cardId: string | null) => {
  return useQuery({
    queryKey: [CRM_QUERY_KEY, "card-details", cardId],
    queryFn: async () => {
      if (!cardId) return null;

      const attachmentsRes = await supabase
        .from("crm_attachments")
        .select("*")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false });

      const commentsRes = await supabase
        .from("crm_comments")
        .select("*")
        .eq("card_id", cardId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      const activityRes = await supabase
        .from("crm_activity_log")
        .select("*")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false });

      const emailsRes = await supabase
        .from("crm_card_emails")
        .select("*")
        .eq("card_id", cardId)
        .order("sent_at", { ascending: false });

      const attachments = mapAttachments(attachmentsRes.data || []);
      const comments = mapComments(commentsRes.data || []);
      const activity = mapActivity(activityRes.data || []);
      const emails = mapEmails(emailsRes.data || []);

      return { attachments, comments, activity, emails };
    },
    enabled: !!cardId,
  });
};
