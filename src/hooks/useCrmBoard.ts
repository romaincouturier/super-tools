import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CrmColumn,
  CrmCard,
  CrmTag,
  CrmAttachment,
  CrmComment,
  CrmActivityLog,
  CrmCardEmail,
  CreateCardInput,
  UpdateCardInput,
  CreateColumnInput,
  CreateTagInput,
  SendEmailInput,
  CrmActivityType,
  OpportunityExtraction,
} from "@/types/crm";

const CRM_QUERY_KEY = "crm-board";

// Fetch all board data
export const useCrmBoard = () => {
  return useQuery({
    queryKey: [CRM_QUERY_KEY],
    queryFn: async () => {
      const columnsRes = await supabase
        .from("crm_columns")
        .select("*")
        .eq("is_archived", false)
        .order("position", { ascending: true });

      const cardsRes = await supabase
        .from("crm_cards")
        .select("*")
        .order("position", { ascending: true });

      const tagsRes = await supabase
        .from("crm_tags")
        .select("*")
        .order("category", { ascending: true });

      const cardTagsRes = await supabase.from("crm_card_tags").select("*");

      if (columnsRes.error) throw columnsRes.error;
      if (cardsRes.error) throw cardsRes.error;
      if (tagsRes.error) throw tagsRes.error;
      if (cardTagsRes.error) throw cardTagsRes.error;

      // Map raw data to typed objects
      const columns: CrmColumn[] = (columnsRes.data || []).map((col) => ({
        id: col.id,
        name: col.name,
        position: col.position,
        is_archived: col.is_archived,
        created_at: col.created_at,
        updated_at: col.updated_at,
      }));

      const tags: CrmTag[] = (tagsRes.data || []).map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        category: t.category,
        created_at: t.created_at,
      }));

      const cardTags = cardTagsRes.data || [];

      // Attach tags to cards
      const cards: CrmCard[] = (cardsRes.data || []).map((card) => {
        const cardTagIds = cardTags
          .filter((ct) => ct.card_id === card.id)
          .map((ct) => ct.tag_id);
        const cardTagsList = tags.filter((t) => cardTagIds.includes(t.id));
        return {
          id: card.id,
          column_id: card.column_id,
          title: card.title,
          description_html: card.description_html,
          status_operational: card.status_operational as CrmCard["status_operational"],
          waiting_next_action_date: card.waiting_next_action_date,
          waiting_next_action_text: card.waiting_next_action_text,
          sales_status: card.sales_status as CrmCard["sales_status"],
          estimated_value: card.estimated_value ?? 0,
          quote_url: card.quote_url,
          position: card.position,
          created_at: card.created_at,
          updated_at: card.updated_at,
          // Contact fields
          first_name: card.first_name,
          last_name: card.last_name,
          phone: card.phone,
          company: card.company,
          email: card.email,
          linkedin_url: card.linkedin_url,
          website_url: card.website_url,
          service_type: card.service_type as CrmCard["service_type"],
          brief_questions: (Array.isArray(card.brief_questions) ? card.brief_questions : []) as unknown as CrmCard["brief_questions"],
          raw_input: card.raw_input,
          tags: cardTagsList,
        };
      });

      return { columns, cards, tags };
    },
  });
};

// Fetch card details (attachments, comments, activity, emails)
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

      const attachments: CrmAttachment[] = (attachmentsRes.data || []).map((a) => ({
        id: a.id,
        card_id: a.card_id,
        file_name: a.file_name,
        file_path: a.file_path,
        file_size: a.file_size,
        mime_type: a.mime_type,
        created_at: a.created_at,
      }));

      const comments: CrmComment[] = (commentsRes.data || []).map((c) => ({
        id: c.id,
        card_id: c.card_id,
        author_email: c.author_email,
        content: c.content,
        is_deleted: c.is_deleted,
        created_at: c.created_at,
      }));

      const activity: CrmActivityLog[] = (activityRes.data || []).map((a) => ({
        id: a.id,
        card_id: a.card_id,
        action_type: a.action_type as CrmActivityType,
        old_value: a.old_value,
        new_value: a.new_value,
        metadata: a.metadata as Record<string, unknown> | null,
        actor_email: a.actor_email,
        created_at: a.created_at,
      }));

      const emails: CrmCardEmail[] = (emailsRes.data || []).map((e) => ({
        id: e.id,
        card_id: e.card_id,
        sender_email: e.sender_email,
        recipient_email: e.recipient_email,
        subject: e.subject,
        body_html: e.body_html,
        sent_at: e.sent_at,
      }));

      return { attachments, comments, activity, emails };
    },
    enabled: !!cardId,
  });
};

