import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ReseauChat from "./ReseauChat";
import {
  useNetworkConversation,
  useSendNetworkMessage,
  useUpsertPositioning,
  usePositioning,
} from "@/hooks/useReseau";
import type { NetworkAIResponse } from "@/types/reseau";

interface ReseauOnboardingProps {
  onComplete: () => void;
}

const ReseauOnboarding = ({ onComplete }: ReseauOnboardingProps) => {
  const { toast } = useToast();
  const { data: messages = [] } = useNetworkConversation("onboarding");
  const { data: positioning } = usePositioning();
  const sendMessage = useSendNetworkMessage();
  const upsertPositioning = useUpsertPositioning();
  const [extractedPositioning, setExtractedPositioning] = useState<
    NetworkAIResponse["positioning"] | null
  >(null);

  const handleSend = async (content: string) => {
    try {
      const result = await sendMessage.mutateAsync({
        content,
        phase: "onboarding",
        positioning,
      });
      if (result.positioning) {
        setExtractedPositioning(result.positioning);
      }
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message. Réessayez.",
        variant: "destructive",
      });
    }
  };

  const handleValidate = async () => {
    if (!extractedPositioning) return;
    try {
      await upsertPositioning.mutateAsync(extractedPositioning);
      toast({ title: "Fiche validée !", description: "Votre positionnement a été enregistré." });
      onComplete();
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la fiche.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <ReseauChat
        messages={messages}
        welcomeMessage="Bonjour ! Je vais vous aider à construire votre fiche de positionnement. Commençons par mieux vous connaître : quel est votre parcours professionnel et quelles sont vos expertises principales ?"
        placeholder="Décrivez votre parcours, vos compétences..."
        isLoading={sendMessage.isPending}
        onSend={handleSend}
      />

      {extractedPositioning && (
        <Card className="border-primary">
          <CardContent className="pt-6 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Votre fiche de positionnement
            </h3>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Pitch</p>
              <p className="text-sm">{extractedPositioning.pitch_one_liner}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Compétences clés</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {extractedPositioning.key_skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Client cible</p>
              <p className="text-sm">{extractedPositioning.target_client}</p>
            </div>
            <Button onClick={handleValidate} disabled={upsertPositioning.isPending} className="w-full">
              Valider ma fiche de positionnement
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReseauOnboarding;
