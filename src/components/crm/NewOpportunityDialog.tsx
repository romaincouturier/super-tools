import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, User, Building2, Phone, Mail, Linkedin, FileText } from "lucide-react";
import { useExtractOpportunity, useCreateCard, useCrmBoard } from "@/hooks/useCrmBoard";
import { OpportunityExtraction, BriefQuestion } from "@/types/crm";

interface NewOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
}

export function NewOpportunityDialog({ open, onOpenChange, userEmail }: NewOpportunityDialogProps) {
  const [step, setStep] = useState<"input" | "review">("input");
  const [rawInput, setRawInput] = useState("");
  const [extraction, setExtraction] = useState<OpportunityExtraction | null>(null);
  const [editedExtraction, setEditedExtraction] = useState<OpportunityExtraction | null>(null);

  const { data: boardData } = useCrmBoard();
  const extractMutation = useExtractOpportunity();
  const createCardMutation = useCreateCard();

  // Find "Entrant" column (first column for new opportunities)
  const entrantColumn = boardData?.columns.find((col) => col.name === "Entrant") || boardData?.columns[0];

  const handleExtract = async () => {
    if (!rawInput.trim()) return;

    try {
      const result = await extractMutation.mutateAsync(rawInput);
      setExtraction(result);
      setEditedExtraction(result);
      setStep("review");
    } catch {
      // Error handled by mutation
    }
  };

  const handleCreate = async () => {
    if (!editedExtraction || !entrantColumn) return;

    try {
      await createCardMutation.mutateAsync({
        input: {
          column_id: entrantColumn.id,
          title: editedExtraction.title,
          first_name: editedExtraction.first_name || undefined,
          last_name: editedExtraction.last_name || undefined,
          phone: editedExtraction.phone || undefined,
          company: editedExtraction.company || undefined,
          email: editedExtraction.email || undefined,
          linkedin_url: editedExtraction.linkedin_url || undefined,
          service_type: editedExtraction.service_type || undefined,
          brief_questions: editedExtraction.brief_questions,
          raw_input: rawInput,
          description_html: rawInput
            .replace(/\r\n/g, "\n")
            .replace(/[\u2028\u2029]/g, "\n") // Normalize Unicode line separators
            .replace(/\n[ \t]*\n/g, "\n\n") // Treat blank lines (with optional whitespace) as paragraph breaks
            .replace(/\n{3,}/g, "\n\n") // Collapse 3+ newlines into paragraph break
            .split("\n\n") // Split on double newlines = paragraphs
            .map((paragraph) => {
              const lines = paragraph.split("\n").map((line) =>
                line
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
              );
              return `<p>${lines.join("<br>") || "<br>"}</p>`;
            })
            .join(""), // Single \n = <br>, double \n\n = new <p>
        },
        actorEmail: userEmail,
      });

      // Reset and close
      setStep("input");
      setRawInput("");
      setExtraction(null);
      setEditedExtraction(null);
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleClose = () => {
    setStep("input");
    setRawInput("");
    setExtraction(null);
    setEditedExtraction(null);
    onOpenChange(false);
  };

  const updateField = (field: keyof OpportunityExtraction, value: string | null) => {
    if (!editedExtraction) return;
    setEditedExtraction({ ...editedExtraction, [field]: value });
  };

  const updateQuestion = (id: string, question: string) => {
    if (!editedExtraction) return;
    const updatedQuestions = editedExtraction.brief_questions.map((q) =>
      q.id === id ? { ...q, question } : q
    );
    setEditedExtraction({ ...editedExtraction, brief_questions: updatedQuestions });
  };

  const removeQuestion = (id: string) => {
    if (!editedExtraction) return;
    const updatedQuestions = editedExtraction.brief_questions.filter((q) => q.id !== id);
    setEditedExtraction({ ...editedExtraction, brief_questions: updatedQuestions });
  };

  const addQuestion = () => {
    if (!editedExtraction) return;
    const newQuestion: BriefQuestion = {
      id: crypto.randomUUID(),
      question: "",
      answered: false,
    };
    setEditedExtraction({
      ...editedExtraction,
      brief_questions: [...editedExtraction.brief_questions, newQuestion],
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Nouvelle opportunité
          </DialogTitle>
          <DialogDescription>
            {step === "input"
              ? "Collez les informations du prospect (email, message, notes...) et l'IA extraira les données."
              : "Vérifiez et ajustez les informations extraites avant de créer l'opportunité."}
          </DialogDescription>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="raw-input">Informations du prospect</Label>
              <Textarea
                id="raw-input"
                placeholder="Collez ici l'email, le message ou les notes concernant le prospect...

Exemple:
Bonjour, je suis Jean Dupont de la société Acme.
Nous recherchons une formation en management pour 10 personnes.
Mon email: jean.dupont@acme.fr
Tel: 06 12 34 56 78"
                className="mt-2 min-h-[200px]"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
              />
            </div>
          </div>
        ) : editedExtraction ? (
          <div className="space-y-6">
            {/* Title */}
            <div>
              <Label htmlFor="title">Titre de l'opportunité</Label>
              <Input
                id="title"
                value={editedExtraction.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="mt-2"
              />
            </div>

            {/* Service type badge */}
            <div className="flex gap-2">
              <Badge
                variant={editedExtraction.service_type === "formation" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => updateField("service_type", "formation")}
              >
                Formation
              </Badge>
              <Badge
                variant={editedExtraction.service_type === "mission" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => updateField("service_type", "mission")}
              >
                Mission
              </Badge>
            </div>

            {/* Contact info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Prénom
                </Label>
                <Input
                  value={editedExtraction.first_name || ""}
                  onChange={(e) => updateField("first_name", e.target.value || null)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Nom
                </Label>
                <Input
                  value={editedExtraction.last_name || ""}
                  onChange={(e) => updateField("last_name", e.target.value || null)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Entreprise
                </Label>
                <Input
                  value={editedExtraction.company || ""}
                  onChange={(e) => updateField("company", e.target.value || null)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Téléphone
                </Label>
                <Input
                  value={editedExtraction.phone || ""}
                  onChange={(e) => updateField("phone", e.target.value || null)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Email
                </Label>
                <Input
                  value={editedExtraction.email || ""}
                  onChange={(e) => updateField("email", e.target.value || null)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <Linkedin className="h-3 w-3" />
                  LinkedIn
                </Label>
                <Input
                  value={editedExtraction.linkedin_url || ""}
                  onChange={(e) => updateField("linkedin_url", e.target.value || null)}
                  placeholder="https://linkedin.com/in/..."
                  className="mt-1"
                />
              </div>
            </div>

            {/* Brief questions */}
            <div>
              <Label className="flex items-center gap-1 mb-2">
                <FileText className="h-3 w-3" />
                Questions pour le brief
              </Label>
              <div className="space-y-2">
                {editedExtraction.brief_questions.map((q) => (
                  <div key={q.id} className="flex gap-2">
                    <Input
                      value={q.question}
                      onChange={(e) => updateQuestion(q.id, e.target.value)}
                      placeholder="Question..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(q.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                  + Ajouter une question
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          {step === "input" ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button
                onClick={handleExtract}
                disabled={!rawInput.trim() || extractMutation.isPending}
              >
                {extractMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extraction...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Extraire avec l'IA
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("input")}>
                Retour
              </Button>
              <Button onClick={handleCreate} disabled={createCardMutation.isPending}>
                {createCardMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Créer l'opportunité"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
