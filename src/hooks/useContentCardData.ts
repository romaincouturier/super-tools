import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveContentType } from "@/lib/file-utils";
import { toast } from "sonner";
import type { Card, ContentCardType } from "@/components/content/KanbanBoard";

type AiActionType = "reformulate" | "adapt_blog" | "adapt_linkedin" | "adapt_instagram";

interface UseContentCardDataOptions {
  open: boolean;
  card: Card | null;
  onNewsletterChange?: () => void;
}

export function useContentCardData({ open, card, onNewsletterChange }: UseContentCardDataOptions) {
  const [draftNewsletters, setDraftNewsletters] = useState<{ id: string; title: string | null; scheduled_date: string }[]>([]);
  const [attachedNewsletterId, setAttachedNewsletterId] = useState<string | null>(null);
  const [attachingNewsletter, setAttachingNewsletter] = useState(false);
  const [aiLoading, setAiLoading] = useState<AiActionType | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch newsletters and current attachment when dialog opens
  useEffect(() => {
    if (!open) {
      setAiLoading(null);
      return;
    }

    const fetchNewsletters = async () => {
      try {
        const { data } = await supabase
          .from("newsletters")
          .select("id, title, scheduled_date")
          .eq("status", "draft")
          .order("scheduled_date", { ascending: true });
        setDraftNewsletters(data || []);
      } catch {
        setDraftNewsletters([]);
      }
    };

    const fetchAttachment = async () => {
      if (!card) {
        setAttachedNewsletterId(null);
        return;
      }
      try {
        const { data } = await supabase
          .from("newsletter_cards")
          .select("newsletter_id")
          .eq("card_id", card.id)
          .limit(1);
        setAttachedNewsletterId(data?.[0]?.newsletter_id || null);
      } catch {
        setAttachedNewsletterId(null);
      }
    };

    fetchNewsletters();
    fetchAttachment();
  }, [open, card]);

  const handleAiAction = useCallback(async (action: AiActionType, description: string): Promise<string | null> => {
    if (!description.trim()) {
      toast.error("Le contenu est vide");
      return null;
    }

    setAiLoading(action);
    try {
      const { data, error } = await supabase.functions.invoke("ai-content-assist", {
        body: { action, content: description },
      });

      if (error) throw error;

      if (data.result) {
        toast.success("Contenu modifié");
        return data.result;
      }
      return null;
    } catch (error) {
      console.error("Error with AI assist:", error);
      toast.error("Erreur lors du traitement IA");
      return null;
    } finally {
      setAiLoading(null);
    }
  }, []);

  const handleImageUpload = useCallback(async (
    file: File,
    cardId: string | null,
  ): Promise<string | null> => {
    if (!resolveContentType(file).startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return null;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("content-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("content-images")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // Register in media library if card exists
      if (cardId) {
        const session = await supabase.auth.getSession();
        await supabase.from("media").insert({
          file_url: publicUrl,
          file_name: file.name,
          file_type: "image",
          mime_type: resolveContentType(file),
          file_size: file.size,
          source_type: "content",
          source_id: cardId,
          position: 0,
          created_by: session.data.session?.user?.id || null,
        });
      }

      toast.success("Image téléchargée");
      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Erreur lors du téléchargement");
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  const handleNewsletterChange = useCallback(async (newsletterId: string, cardId: string) => {
    setAttachingNewsletter(true);
    try {
      // Remove existing attachment
      if (attachedNewsletterId) {
        await supabase
          .from("newsletter_cards")
          .delete()
          .eq("card_id", cardId)
          .eq("newsletter_id", attachedNewsletterId);
      }

      if (newsletterId === "none") {
        setAttachedNewsletterId(null);
        toast.success("Carte retirée de la newsletter");
        onNewsletterChange?.();
      } else {
        // Get max display_order for this newsletter
        const { data: existing } = await supabase
          .from("newsletter_cards")
          .select("display_order")
          .eq("newsletter_id", newsletterId)
          .order("display_order", { ascending: false })
          .limit(1);

        const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

        const { error } = await supabase
          .from("newsletter_cards")
          .insert({
            newsletter_id: newsletterId,
            card_id: cardId,
            display_order: nextOrder,
          });

        if (error) throw error;

        setAttachedNewsletterId(newsletterId);
        toast.success("Carte ajoutée à la newsletter");
        onNewsletterChange?.();
      }
    } catch (error) {
      console.error("Error updating newsletter attachment:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setAttachingNewsletter(false);
    }
  }, [attachedNewsletterId, onNewsletterChange]);

  const performAutoSave = useCallback(async (
    cardId: string,
    values: {
      title: string; description: string; imageUrl: string;
      tags: string[]; cardType: ContentCardType; emoji: string | null;
      deadline: string;
    },
  ): Promise<boolean> => {
    if (!values.title.trim()) return false;

    const { error } = await supabase
      .from("content_cards")
      .update({
        title: values.title.trim(),
        description: values.description || null,
        image_url: values.imageUrl || null,
        tags: values.tags,
        card_type: values.cardType || "article",
        emoji: values.emoji ?? null,
        deadline: values.deadline || null,
      })
      .eq("id", cardId);

    if (error) throw error;
    return true;
  }, []);

  return {
    draftNewsletters,
    attachedNewsletterId,
    setAttachedNewsletterId,
    attachingNewsletter,
    aiLoading,
    uploading,
    handleAiAction,
    handleImageUpload,
    handleNewsletterChange,
    performAutoSave,
  };
}
