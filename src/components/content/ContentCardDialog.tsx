import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Upload, X, Plus, Maximize2, Minimize2, RefreshCw, FileText, Linkedin, Instagram, Loader2, Save, Mail, Check, MessageSquare, ZoomIn, ChevronDown, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Card, Column, ContentCardType } from "./KanbanBoard";
import CommentThread from "./CommentThread";
import RichTextEditor from "./RichTextEditor";
import EmojiPickerButton from "@/components/ui/emoji-picker-button";
import { cn } from "@/lib/utils";
import ImageLightbox from "@/components/ui/image-lightbox";
import { useAutoSaveForm, type AutoSaveFormValues } from "@/hooks/useAutoSaveForm";
import { useContentCardData } from "@/hooks/useContentCardData";
import EntityMediaManager from "@/components/media/EntityMediaManager";

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
  columns?: Column[];
  onColumnChange?: (cardId: string, newColumnId: string) => void;
  onSave: (card: Partial<Card>, options?: { newsletterId?: string; initialComment?: string }) => void;
  onNewsletterChange?: () => void;
}

const ContentCardDialog = ({
  open,
  onOpenChange,
  card,
  columns = [],
  onColumnChange,
  onSave,
  onNewsletterChange,
}: ContentCardDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [cardType, setCardType] = useState<ContentCardType>("article");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [deadline, setDeadline] = useState("");
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [initialComment, setInitialComment] = useState("");
  const [currentColumnId, setCurrentColumnId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    draftNewsletters,
    attachedNewsletterId,
    setAttachedNewsletterId,
    attachingNewsletter,
    aiLoading,
    uploading,
    handleAiAction: doAiAction,
    handleImageUpload: doImageUpload,
    handleNewsletterChange: doNewsletterChange,
    performAutoSave,
  } = useContentCardData({ open, card, onNewsletterChange });

  const handleAutoSave = useCallback(async (values: AutoSaveFormValues): Promise<boolean> => {
    if (!card) return false;
    return performAutoSave(card.id, values as {
      title: string; description: string; imageUrl: string;
      tags: string[]; cardType: ContentCardType; emoji: string | null;
      deadline: string;
    });
  }, [card, performAutoSave]);

  const { autoSaving, lastSaved, resetTracking, flushAndGetPending } = useAutoSaveForm({
    open: open && !!card,
    formValues: useMemo(() => ({ title, description, imageUrl, tags, cardType, emoji, deadline }), [title, description, imageUrl, tags, cardType, emoji, deadline]),
    onSave: handleAutoSave,
  });

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || "");
      setImageUrl(card.image_url || "");
      setTags(card.tags || []);
      setCardType(card.card_type || "article");
      setEmoji(card.emoji || null);
      setDeadline(card.deadline || "");
      setCurrentColumnId(card.column_id);
    } else {
      setTitle("");
      setDescription("");
      setImageUrl("");
      setTags([]);
      setCardType("article");
      setEmoji(null);
      setDeadline("");
      setInitialComment("");
      setCurrentColumnId(null);
    }
    resetTracking();
  }, [card, open, resetTracking]);

  useEffect(() => {
    if (!open) setIsFullscreen(false);
  }, [open]);

  const handleAiAction = async (action: AiActionType) => {
    const result = await doAiAction(action, description);
    if (result) setDescription(result);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await doImageUpload(file, card?.id || null);
    if (url) setImageUrl(url);
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

  // Manual save for create mode only
  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    const options: { newsletterId?: string; initialComment?: string } = {};
    if (!card && attachedNewsletterId && attachedNewsletterId !== "none") {
      options.newsletterId = attachedNewsletterId;
    }
    if (!card && initialComment.trim()) {
      options.initialComment = initialComment.trim();
    }

    onSave({
      title: title.trim(),
      description: description || null,
      image_url: imageUrl || null,
      tags,
      card_type: cardType,
      emoji,
      deadline: deadline || null,
    }, Object.keys(options).length > 0 ? options : undefined);
  };

  // Flush auto-save and close
  const handleClose = (isOpen: boolean) => {
    if (!isOpen && card) {
      const pending = flushAndGetPending();
      if (pending) {
        handleAutoSave(pending).catch(() => {});
      }
    }
    onOpenChange(isOpen);
  };

  const handleNewsletterChange = (newsletterId: string) => {
    if (!card) return;
    doNewsletterChange(newsletterId, card.id);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Column selector for existing cards */}
            {card && columns.length > 0 && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
                    {columns.find(c => c.id === currentColumnId)?.name || "Colonne"}
                    <ChevronDown className="h-3 w-3 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {columns.map((col) => (
                    <DropdownMenuItem
                      key={col.id}
                      onClick={() => {
                        setCurrentColumnId(col.id);
                        onColumnChange?.(card.id, col.id);
                      }}
                      disabled={col.id === currentColumnId}
                      className={cn(col.id === currentColumnId && "font-semibold bg-accent")}
                    >
                      {col.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {card ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {autoSaving ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Enregistrement...
                    </span>
                  ) : lastSaved ? (
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-600" />
                      Sauvegardé
                    </span>
                  ) : null}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  className="gap-1.5 h-7"
                >
                  <Save className="h-3.5 w-3.5" />
                  Enregistrer
                </Button>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                className="gap-1.5"
              >
                <Save className="h-4 w-4" />
                Enregistrer
              </Button>
            )}
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
            {/* Type de contenu + Newsletter (side by side on large screens) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              {/* Newsletter */}
              {draftNewsletters.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Newsletter
                  </Label>
                  <Select
                    value={attachedNewsletterId || "none"}
                    onValueChange={card ? handleNewsletterChange : setAttachedNewsletterId}
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
                  {attachedNewsletterId && attachedNewsletterId !== "none" && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-600" />
                      {card ? "Rattachée à la newsletter" : "Sera rattachée à la newsletter à l'enregistrement"}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Date limite */}
            <div className="space-y-2">
              <Label htmlFor="deadline" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Date limite
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-auto"
                />
                {deadline && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDeadline("")} className="h-8 px-2 text-xs text-muted-foreground">
                    Supprimer
                  </Button>
                )}
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
                key={card?.id ?? "new"}
                content={description}
                onChange={setDescription}
                placeholder="Description du contenu..."
                className={cn(isFullscreen && "min-h-[400px]")}
              />
            </div>

            {/* Images */}
            <div className="space-y-2">
              <Label>{card ? "Images" : "Image de couverture"}</Label>
              {card ? (
                <>
                  {/* Cover image */}
                  {imageUrl && (
                    <div className="relative group mb-2">
                      <img
                        src={imageUrl}
                        alt="Preview"
                        className="w-full max-h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setImageLightboxOpen(true)}
                      />
                      <Badge className="absolute top-2 left-2 text-[10px]" variant="secondary">Couverture</Badge>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={() => setImageUrl("")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      {imageLightboxOpen && (
                        <ImageLightbox
                          src={imageUrl}
                          alt={title || "Image du contenu"}
                          onClose={() => setImageLightboxOpen(false)}
                        />
                      )}
                    </div>
                  )}
                  {!imageUrl && (
                    <div
                      className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors mb-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">
                        {uploading ? "Téléchargement..." : "Ajouter une image de couverture"}
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
                  {/* Multi-image gallery via EntityMediaManager */}
                  <EntityMediaManager
                    sourceType="content"
                    sourceId={card.id}
                    sourceLabel={title || "Contenu"}
                    variant="bare"
                  />
                </>
              ) : (
                <>
                  {imageUrl ? (
                    <div className="relative group">
                      <img
                        src={imageUrl}
                        alt="Preview"
                        className="w-full max-h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setImageLightboxOpen(true)}
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={() => setImageUrl("")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      {imageLightboxOpen && (
                        <ImageLightbox
                          src={imageUrl}
                          alt={title || "Image du contenu"}
                          onClose={() => setImageLightboxOpen(false)}
                        />
                      )}
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
                </>
              )}
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


            {/* Commentaire initial (création uniquement) */}
            {!card && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Commentaire
                </Label>
                <VoiceTextarea
                  value={initialComment}
                  onValueChange={setInitialComment}
                  onChange={(e) => setInitialComment(e.target.value)}
                  placeholder="Ajouter un commentaire à la carte..."
                  rows={3}
                />
              </div>
            )}

            {/* Section Relecture (flat, pour cartes existantes) */}
            {card && (
              <div className="space-y-2 border rounded-lg p-4">
                <h3 className="font-medium">Relecture</h3>
                <CommentThread cardId={card.id} cardTitle={card.title} />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContentCardDialog;