// Helper to log activity
const logActivity = async (
  cardId: string,
  actionType: CrmActivityType,
  actorEmail: string,
  oldValue?: string | null,
  newValue?: string | null,
  metadata?: Record<string, unknown>
) => {
  await supabase.from("crm_activity_log").insert([{
    card_id: cardId,
    action_type: actionType,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
    metadata: (metadata ?? null) as unknown as null,
    actor_email: actorEmail,
  }]);
};

// Column mutations
export const useCreateColumn = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateColumnInput) => {
      // Get max position
      const { data: cols } = await supabase
        .from("crm_columns")
        .select("position")
        .order("position", { ascending: false })
        .limit(1);
      const maxPos = cols?.[0]?.position ?? -1;

      const { data, error } = await supabase
        .from("crm_columns")
        .insert({ name: input.name, position: input.position ?? maxPos + 1 })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
      toast({ title: "Colonne créée" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};

export const useUpdateColumn = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CrmColumn> & { id: string }) => {
      const { error } = await supabase.from("crm_columns").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};

export const useArchiveColumn = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_columns").update({ is_archived: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
      toast({ title: "Colonne archivée" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};

export const useReorderColumns = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (columns: { id: string; position: number }[]) => {
      const updates = columns.map((col) =>
        supabase.from("crm_columns").update({ position: col.position }).eq("id", col.id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
    },
  });
};

// Card mutations
export const useCreateCard = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ input, actorEmail }: { input: CreateCardInput; actorEmail: string }) => {
      // Get max position in column
      const { data: cards } = await supabase
        .from("crm_cards")
        .select("position")
        .eq("column_id", input.column_id)
        .order("position", { ascending: false })
        .limit(1);
      const maxPos = cards?.[0]?.position ?? -1;

      const insertData = {
        column_id: input.column_id,
        title: input.title,
        description_html: input.description_html || null,
        status_operational: input.status_operational || "TODAY",
        waiting_next_action_date: input.waiting_next_action_date || null,
        waiting_next_action_text: input.waiting_next_action_text || null,
        sales_status: input.sales_status || "OPEN",
        estimated_value: input.estimated_value ?? 0,
        quote_url: input.quote_url || null,
        position: maxPos + 1,
        first_name: input.first_name || null,
        last_name: input.last_name || null,
        phone: input.phone || null,
        company: input.company || null,
        email: input.email || null,
        linkedin_url: input.linkedin_url || null,
        service_type: input.service_type || null,
        brief_questions: (input.brief_questions || null) as unknown as null,
        raw_input: input.raw_input || null,
      };

      const { data, error } = await supabase
        .from("crm_cards")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      await logActivity(data.id, "card_created", actorEmail, null, input.title);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
      toast({ title: "Opportunité créée" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};

export const useUpdateCard = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
      actorEmail,
      oldCard,
    }: {
      id: string;
      updates: UpdateCardInput;
      actorEmail: string;
      oldCard: CrmCard;
    }) => {
      // Prepare update data, converting brief_questions to Json type
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.brief_questions !== undefined) {
        updateData.brief_questions = updates.brief_questions as unknown;
      }
      const { error } = await supabase.from("crm_cards").update(updateData).eq("id", id);
      if (error) throw error;

      // Log relevant changes
      if (updates.column_id && updates.column_id !== oldCard.column_id) {
        await logActivity(id, "card_moved", actorEmail, oldCard.column_id, updates.column_id);
      }
      if (updates.status_operational && updates.status_operational !== oldCard.status_operational) {
        await logActivity(
          id,
          "status_operational_changed",
          actorEmail,
          oldCard.status_operational,
          updates.status_operational
        );
      }
      if (updates.sales_status && updates.sales_status !== oldCard.sales_status) {
        await logActivity(id, "sales_status_changed", actorEmail, oldCard.sales_status, updates.sales_status);
      }
      if (updates.estimated_value !== undefined && updates.estimated_value !== oldCard.estimated_value) {
        await logActivity(
          id,
          "estimated_value_changed",
          actorEmail,
          String(oldCard.estimated_value),
          String(updates.estimated_value)
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};

export const useMoveCard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cardId,
      newColumnId,
      newPosition,
      actorEmail,
      oldColumnId,
    }: {
      cardId: string;
      newColumnId: string;
      newPosition: number;
      actorEmail: string;
      oldColumnId: string;
    }) => {
      const { error } = await supabase
        .from("crm_cards")
        .update({ column_id: newColumnId, position: newPosition })
        .eq("id", cardId);
      if (error) throw error;

      if (newColumnId !== oldColumnId) {
        await logActivity(cardId, "card_moved", actorEmail, oldColumnId, newColumnId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
    },
  });
};

