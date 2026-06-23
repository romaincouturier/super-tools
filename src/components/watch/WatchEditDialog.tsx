import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import type { WatchItem } from "@/hooks/useWatch";
import { useUpdateWatchItem, useWatchTags } from "@/hooks/useWatch";
import WatchRichEditor from "./WatchRichEditor";

interface WatchEditDialogProps {
  item: WatchItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WatchEditDialog = ({ item, open, onOpenChange }: WatchEditDialogProps) => {
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [comment, setComment] = useState(item.comment ?? "");
  const [sourceUrl, setSourceUrl] = useState(item.source_url ?? "");
  const [tags, setTags] = useState<string[]>(item.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Resync form state each time the dialog opens (avoids stale values after a mutation).
  useEffect(() => {
    if (open) {
      setTitle(item.title);
      setBody(item.body);
      setComment(item.comment ?? "");
      setSourceUrl(item.source_url ?? "");
      setTags(item.tags || []);
      setTagInput("");
    }
  }, [open]);

  const updateMutation = useUpdateWatchItem();
  const { data: allTags } = useWatchTags();

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        title: title.trim() || "(Sans titre)",
        body,
        comment: comment.trim(),
        ...(item.content_type === "url" ? { source_url: sourceUrl.trim() || null } : {}),
        tags,
      });
      toast.success("Modifications enregistrées");
      onOpenChange(false);
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const suggestions = (allTags || []).filter((t) => !tags.includes(t));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier la carte de veille</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-watch-title">Titre</Label>
            <Input
              id="edit-watch-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de la carte"
            />
          </div>

          {item.content_type === "text" && open && (
            <div>
              <Label>Contenu</Label>
              <WatchRichEditor
                content={body}
                onChange={setBody}
                placeholder="Contenu de la carte…"
              />
            </div>
          )}

          {item.content_type === "url" && (
            <div>
              <Label htmlFor="edit-watch-url">URL</Label>
              <Input
                id="edit-watch-url"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com/article"
              />
            </div>
          )}

          <div>
            <Label htmlFor="edit-watch-comment">Commentaire</Label>
            <Textarea
              id="edit-watch-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Pourquoi ce contenu est intéressant…"
              rows={2}
            />
          </div>

          <div>
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Ajouter un tag..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                list="watch-edit-tag-suggestions"
              />
              <datalist id="watch-edit-tag-suggestions">
                {suggestions.map((t) => <option key={t} value={t} />)}
              </datalist>
              <Button variant="outline" size="sm" onClick={() => addTag(tagInput)} disabled={!tagInput.trim()}>
                +
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Spinner className="mr-2" />Sauvegarde…</> : "Enregistrer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WatchEditDialog;
