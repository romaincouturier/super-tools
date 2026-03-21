import { useState, useRef } from "react";
import { Loader2, CheckCircle2, Paperclip, X, ImageIcon, FileIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useCreateSupportTicket, useAnalyzeTicket } from "@/hooks/useSupport";
import { resolveContentType } from "@/lib/file-utils";

const MAX_FILES = 5;
const ACCEPTED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
];

function isImageType(mime: string) {
  return mime.startsWith("image/");
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function ChatbotFeedbackTab() {
  const { toast } = useToast();
  const createTicket = useCreateSupportTicket();
  const analyzeTicket = useAnalyzeTicket();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const currentUrl = typeof window !== "undefined" ? window.location.pathname : "";
  const isSubmitting = analyzeTicket.isPending || createTicket.isPending;

  const addFiles = (newFiles: FileList | File[]) => {
    const toAdd: File[] = [];
    for (const file of Array.from(newFiles)) {
      if (!ACCEPTED_TYPES.includes(resolveContentType(file))) {
        toast({ title: "Type non supporté", description: `"${file.name}" n'est pas un format accepté.`, variant: "destructive" });
        continue;
      }
      toAdd.push(file);
    }
    setFiles((prev) => {
      const combined = [...prev, ...toAdd];
      if (combined.length > MAX_FILES) {
        toast({ title: "Limite atteinte", description: `Maximum ${MAX_FILES} fichiers.`, variant: "destructive" });
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({ title: "Champ requis", description: "Veuillez décrire votre problème ou votre idée.", variant: "destructive" });
      return;
    }

    try {
      // Step 1: AI analysis (same as Support page)
      const analysis = await analyzeTicket.mutateAsync(description.trim());

      // Step 2: Create ticket with AI-generated fields
      await createTicket.mutateAsync({
        type: analysis.type,
        title: analysis.title,
        description: description.trim(),
        priority: analysis.priority,
        page_url: currentUrl || null,
        ai_analysis: analysis,
        files: files.length > 0 ? files : undefined,
      });

      setSubmitted(true);
      toast({
        title: "Ticket créé",
        description: `L'IA a classifié votre demande comme ${analysis.type === "bug" ? "un bug" : "une évolution"}.`,
      });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'envoyer votre retour. Réessayez.", variant: "destructive" });
    }
  };

  const handleReset = () => {
    setDescription("");
    setFiles([]);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Merci pour votre retour !</p>
          <p className="text-sm text-muted-foreground mt-1">
            Votre demande a été analysée par l'IA et enregistrée.
            Vous pouvez suivre son avancement dans le module Support.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          Envoyer un autre retour
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Décrivez votre problème ou votre idée. L'IA se charge de classifier et structurer votre demande.
        </p>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="fb-desc" className="text-xs font-medium">Décrivez votre problème ou votre idée *</Label>
          <Textarea
            id="fb-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez ce qui ne fonctionne pas, ou l'amélioration que vous souhaitez..."
            rows={6}
            className="text-sm"
          />
        </div>

        {/* File attachments */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Capture d'écran (optionnel)</Label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= MAX_FILES}
          >
            <Paperclip className="h-3.5 w-3.5 mr-2" />
            Ajouter des fichiers
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Images, PDF, Word, Excel — {MAX_FILES} fichiers max
          </p>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm"
                >
                  {isImageType(resolveContentType(file)) ? (
                    <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  ) : (
                    <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate flex-1 text-xs">{file.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="p-0.5 rounded hover:bg-muted transition-colors shrink-0"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Page context */}
        {currentUrl && currentUrl !== "/" && (
          <p className="text-xs text-muted-foreground">
            Page concernée : <span className="font-mono">{currentUrl}</span>
          </p>
        )}

        {/* AI info banner */}
        <div className="rounded-lg bg-muted/50 border border-dashed p-3 text-xs text-muted-foreground flex items-start gap-2">
          <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          <span>L'IA va analyser votre demande pour la classifier automatiquement (bug ou évolution), définir sa priorité et structurer le ticket.</span>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !description.trim()}
          className="w-full"
          size="sm"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {analyzeTicket.isPending ? "Analyse IA en cours..." : "Création du ticket..."}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Soumettre la demande
            </>
          )}
        </Button>
      </div>
    </ScrollArea>
  );
}