export const useDeleteCard = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
      toast({ title: "Opportunité supprimée" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};

// Tag mutations
export const useCreateTag = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateTagInput) => {
      const { data, error } = await supabase
        .from("crm_tags")
        .insert({
          name: input.name,
          color: input.color || "#3b82f6",
          category: input.category || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
      toast({ title: "Tag créé" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};

export const useDeleteTag = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
      toast({ title: "Tag supprimé" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};

export const useAssignTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cardId,
      tagId,
      actorEmail,
    }: {
      cardId: string;
      tagId: string;
      actorEmail: string;
    }) => {
      const { error } = await supabase.from("crm_card_tags").insert({ card_id: cardId, tag_id: tagId });
      if (error) throw error;

      // Get tag name for logging
      const { data: tag } = await supabase.from("crm_tags").select("name").eq("id", tagId).single();
      await logActivity(cardId, "tag_added", actorEmail, null, tag?.name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
    },
  });
};

export const useUnassignTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cardId,
      tagId,
      actorEmail,
    }: {
      cardId: string;
      tagId: string;
      actorEmail: string;
    }) => {
      // Get tag name for logging
      const { data: tag } = await supabase.from("crm_tags").select("name").eq("id", tagId).single();

      const { error } = await supabase
        .from("crm_card_tags")
        .delete()
        .eq("card_id", cardId)
        .eq("tag_id", tagId);
      if (error) throw error;

      await logActivity(cardId, "tag_removed", actorEmail, tag?.name, null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
    },
  });
};

// Comment mutations
export const useAddComment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      cardId,
      content,
      authorEmail,
    }: {
      cardId: string;
      content: string;
      authorEmail: string;
    }) => {
      const { error } = await supabase.from("crm_comments").insert({
        card_id: cardId,
        content,
        author_email: authorEmail,
      });
      if (error) throw error;

      await logActivity(cardId, "comment_added", authorEmail, null, content.substring(0, 100));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
      toast({ title: "Commentaire ajouté" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_comments").update({ is_deleted: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
    },
  });
};

