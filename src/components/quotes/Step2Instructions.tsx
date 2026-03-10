import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mic, MicOff, FileText } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

interface Props {
  onValidate: (instructions: string) => void;
  initialInstructions?: string;
}

export default function Step2Instructions({
  onValidate,
  initialInstructions,
}: Props) {
  const [instructions, setInstructions] = useState(initialInstructions || "");
  const { isListening, isSupported, startListening, stopListening } =
    useSpeechRecognition("fr-FR", true);

  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening((text) => {
        setInstructions((prev) => (prev ? prev + "\n" + text : text));
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Instructions pour le devis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <FileText className="w-4 h-4" />
            <AlertDescription>
              Décrivez les prestations, durées, tarifs et conditions
              particulières. Vous pouvez dicter ou saisir au clavier.
            </AlertDescription>
          </Alert>

          <div className="relative">
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={12}
              placeholder="Ex: Formation React avancé, 3 jours, 1500€ HT/jour, 6 participants max. Inclure un module sur les hooks personnalisés et le testing..."
              className="pr-14"
            />

            {isSupported && (
              <Button
                type="button"
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                className="absolute top-3 right-3"
                onClick={handleToggleMic}
                title={isListening ? "Arrêter la dictée" : "Dicter les instructions"}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>

          {isListening && (
            <div className="flex items-center gap-2 text-sm text-destructive animate-pulse">
              <div className="w-2 h-2 bg-destructive rounded-full" />
              Écoute en cours... Parlez puis cliquez pour arrêter.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => onValidate(instructions)}
          disabled={!instructions.trim()}
          size="lg"
        >
          Continuer vers la génération
        </Button>
      </div>
    </div>
  );
}
