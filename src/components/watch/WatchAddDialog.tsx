import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Link, Image, Mic, FileText, Loader2, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAddWatchItem, uploadWatchFile } from "@/hooks/useWatch";
import { detectContentType, checkDuplicates, processWatchItem } from "@/services/watchProcessing";
import { resolveContentType } from "@/lib/file-utils";

interface WatchAddDialogProps {
  allTags: string[];
}

const WatchAddDialog = ({ allTags }: WatchAddDialogProps) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<string>("text");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addMutation = useAddWatchItem();
  const queryClient = useQueryClient();

  const reset = () => {
    setTitle("");
    setBody("");
    setUrl("");
    setTags([]);
    setTagInput("");
    setFile(null);
    setDuplicateWarning(null);
    setTab("text");
  };

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async () => {
    const contentType = tab as "text" | "url" | "image" | "audio";
    let finalBody = body;
    let sourceUrl: string | null = null;
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;
    let mimeType: string | null = null;

    if (contentType === "url") {
      sourceUrl = url;
      if (!url) {
        toast.error("Veuillez saisir une URL");
        return;
      }
    }

    if ((contentType === "image" || contentType === "audio") && !file) {
      toast.error(`Veuillez sélectionner un fichier ${contentType === "image" ? "image" : "audio"}`);
      return;
    }

    if (contentType === "text" && !body.trim()) {
      toast.error("Veuillez saisir du contenu");
      return;
    }

    setUploading(true);

    try {
      // Check for duplicates
      const dupCheck = await checkDuplicates(finalBody || url, title);
      if (dupCheck.isDuplicate) {
        setDuplicateWarning(`Contenu similaire détecté : "${dupCheck.similarTitle}"`);
        setUploading(false);
        return;
      }

      // Upload file if needed
      if (file && (contentType === "image" || contentType === "audio")) {
        fileUrl = await uploadWatchFile(file);
        fileName = file.name;
        fileSize = file.size;
        mimeType = resolveContentType(file);
      }

      const item = await addMutation.mutateAsync({
        title: title || "(Sans titre)",
        body: finalBody,
        content_type: contentType,
        source_url: sourceUrl,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        tags,
      });

      // Trigger async processing (AI title/tags, scraping, OCR, transcription)
      const processed = await processWatchItem(item.id);
      await queryClient.invalidateQueries({ queryKey: ["watch-items"] });
      await queryClient.invalidateQueries({ queryKey: ["watch-tags"] });

      if (processed) {
        toast.success("Contenu ajouté et traité");
      } else {
        toast.warning("Contenu ajouté mais le traitement IA a échoué (OCR, tags, etc.). Vérifiez la configuration OPENAI_API_KEY.");
      }
      reset();
      setOpen(false);
    } catch (error) {
      console.error("Error adding watch item:", error);
      toast.error("Erreur lors de l'ajout");
    } finally {
      setUploading(false);
    }
  };

  const forceSaveDuplicate = async () => {
    setDuplicateWarning(null);
    setUploading(true);
    try {
      const contentType = tab as "text" | "url" | "image" | "audio";
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;
      let mimeType: string | null = null;

      if (file && (contentType === "image" || contentType === "audio")) {
        fileUrl = await uploadWatchFile(file);
        fileName = file.name;
        fileSize = file.size;
        mimeType = resolveContentType(file);
      }

      const item = await addMutation.mutateAsync({
        title: title || "(Sans titre)",
        body,
        content_type: contentType,
        source_url: contentType === "url" ? url : null,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        tags,
      });

      const processed = await processWatchItem(item.id);
      await queryClient.invalidateQueries({ queryKey: ["watch-items"] });
      await queryClient.invalidateQueries({ queryKey: ["watch-tags"] });
      if (processed) {
        toast.success("Contenu ajouté et traité (doublon ignoré)");
      } else {
        toast.warning("Contenu ajouté mais le traitement IA a échoué. Vérifiez la configuration OPENAI_API_KEY.");
      }
      reset();
      setOpen(false);
    } catch {
      toast.error("Erreur lors de l'ajout");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Ajouter
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter un contenu de veille</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="text" className="gap-1.5 flex-1">
              <FileText className="h-3.5 w-3.5" />
              Texte
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-1.5 flex-1">
              <Link className="h-3.5 w-3.5" />
              URL
            </TabsTrigger>
            <TabsTrigger value="image" className="gap-1.5 flex-1">
              <Image className="h-3.5 w-3.5" />
              Image
            </TabsTrigger>
            <TabsTrigger value="audio" className="gap-1.5 flex-1">
              <Mic className="h-3.5 w-3.5" />
              Audio
            </TabsTrigger>
          </TabsList>

          <div className="space-y-3 mt-4">
            {/* Title (optional — AI will auto-fill if empty) */}
            <div>
              <Label htmlFor="watch-title">Titre (optionnel — auto-généré par IA)</Label>
              <Input
                id="watch-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Laissez vide pour auto-détection"
              />
            </div>

            <TabsContent value="text" className="mt-0">
              <Label htmlFor="watch-body">Contenu</Label>
              <Textarea
                id="watch-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Collez ou saisissez votre contenu de veille ici..."
                rows={6}
              />
            </TabsContent>

            <TabsContent value="url" className="mt-0">
              <Label htmlFor="watch-url">URL</Label>
              <Input
                id="watch-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Le contenu sera automatiquement scrappé si possible.
              </p>
            </TabsContent>

            <TabsContent value="image" className="mt-0">
              <Label>Image</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <Image className="h-5 w-5 text-primary" />
                    <span className="text-sm">{file.name}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Image className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Cliquez pour sélectionner une image</p>
                    <p className="text-xs text-muted-foreground mt-1">Le texte sera extrait par OCR</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                }}
              />
            </TabsContent>

            <TabsContent value="audio" className="mt-0">
              <Label>Fichier audio</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <Mic className="h-5 w-5 text-primary" />
                    <span className="text-sm">{file.name}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Mic className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Cliquez pour sélectionner un fichier audio</p>
                    <p className="text-xs text-muted-foreground mt-1">Transcription automatique via AssemblyAI</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                }}
              />
            </TabsContent>

            {/* Tags */}
            <div>
              <Label>Tags (optionnel — auto-générés par IA)</Label>
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
                  list="watch-tag-suggestions"
                />
                <datalist id="watch-tag-suggestions">
                  {allTags.filter((t) => !tags.includes(t)).map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                <Button variant="outline" size="sm" onClick={() => addTag(tagInput)} disabled={!tagInput.trim()}>
                  +
                </Button>
              </div>
            </div>

            {/* Duplicate warning */}
            {duplicateWarning && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p>{duplicateWarning}</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={forceSaveDuplicate}>
                      Sauvegarder quand même
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDuplicateWarning(null)}>
                      Modifier
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Button onClick={handleSubmit} disabled={uploading} className="w-full">
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                "Ajouter"
              )}
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default WatchAddDialog;