// Attachment mutations
export const useAddAttachment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      cardId,
      file,
      actorEmail,
    }: {
      cardId: string;
      file: File;
      actorEmail: string;
    }) => {
      // Upload to Supabase Storage (crm-attachments bucket)
      const filePath = `${cardId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("crm-attachments")
        .upload(filePath, file);

      if (uploadError) {
        // If bucket doesn't exist, store reference only (local path)
        console.warn("Storage upload failed, storing reference only:", uploadError);
      }

      const { error } = await supabase.from("crm_attachments").insert({
        card_id: cardId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
      });
      if (error) throw error;

      await logActivity(cardId, "attachment_added", actorEmail, null, file.name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
      toast({ title: "Fichier ajouté" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};

export const useDeleteAttachment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      cardId,
      fileName,
      filePath,
      actorEmail,
    }: {
      id: string;
      cardId: string;
      fileName: string;
      filePath: string;
      actorEmail: string;
    }) => {
      // Try to delete from storage
      await supabase.storage.from("crm-attachments").remove([filePath]);

      const { error } = await supabase.from("crm_attachments").delete().eq("id", id);
      if (error) throw error;

      await logActivity(cardId, "attachment_removed", actorEmail, fileName, null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
      toast({ title: "Fichier supprimé" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};

// Email mutations (mock send)
export const useSendEmail = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      input,
      senderEmail,
    }: {
      input: SendEmailInput;
      senderEmail: string;
    }) => {
      // Mock send - just store the email
      const { error } = await supabase.from("crm_card_emails").insert({
        card_id: input.card_id,
        sender_email: senderEmail,
        recipient_email: input.recipient_email,
        subject: input.subject,
        body_html: input.body_html,
      });
      if (error) throw error;

      await logActivity(
        input.card_id,
        "email_sent",
        senderEmail,
        null,
        `To: ${input.recipient_email} - ${input.subject}`,
        { recipient: input.recipient_email, subject: input.subject }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY] });
      toast({ title: "Email envoyé (mock)", description: "L'email a été enregistré dans l'historique." });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};

// AI Extraction
export const useExtractOpportunity = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rawInput: string): Promise<OpportunityExtraction> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error("Non authentifié");
      }

      const response = await supabase.functions.invoke("crm-extract-opportunity", {
        body: { raw_input: rawInput },
      });

      if (response.error) {
        throw new Error(response.error.message || "Échec de l'extraction");
      }

      return response.data as OpportunityExtraction;
    },
    onError: (error) => {
      toast({ title: "Erreur d'extraction", description: error.message, variant: "destructive" });
    },
  });
};

// Reporting queries
export const useCrmReports = () => {
  return useQuery({
    queryKey: [CRM_QUERY_KEY, "reports"],
    queryFn: async () => {
      const [columnsRes, cardsRes, tagsRes, cardTagsRes] = await Promise.all([
        supabase.from("crm_columns").select("*").eq("is_archived", false).order("position"),
        supabase.from("crm_cards").select("*"),
        supabase.from("crm_tags").select("*"),
        supabase.from("crm_card_tags").select("*"),
      ]);

      const columns = (columnsRes.data || []) as unknown as CrmColumn[];
      const cards = (cardsRes.data || []) as unknown as CrmCard[];
      const tags = (tagsRes.data || []) as unknown as CrmTag[];
      const cardTags = cardTagsRes.data || [];

      // Cards per column
      const cardsPerColumn = columns.map((col) => ({
        columnName: col.name,
        count: cards.filter((c) => c.column_id === col.id).length,
      }));

      // Won deals
      const wonCards = cards.filter((c) => c.sales_status === "WON");
      const wonCount = wonCards.length;
      const wonValue = wonCards.reduce((sum, c) => sum + (c.estimated_value || 0), 0);

      // Lost deals
      const lostCards = cards.filter((c) => c.sales_status === "LOST");
      const lostCount = lostCards.length;

      // Open pipeline value
      const openCards = cards.filter((c) => c.sales_status === "OPEN");
      const openValue = openCards.reduce((sum, c) => sum + (c.estimated_value || 0), 0);

      // Breakdown by tag category
      const categories = [...new Set(tags.filter((t) => t.category).map((t) => t.category))];
      const breakdownByCategory = categories.map((cat) => {
        const categoryTags = tags.filter((t) => t.category === cat);
        const categoryTagIds = categoryTags.map((t) => t.id);
        const cardIdsWithCategory = cardTags
          .filter((ct) => categoryTagIds.includes(ct.tag_id))
          .map((ct) => ct.card_id);
        const uniqueCardIds = [...new Set(cardIdsWithCategory)];
        return {
          category: cat,
          count: uniqueCardIds.length,
          value: cards
            .filter((c) => uniqueCardIds.includes(c.id))
            .reduce((sum, c) => sum + (c.estimated_value || 0), 0),
        };
      });

      return {
        cardsPerColumn,
        wonCount,
        wonValue,
        lostCount,
        openValue,
        openCount: openCards.length,
        breakdownByCategory,
        totalCards: cards.length,
      };
    },
  });
};

// Service type colors interface
export interface ServiceTypeColors {
  formation: string;
  mission: string;
  default: string;
}

// Fetch CRM settings
export const useCrmSettings = () => {
  return useQuery({
    queryKey: [CRM_QUERY_KEY, "settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["service_type_colors"]);

      if (error) throw error;

      const settings: Record<string, unknown> = {};
      (data || []).forEach((row) => {
        settings[row.setting_key] = row.setting_value;
      });

      return {
        serviceTypeColors: (settings.service_type_colors || {
          formation: "#3b82f6",
          mission: "#8b5cf6",
          default: "#6b7280",
        }) as ServiceTypeColors,
      };
    },
  });
};

// Update CRM settings
export const useUpdateCrmSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      key,
      value,
    }: {
      key: string;
      value: unknown;
    }) => {
      const { error } = await supabase
        .from("crm_settings")
        .upsert(
          { setting_key: key, setting_value: value, updated_at: new Date().toISOString() },
          { onConflict: "setting_key" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CRM_QUERY_KEY, "settings"] });
      toast({ title: "Paramètres enregistrés" });
    },
    onError: (error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
};
