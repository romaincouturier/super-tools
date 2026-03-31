import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  FileText, Link, Image, Mic, ExternalLink, Trash2,
  Share2, MoreVertical, Copy, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import type { WatchItem } from "@/hooks/useWatch";
import { useDeleteWatchItem, useToggleWatchShared } from "@/hooks/useWatch";

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
  const deleteMutation = useDeleteWatchItem();
  const toggleSharedMutation = useToggleWatchShared();

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
    navigator.clipboard.writeText(item.body || item.source_url || "");
    toast.success("Copié dans le presse-papiers");
  };

  const bodyPreview = item.body?.length > 200 && !expanded
    ? item.body.slice(0, 200) + "..."
    : item.body;

  const freshness = Math.round(item.relevance_score);

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

      {/* Audio player */}
      {item.content_type === "audio" && item.file_url && (
        <audio controls className="w-full" preload="metadata">
          <source src={item.file_url} type={item.mime_type || "audio/mpeg"} />
        </audio>
      )}

      {/* Body */}
      {item.body && (
        <div
          className="text-sm text-muted-foreground whitespace-pre-wrap cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {bodyPreview}
          {item.body.length > 200 && (
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
        <div className="flex flex-wrap gap-1">
          {(item.tags || []).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
              {tag}
            </Badge>
          ))}
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
