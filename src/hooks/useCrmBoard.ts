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

// ─── Mutation factory to eliminate repeated queryClient/toast/onSuccess/onError boilerplate ───
function useCrmMutation<TInput, TOutput = void>(
  mutationFn: (input: TInput) => Promise<TOutput>,
  options?: {
    successMessage?: string;
    invalidateKey?: string[];
  }
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: options?.invalidateKey ?? [CRM_QUERY_KEY] });
      if (options?.successMessage) {
        toast({ title: options.successMessage });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });
}

/** Capitalize each part of a name: "jean-pierre" → "Jean-Pierre", "DE LA FONTAINE" → "De La Fontaine" */
const capitalizeName = (name: string | null | undefined): string | null => {
  if (!name) return null;
  return name
    .trim()
    .toLowerCase()
    .replace(/(^|[\s-])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
};

const normalizeEmail = (email: string | null | undefined): string | null => {
  if (!email) return null;
  return email.trim().toLowerCase();
};

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
          website_url: (card as unknown as { website_url?: string }).website_url ?? null,
          service_type: card.service_type as CrmCard["service_type"],
          brief_questions: (Array.isArray(card.brief_questions) ? card.brief_questions : []) as unknown as CrmCard["brief_questions"],
          raw_input: card.raw_input,
          next_action_text: (card as unknown as { next_action_text?: string }).next_action_text ?? null,
          next_action_done: (card as unknown as { next_action_done?: boolean }).next_action_done ?? false,
          next_action_type: ((card as unknown as { next_action_type?: string }).next_action_type ?? 'other') as CrmCard["next_action_type"],
          linked_mission_id: (card as unknown as { linked_mission_id?: string }).linked_mission_id ?? null,
          emoji: (card as unknown as { emoji?: string }).emoji ?? null,
          confidence_score: (card as unknown as { confidence_score?: number }).confidence_score ?? null,
          won_at: (card as unknown as { won_at?: string }).won_at ?? null,
          lost_at: (card as unknown as { lost_at?: string }).lost_at ?? null,
          acquisition_source: ((card as unknown as { acquisition_source?: string }).acquisition_source ?? null) as CrmCard["acquisition_source"],
          loss_reason: ((card as unknown as { loss_reason?: string }).loss_reason ?? null) as CrmCard["loss_reason"],
          loss_reason_detail: (card as unknown as { loss_reason_detail?: string }).loss_reason_detail ?? null,
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
        attachment_names: (e as any).attachment_names || [],
        resend_email_id: (e as any).resend_email_id || null,
        delivery_status: (e as any).delivery_status || 'sent',
        delivered_at: (e as any).delivered_at || null,
        opened_at: (e as any).opened_at || null,
        open_count: (e as any).open_count || 0,
        clicked_at: (e as any).clicked_at || null,
        click_count: (e as any).click_count || 0,
      }));

      return { attachments, comments, activity, emails };
    },
    enabled: !!cardId,
  });
};

// Fire-and-forget Slack notification
const notifySlack = async (
  type: "opportunity_created" | "opportunity_won",
  card: {
    title: string;
    company?: string;
    first_name?: string;
    last_name?: string;
    service_type?: string;
    estimated_value?: number;
    email?: string;
  },
  actorEmail?: string
) => {
  try {
    await supabase.functions.invoke("crm-slack-notify", {
      body: { type, card, actor_email: actorEmail },
    });
  } catch {
    // Silently fail - Slack is non-critical
  }
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
export const useCreateColumn = () =>
  useCrmMutation(async (input: CreateColumnInput) => {
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
  }, { successMessage: "Colonne créée" });

export const useUpdateColumn = () =>
  useCrmMutation(async ({ id, ...updates }: Partial<CrmColumn> & { id: string }) => {
    const { error } = await supabase.from("crm_columns").update(updates).eq("id", id);
    if (error) throw error;
  });

export const useArchiveColumn = () =>
  useCrmMutation(async (id: string) => {
    const { error } = await supabase.from("crm_columns").update({ is_archived: true }).eq("id", id);
    if (error) throw error;
  }, { successMessage: "Colonne archivée" });

export const useReorderColumns = () =>
  useCrmMutation(async (columns: { id: string; position: number }[]) => {
    const updates = columns.map((col) =>
      supabase.from("crm_columns").update({ position: col.position }).eq("id", col.id)
    );
    await Promise.all(updates);
  });

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
        first_name: capitalizeName(input.first_name),
        last_name: capitalizeName(input.last_name),
        phone: input.phone || null,
        company: input.company || null,
        email: normalizeEmail(input.email),
        linkedin_url: input.linkedin_url || null,
        service_type: input.service_type || null,
        acquisition_source: input.acquisition_source || null,
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

      // Slack notification (fire-and-forget)
      notifySlack("opportunity_created", {
        title: input.title,
        company: input.company || undefined,
        first_name: input.first_name || undefined,
        last_name: input.last_name || undefined,
        service_type: input.service_type || undefined,
        estimated_value: input.estimated_value,
        email: input.email || undefined,
      }, actorEmail);

      return data;
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: [CRM_QUERY_KEY], exact: true });
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

        // Slack notification for WON
        if (updates.sales_status === "WON") {
          notifySlack("opportunity_won", {
            title: oldCard.title,
            company: (updates.company as string) || oldCard.company || undefined,
            first_name: (updates.first_name as string) || oldCard.first_name || undefined,
            last_name: (updates.last_name as string) || oldCard.last_name || undefined,
            service_type: (updates.service_type as string) || oldCard.service_type || undefined,
            estimated_value: (updates.estimated_value as number) ?? oldCard.estimated_value,
            email: (updates.email as string) || oldCard.email || undefined,
          }, actorEmail);
        }
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

