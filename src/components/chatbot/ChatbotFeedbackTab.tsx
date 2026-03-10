import { useState } from "react";
import { Bug, Lightbulb, Send, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useCreateSupportTicket } from "@/hooks/useSupport";
import type { TicketType, TicketPriority } from "@/types/support";

export function ChatbotFeedbackTab() {
  const { toast } = useToast();
  const createTicket = useCreateSupportTicket();

  const [type, setType] = useState<TicketType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [submitted, setSubmitted] = useState(false);

  const currentUrl = typeof window !== "undefined" ? window.location.pathname : "";

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
        priority,
        page_url: currentUrl || null,
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
    setPriority("medium");
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

        {/* Priority */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Priorité</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Basse</SelectItem>
              <SelectItem value="medium">Moyenne</SelectItem>
              <SelectItem value="high">Haute</SelectItem>
              <SelectItem value="critical">Critique</SelectItem>
            </SelectContent>
          </Select>
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
