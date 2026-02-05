import { useState, useEffect, useRef } from "react";
import { Upload, X, Plus, Maximize2, Minimize2, RefreshCw, FileText, Linkedin, Instagram, Loader2, Save, Mail, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Card, ContentCardType } from "./KanbanBoard";
import ReviewSection from "./ReviewSection";
import RichTextEditor from "./RichTextEditor";
import EmojiPickerButton from "@/components/ui/emoji-picker-button";
import { cn } from "@/lib/utils";

type AiActionType = "reformulate" | "adapt_blog" | "adapt_linkedin" | "adapt_instagram";

const aiActions = [
  { id: "reformulate" as AiActionType, label: "Reformuler", icon: RefreshCw },
  { id: "adapt_blog" as AiActionType, label: "Blog", icon: FileText },
  { id: "adapt_linkedin" as AiActionType, label: "LinkedIn", icon: Linkedin },
  { id: "adapt_instagram" as AiActionType, label: "Instagram", icon: Instagram },
];

interface ContentCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: Card | null;
  onSave: (card: Partial<Card>) => void;
}

const ContentCardDialog = ({
  open,
  onOpenChange,
  card,
  onSave,
}: ContentCardDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [cardType, setCardType] = useState<ContentCardType>("article");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aiLoading, setAiLoading] = useState<AiActionType | null>(null);
  const [draftNewsletters, setDraftNewsletters] = useState<{ id: string; title: string | null; scheduled_date: string }[]>([]);
  const [attachedNewsletterId, setAttachedNewsletterId] = useState<string | null>(null);
  const [attachingNewsletter, setAttachingNewsletter] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || "");
      setImageUrl(card.image_url || "");
      setTags(card.tags || []);
      setCardType(card.card_type || "article");
      setEmoji(card.emoji || null);
    } else {
      setTitle("");
      setDescription("");
      setImageUrl("");
      setTags([]);
      setCardType("article");
      setEmoji(null);
    }
  }, [card, open]);

  // Fetch newsletters and current attachment when dialog opens
  useEffect(() => {
    if (!open) {
      setIsFullscreen(false);
      setAiLoading(null);
      return;
    }

    const fetchNewsletters = async () => {
      try {
        const { data } = await (supabase as any)
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
        const { data } = await (supabase as any)
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

  const handleAiAction = async (action: AiActionType) => {
    if (!description.trim()) {
      toast.error("Le contenu est vide");
      return;
    }

    setAiLoading(action);
    try {
      const { data, error } = await supabase.functions.invoke("ai-content-assist", {
        body: { action, content: description },
      });

      if (error) throw error;

      if (data.result) {
        setDescription(data.result);
        toast.success("Contenu modifié");
      }
    } catch (error) {
      console.error("Error with AI assist:", error);
      toast.error("Erreur lors du traitement IA");
    } finally {
      setAiLoading(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
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

      setImageUrl(urlData.publicUrl);
      toast.success("Image téléchargée");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Erreur lors du téléchargement");
    } finally {
      setUploading(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    onSave({
      title: title.trim(),
      description: description || null,
      image_url: imageUrl || null,
      tags,
      card_type: cardType,
      emoji,
    });
  };

  const handleNewsletterChange = async (newsletterId: string) => {
    if (!card) return;

    setAttachingNewsletter(true);
    try {
      // Remove existing attachment
      if (attachedNewsletterId) {
        await (supabase as any)
          .from("newsletter_cards")
          .delete()
          .eq("card_id", card.id)
          .eq("newsletter_id", attachedNewsletterId);
      }

      if (newsletterId === "none") {
        setAttachedNewsletterId(null);
        toast.success("Carte retirée de la newsletter");
      } else {
        // Get max display_order for this newsletter
        const { data: existing } = await (supabase as any)
          .from("newsletter_cards")
          .select("display_order")
          .eq("newsletter_id", newsletterId)
          .order("display_order", { ascending: false })
          .limit(1);

        const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

        const { error } = await (supabase as any)
          .from("newsletter_cards")
          .insert({
            newsletter_id: newsletterId,
            card_id: card.id,
            display_order: nextOrder,
          });

        if (error) throw error;

        setAttachedNewsletterId(newsletterId);
        toast.success("Carte ajoutée à la newsletter");
      }
    } catch (error) {
      console.error("Error updating newsletter attachment:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setAttachingNewsletter(false);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col p-0 gap-0 transition-all duration-300",
          isFullscreen
            ? "max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh]"
            : "max-w-3xl max-h-[90vh]"
        )}
      >
        {/* Sticky header with title and actions */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-3 flex items-center gap-3">
          <EmojiPickerButton emoji={emoji} onEmojiChange={setEmoji} size="lg" />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la carte"
            className="flex-1 border-none shadow-none text-xl font-semibold h-auto py-1 px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
          />
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              Enregistrer
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="h-8 w-8"
              title={isFullscreen ? "Réduire" : "Plein écran"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {/* Type de contenu */}
            <div className="space-y-2">
              <Label>Type de contenu</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={cardType === "article" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCardType("article")}
                  className="flex-1"
                >
                  Article
                </Button>
                <Button
                  type="button"
                  variant={cardType === "post" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCardType("post")}
                  className="flex-1"
                >
                  Post réseaux sociaux
                </Button>
              </div>
            </div>

            {/* Description avec boutons IA */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Description</Label>
                {card && description.trim() && (
                  <div className="flex gap-1">
                    {aiActions.map((action) => {
                      const Icon = action.icon;
                      const isLoading = aiLoading === action.id;
                      return (
                        <Button
                          key={action.id}
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleAiAction(action.id)}
                          disabled={aiLoading !== null}
                          title={action.label}
                        >
                          {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Icon className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1 hidden sm:inline">{action.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
              <RichTextEditor
                content={description}
                onChange={setDescription}
                placeholder="Description du contenu..."
                className={cn(isFullscreen && "min-h-[400px]")}
              />
            </div>

            {/* Image */}
            <div className="space-y-2">
              <Label>Image</Label>
              {imageUrl ? (
                <div className="relative">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full max-h-48 object-cover rounded-lg"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => setImageUrl("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                  <p className="text-sm text-muted-foreground">
                    {uploading ? "Téléchargement..." : "Cliquez pour ajouter une image"}
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Nouveau tag..."
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                />
                <Button type="button" variant="outline" onClick={handleAddTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Newsletter */}
            {card && draftNewsletters.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Newsletter
                </Label>
                <Select
                  value={attachedNewsletterId || "none"}
                  onValueChange={handleNewsletterChange}
                  disabled={attachingNewsletter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Rattacher à une newsletter..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune newsletter</SelectItem>
                    {draftNewsletters.map((nl) => (
                      <SelectItem key={nl.id} value={nl.id}>
                        {nl.title || "Newsletter"} — {format(new Date(nl.scheduled_date), "d MMM yyyy", { locale: fr })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {attachedNewsletterId && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Check className="h-3 w-3 text-green-600" />
                    Rattachée à la newsletter
                  </p>
                )}
              </div>
            )}

            {/* Section Relecture (flat, pour cartes existantes) */}
            {card && (
              <div className="space-y-2 border rounded-lg p-4">
                <h3 className="font-medium">Relecture</h3>
                <ReviewSection cardId={card.id} cardTitle={card.title} />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContentCardDialog;
