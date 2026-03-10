import { useState, useRef } from "react";
import { Bug, Lightbulb, Send, Loader2, CheckCircle2, Paperclip, X, ImageIcon, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useCreateSupportTicket } from "@/hooks/useSupport";
import type { TicketType } from "@/types/support";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<TicketType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const currentUrl = typeof window !== "undefined" ? window.location.pathname : "";

  const addFiles = (newFiles: FileList | File[]) => {
    const toAdd: File[] = [];
    for (const file of Array.from(newFiles)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast({ title: "Type non supporté", description: `"${file.name}" n'est pas un format accepté.`, variant: "destructive" });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: "Fichier trop volumineux", description: `"${file.name}" dépasse 10 Mo.`, variant: "destructive" });
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
    if (!title.trim() || !description.trim()) {
      toast({ title: "Champs requis", description: "Veuillez remplir le titre et la description.", variant: "destructive" });
      return;
    }

    try {
      await createTicket.mutateAsync({
        type,
        title: title.trim(),
        description: description.trim(),
        priority: "medium",
        page_url: currentUrl || null,
        files: files.length > 0 ? files : undefined,
      });
      setSubmitted(true);
    } catch (e: any) {
      toast({ title: "Erreur", description: "Impossible d'envoyer votre retour. Réessayez.", variant: "destructive" });
    }
  };

  const handleReset = () => {
    setType("bug");
    setTitle("");
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
            Votre {type === "bug" ? "signalement de bug" : "demande d'évolution"} a bien été enregistré(e).
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
          Signalez un bug ou proposez une amélioration. Votre retour sera traité par l'équipe.
        </p>

        {/* Type */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Type de retour</Label>
          <RadioGroup value={type} onValueChange={(v) => setType(v as TicketType)} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="bug" id="feedback-bug" />
              <Label htmlFor="feedback-bug" className="font-normal cursor-pointer flex items-center gap-1.5 text-sm">
                <Bug className="h-3.5 w-3.5 text-red-500" />Bug
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="evolution" id="feedback-evo" />
              <Label htmlFor="feedback-evo" className="font-normal cursor-pointer flex items-center gap-1.5 text-sm">
                <Lightbulb className="h-3.5 w-3.5 text-violet-500" />Évolution
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="fb-title" className="text-xs font-medium">Titre *</Label>
          <Input
            id="fb-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === "bug" ? "Ex: Le formulaire se recharge tout seul" : "Ex: Ajouter un export PDF"}
            className="text-sm"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="fb-desc" className="text-xs font-medium">Description *</Label>
          <Textarea
            id="fb-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={type === "bug" ? "Décrivez le problème : ce que vous faisiez, ce qui s'est passé, ce que vous attendiez..." : "Décrivez votre besoin et en quoi ça améliorerait votre utilisation..."}
            rows={4}
            className="text-sm"
          />
        </div>

        {/* File attachments */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Pièces jointes</Label>
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
            Images, PDF, Word, Excel — max 10 Mo/fichier, {MAX_FILES} fichiers max
          </p>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm"
                >
                  {isImageType(file.type) ? (
                    <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  ) : (
                    <FileIcon className="h-3.5 w-3.5 text-gray-500 shrink-0" />
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

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={createTicket.isPending || !title.trim() || !description.trim()}
          className="w-full"
          size="sm"
        >
          {createTicket.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Envoi...</>
          ) : (
            <><Send className="h-4 w-4 mr-2" />Envoyer</>
          )}
        </Button>
      </div>
    </ScrollArea>
  );
}
