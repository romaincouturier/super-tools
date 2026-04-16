import { useState, useRef, useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  FileText, Link, Image, Mic, ExternalLink, Trash2,
  Share2, MoreVertical, Copy, Clock, Plus, X,
} from "lucide-react";
import { stripWatchHtml } from "./WatchRichEditor";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import type { WatchItem } from "@/hooks/useWatch";
import { useDeleteWatchItem, useToggleWatchShared, useUpdateWatchItem, useWatchTags } from "@/hooks/useWatch";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

interface WatchItemCardProps {
  item: WatchItem;
}

const contentTypeConfig: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  text: { icon: FileText, label: "Texte", color: "bg-blue-100 text-blue-700" },
  url: { icon: Link, label: "URL", color: "bg-green-100 text-green-700" },
  image: { icon: Image, label: "Image", color: "bg-purple-100 text-purple-700" },
  audio: { icon: Mic, label: "Audio", color: "bg-orange-100 text-orange-700" },
};

const WatchItemCard = ({ item }: WatchItemCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);
  const deleteMutation = useDeleteWatchItem();
  const toggleSharedMutation = useToggleWatchShared();
  const updateMutation = useUpdateWatchItem();
  const { data: allTags } = useWatchTags();
  const { copy } = useCopyToClipboard();

  useEffect(() => {
    if (editingTags) tagInputRef.current?.focus();
  }, [editingTags]);

  const config = contentTypeConfig[item.content_type] || contentTypeConfig.text;
  const Icon = config.icon;

  const handleDelete = async () => {
    if (!confirm(`Supprimer "${item.title}" ?`)) return;
    try {
      await deleteMutation.mutateAsync(item.id);
      toast.success("Contenu supprimé");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleToggleShared = async () => {
    try {
      await toggleSharedMutation.mutateAsync({ id: item.id, is_shared: !item.is_shared });
      toast.success(item.is_shared ? "Retiré du partage" : "Marqué à partager");
    } catch {
      toast.error("Erreur");
    }
  };

  const handleCopyBody = () => {
    // Clipboard gets plain text (strip HTML tags from rich bodies).
    const plain = item.body ? stripWatchHtml(item.body) : (item.source_url || "");
    copy(plain, { title: "Copié dans le presse-papiers" });
  };

  const handleAddTag = async () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag) return;
    const currentTags = item.tags || [];
    if (currentTags.includes(tag)) {
      setTagInput("");
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: item.id, tags: [...currentTags, tag] });
      setTagInput("");
    } catch {
      toast.error("Erreur lors de l'ajout du tag");
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const newTags = (item.tags || []).filter((t) => t !== tagToRemove);
    try {
      await updateMutation.mutateAsync({ id: item.id, tags: newTags });
    } catch {
      toast.error("Erreur lors de la suppression du tag");
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === "Escape") {
      setEditingTags(false);
      setTagInput("");
    }
  };

  // `body` now stores HTML (rich paste with images/formatting). Legacy
  // rows are plain text — both render correctly via dangerouslySetInnerHTML
  // below (plain text shows as-is thanks to `white-space: pre-wrap`).
  const isHtml = useMemo(() => /<(p|div|br|h\d|ul|ol|li|img|strong|em|a|b|i|u|span)[\s>]/i.test(item.body || ""), [item.body]);
  const plainBodyLen = useMemo(() => (isHtml ? stripWatchHtml(item.body || "").length : (item.body?.length || 0)), [isHtml, item.body]);
  const sanitizedBody = useMemo(() => DOMPurify.sanitize(item.body || ""), [item.body]);
  const bodyPreviewHtml = useMemo(() => {
    if (expanded || plainBodyLen <= 200) return sanitizedBody;
    // Collapsed preview: strip to plain text and slice to avoid cutting HTML tags.
    const plain = stripWatchHtml(item.body || "").slice(0, 200) + "…";
    return plain.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }, [expanded, plainBodyLen, sanitizedBody, item.body]);

  const freshness = Math.round(item.relevance_score);

  // Suggestions: all tags not already on this item
  const suggestions = (allTags || []).filter((t) => !(item.tags || []).includes(t));

  return (
    <Card className="p-4 space-y-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <Badge variant="secondary" className={`${config.color} text-[10px] px-1.5 py-0 flex-shrink-0 gap-1`}>
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
          <h3 className="text-sm font-medium leading-tight truncate">{item.title}</h3>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {item.is_shared && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-700 gap-1">
              <Share2 className="h-2.5 w-2.5" />
              À partager
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopyBody}>
                <Copy className="h-4 w-4 mr-2" />
                Copier le contenu
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleShared}>
                <Share2 className="h-4 w-4 mr-2" />
                {item.is_shared ? "Retirer du partage" : "Marquer à partager"}
              </DropdownMenuItem>
              {item.source_url && (
                <DropdownMenuItem onClick={() => window.open(item.source_url!, "_blank")}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ouvrir l'URL
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Image preview */}
      {item.content_type === "image" && item.file_url && (
        <img
          src={item.file_url}
          alt={item.title}
          className="w-full max-h-48 object-cover rounded-md"
          loading="lazy"
        />
      )}

      {/* OCR transcript for images */}
      {item.content_type === "image" && item.transcript && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">📝 Texte extrait (OCR)</summary>
          <p className="mt-1 whitespace-pre-wrap bg-muted/50 rounded p-2">{item.transcript}</p>
        </details>
      )}

      {/* Audio player */}
      {item.content_type === "audio" && item.file_url && (
        <audio controls className="w-full" preload="metadata">
          <source src={item.file_url} type={item.mime_type || "audio/mpeg"} />
        </audio>
      )}

      {/* Body */}
      {item.body && (
        <div
          className="text-sm text-muted-foreground cursor-pointer prose prose-sm max-w-none prose-img:my-2 prose-img:rounded whitespace-pre-wrap"
          onClick={() => setExpanded(!expanded)}
        >
          <div dangerouslySetInnerHTML={{ __html: bodyPreviewHtml }} />
          {plainBodyLen > 200 && (
            <span className="text-primary text-xs ml-1">
              {expanded ? "Voir moins" : "Voir plus"}
            </span>
          )}
        </div>
      )}

      {/* URL */}
      {item.content_type === "url" && item.source_url && (
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1 truncate"
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
          {item.source_url}
        </a>
      )}

      {/* Footer: tags + meta */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {(item.tags || []).map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[10px] px-1.5 py-0 gap-0.5 cursor-pointer hover:bg-destructive/10 hover:border-destructive/50 group"
              onClick={() => handleRemoveTag(tag)}
            >
              {tag}
              <X className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Badge>
          ))}
          {editingTags ? (
            <div className="flex items-center gap-1">
              <Input
                ref={tagInputRef}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => { handleAddTag(); setEditingTags(false); }}
                placeholder="Nouveau tag..."
                className="h-5 w-24 text-[10px] px-1.5 py-0"
                list="watch-tag-suggestions"
              />
              <datalist id="watch-tag-suggestions">
                {suggestions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          ) : (
            <button
              onClick={() => setEditingTags(true)}
              className="h-5 px-1 rounded border border-dashed border-muted-foreground/30 text-[10px] text-muted-foreground hover:border-foreground/50 hover:text-foreground transition-colors flex items-center"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
          {/* Freshness indicator */}
          <span className={`flex items-center gap-0.5 ${freshness > 70 ? "text-green-600" : freshness > 30 ? "text-yellow-600" : "text-red-500"}`}>
            <Clock className="h-3 w-3" />
            {freshness}%
          </span>
          {/* Relative time */}
          <span>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: fr })}
          </span>
        </div>
      </div>
    </Card>
  );
};

export default WatchItemCard;