export const useDeleteCard = () =>
  useCrmMutation(async (id: string) => {
    const { error } = await supabase.from("crm_cards").delete().eq("id", id);
    if (error) throw error;
  }, { successMessage: "Opportunité supprimée" });

// Tag mutations
export const useCreateTag = () =>
  useCrmMutation(async (input: CreateTagInput) => {
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
  }, { successMessage: "Tag créé" });

export const useDeleteTag = () =>
  useCrmMutation(async (id: string) => {
    const { error } = await supabase.from("crm_tags").delete().eq("id", id);
    if (error) throw error;
  }, { successMessage: "Tag supprimé" });

export const useAssignTag = () =>
  useCrmMutation(async ({ cardId, tagId, actorEmail }: { cardId: string; tagId: string; actorEmail: string }) => {
    const { error } = await supabase.from("crm_card_tags").insert({ card_id: cardId, tag_id: tagId });
    if (error) throw error;
    const { data: tag } = await supabase.from("crm_tags").select("name").eq("id", tagId).single();
    await logActivity(cardId, "tag_added", actorEmail, null, tag?.name);
  });

export const useUnassignTag = () =>
  useCrmMutation(async ({ cardId, tagId, actorEmail }: { cardId: string; tagId: string; actorEmail: string }) => {
    const { data: tag } = await supabase.from("crm_tags").select("name").eq("id", tagId).single();
    const { error } = await supabase.from("crm_card_tags").delete().eq("card_id", cardId).eq("tag_id", tagId);
    if (error) throw error;
    await logActivity(cardId, "tag_removed", actorEmail, tag?.name, null);
  });

// Comment mutations
export const useAddComment = () =>
  useCrmMutation(async ({ cardId, content, authorEmail }: { cardId: string; content: string; authorEmail: string }) => {
    const { error } = await supabase.from("crm_comments").insert({ card_id: cardId, content, author_email: authorEmail });
    if (error) throw error;
    await logActivity(cardId, "comment_added", authorEmail, null, content.substring(0, 100));
  }, { successMessage: "Commentaire ajouté" });

export const useDeleteComment = () =>
  useCrmMutation(async (id: string) => {
    const { error } = await supabase.from("crm_comments").update({ is_deleted: true }).eq("id", id);
    if (error) throw error;
  });

// Attachment mutations
export const useAddAttachment = () =>
  useCrmMutation(async ({ cardId, file, actorEmail }: { cardId: string; file: File; actorEmail: string }) => {
    const filePath = `${cardId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("crm-attachments").upload(filePath, file);
    if (uploadError) {
      console.warn("Storage upload failed, storing reference only:", uploadError);
    }
    const { error } = await supabase.from("crm_attachments").insert({
      card_id: cardId, file_name: file.name, file_path: filePath, file_size: file.size, mime_type: file.type,
    });
    if (error) throw error;
    await logActivity(cardId, "attachment_added", actorEmail, null, file.name);
  }, { successMessage: "Fichier ajouté" });

export const useDeleteAttachment = () =>
  useCrmMutation(async ({ id, cardId, fileName, filePath, actorEmail }: { id: string; cardId: string; fileName: string; filePath: string; actorEmail: string }) => {
    await supabase.storage.from("crm-attachments").remove([filePath]);
    const { error } = await supabase.from("crm_attachments").delete().eq("id", id);
    if (error) throw error;
    await logActivity(cardId, "attachment_removed", actorEmail, fileName, null);
  }, { successMessage: "Fichier supprimé" });

// Email mutations (real send via edge function)
export const useSendEmail = () =>
  useCrmMutation(async ({ input, senderEmail }: { input: SendEmailInput; senderEmail: string }) => {
    const { data, error } = await supabase.functions.invoke("crm-send-email", {
      body: {
        card_id: input.card_id,
        recipient_email: input.recipient_email,
        subject: input.subject,
        body_html: input.body_html,
        attachments: input.attachments,
      },
    });
    if (error) throw new Error(error.message || "Échec de l'envoi de l'email");
    if (!data?.success) throw new Error(data?.message || "Erreur lors de l'envoi de l'email");
    return data;
  }, { successMessage: "Email envoyé" });

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
      // Use raw query to access crm_settings table (not yet in generated types)
      const { data, error } = await supabase
        .from("crm_settings" as "crm_cards")
        .select("*")
        .in("setting_key" as "title", ["service_type_colors"]) as unknown as {
          data: { setting_key: string; setting_value: unknown }[] | null;
          error: Error | null;
        };

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
export const useUpdateCrmSettings = () =>
  useCrmMutation(async ({ key, value }: { key: string; value: unknown }) => {
    const { error } = await (supabase as unknown as { from: (table: string) => { upsert: (data: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: Error | null }> } })
      .from("crm_settings")
      .upsert(
        { setting_key: key, setting_value: value, updated_at: new Date().toISOString() },
        { onConflict: "setting_key" }
      );
    if (error) throw error;
  }, { successMessage: "Paramètres enregistrés", invalidateKey: [CRM_QUERY_KEY, "settings"] });
