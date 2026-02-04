import { useState, useEffect, useRef } from "react";
import { Upload, X, Plus, Maximize2, Minimize2, RefreshCw, FileText, Linkedin, Instagram, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Card } from "./KanbanBoard";
import ReviewSection from "./ReviewSection";
import RichTextEditor from "./RichTextEditor";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  const [uploading, setUploading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aiLoading, setAiLoading] = useState<AiActionType | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || "");
      setImageUrl(card.image_url || "");
      setTags(card.tags || []);
    } else {
      setTitle("");
      setDescription("");
      setImageUrl("");
      setTags([]);
    }
  }, [card, open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsFullscreen(false);
      setReviewOpen(false);
      setAiLoading(null);
    }
  }, [open]);

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
    });
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-y-auto transition-all duration-300",
          isFullscreen
            ? "max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh]"
            : "max-w-3xl"
        )}
      >
        <DialogHeader className="flex flex-row items-center justify-between pr-8">
          <DialogTitle>
            {card ? "Modifier la carte" : "Nouvelle carte"}
          </DialogTitle>
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
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Titre */}
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la carte"
            />
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

          {/* Section Relecture (collapsible, pour cartes existantes) */}
          {card && (
            <Collapsible open={reviewOpen} onOpenChange={setReviewOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-3 h-auto border rounded-lg hover:bg-muted/50"
                >
                  <span className="font-medium">Relecture</span>
                  {reviewOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <ReviewSection cardId={card.id} cardTitle={card.title} />
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ContentCardDialog;
