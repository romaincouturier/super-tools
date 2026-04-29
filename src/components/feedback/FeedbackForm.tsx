import { useState, useRef } from "react";
import { CheckCircle2, Paperclip, X, ImageIcon, FileIcon, Sparkles, Mic, MicOff } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useCreateSupportTicket, useAnalyzeTicket } from "@/hooks/useSupport";
import { resolveContentType } from "@/lib/file-utils";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

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

export interface FeedbackFormProps {
  /** Initial description text — useful for prefilling context (e.g. "Mission : ...") */
  prefillDescription?: string;
  /** Override the page URL stored on the ticket. Defaults to window.location.pathname. */
  pageUrlOverride?: string | null;
  /** Called after a successful submission. */
  onSubmitted?: () => void;
}

export function FeedbackForm({ prefillDescription, pageUrlOverride, onSubmitted }: FeedbackFormProps) {
  const { toast } = useToast();
  const createTicket = useCreateSupportTicket();
  const analyzeTicket = useAnalyzeTicket();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState(prefillDescription ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const { isListening, isSupported: micSupported, startListening, stopListening } =
    useSpeechRecognition("fr-FR", true);

  const toggleDictation = () => {
    if (isListening) {
      stopListening();
      return;
    }
    startListening((text) => {
      setDescription((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    });
  };

  const fallbackUrl = typeof window !== "undefined" ? window.location.pathname : "";
  const ticketUrl = pageUrlOverride !== undefined ? pageUrlOverride : fallbackUrl;
  const isSubmitting = analyzeTicket.isPending || createTicket.isPending;

  const addFiles = (newFiles: FileList | File[]) => {
    const toAdd: File[] = [];
    for (const file of Array.from(newFiles)) {
      if (!ACCEPTED_TYPES.includes(resolveContentType(file))) {
        toastError(toast, `"${file.name}" n'est pas un format accepté.`, { title: "Type non supporté" });
        continue;
      }
      toAdd.push(file);
    }
    setFiles((prev) => {
      const combined = [...prev, ...toAdd];
      if (combined.length > MAX_FILES) {
        toastError(toast, `Maximum ${MAX_FILES} fichiers.`, { title: "Limite atteinte" });
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
      toastError(toast, "Veuillez décrire votre problème ou votre idée.", { title: "Champ requis" });
      return;
    }
    if (isListening) stopListening();

    try {
      const analysis = await analyzeTicket.mutateAsync(description.trim());

      await createTicket.mutateAsync({
        type: analysis.type,
        title: analysis.title,
        description: description.trim(),
        priority: analysis.priority,
        page_url: ticketUrl || null,
        ai_analysis: analysis,
        files: files.length > 0 ? files : undefined,
      });

      setSubmitted(true);
      onSubmitted?.();
      toast({
        title: "Ticket créé",
        description: `L'IA a classifié votre demande comme ${analysis.type === "bug" ? "un bug" : "une évolution"}.`,
      });
    } catch {
      toastError(toast, "Impossible d'envoyer votre retour. Réessayez.");
    }
  };

  const handleReset = () => {
    if (isListening) stopListening();
    setDescription(prefillDescription ?? "");
    setFiles([]);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center gap-4">
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
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Décrivez votre problème ou votre idée. L'IA se charge de classifier et structurer votre demande.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="fb-desc" className="text-xs font-medium">Décrivez votre problème ou votre idée *</Label>
          <div className="relative">
            <Textarea
              id="fb-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez ce qui ne fonctionne pas, ou l'amélioration que vous souhaitez..."
              rows={6}
              className={`text-sm ${micSupported ? "pr-10" : ""}`}
            />
            {micSupported && (
              <button
                type="button"
                onClick={toggleDictation}
                className={`absolute right-2 top-2 rounded-md p-1.5 transition-colors ${
                  isListening
                    ? "bg-destructive/10 text-destructive animate-pulse"
                    : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                }`}
                aria-label={isListening ? "Arrêter la dictée" : "Dicter la description"}
                title={isListening ? "Arrêter la dictée" : "Dicter la description"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
          </div>
          {isListening && (
            <p className="text-[11px] text-destructive">
              Dictée en cours… cliquez sur le micro pour arrêter.
            </p>
          )}
        </div>

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

        {ticketUrl && ticketUrl !== "/" && (
          <p className="text-xs text-muted-foreground">
            Page concernée : <span className="font-mono">{ticketUrl}</span>
          </p>
        )}

        <div className="rounded-lg bg-muted/50 border border-dashed p-3 text-xs text-muted-foreground flex items-start gap-2">
          <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          <span>L'IA va analyser votre demande pour la classifier automatiquement (bug ou évolution), définir sa priorité et structurer le ticket.</span>
        </div>
      </div>

      <div className="shrink-0 border-t bg-background p-3">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !description.trim()}
          className="w-full"
          size="sm"
        >
          {isSubmitting ? (
            <>
              <Spinner className="mr-2" />
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
    </div>
  );
}
