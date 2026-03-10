import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Video, ExternalLink, SkipForward } from "lucide-react";

interface Props {
  onContinue: (loomUrl: string | null) => void;
  onDraftChange?: (loomUrl: string) => void;
  initialLoomUrl?: string | null;
}

export default function Step4Loom({ onContinue, initialLoomUrl }: Props) {
  const [loomUrl, setLoomUrl] = useState(initialLoomUrl || "");

  const isValidLoomUrl =
    !loomUrl.trim() || /^https:\/\/(www\.)?loom\.com\/share\//.test(loomUrl.trim());

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Vidéo explicative Loom (optionnel)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Video className="w-4 h-4" />
            <AlertDescription>
              Souhaitez-vous enregistrer une vidéo explicative Loom ?
              Si oui, enregistrez votre vidéo puis collez le lien ci-dessous.
            </AlertDescription>
          </Alert>

          <div className="flex gap-3">
            <Button variant="outline" asChild className="gap-2">
              <a
                href="https://www.loom.com/record"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4" />
                Ouvrir Loom
              </a>
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Lien de la vidéo Loom</Label>
            <Input
              value={loomUrl}
              onChange={(e) => setLoomUrl(e.target.value)}
              placeholder="https://www.loom.com/share/..."
            />
            {loomUrl && !isValidLoomUrl && (
              <p className="text-xs text-destructive">
                Le lien doit être au format https://www.loom.com/share/...
              </p>
            )}
          </div>

          {loomUrl && isValidLoomUrl && (
            <div className="border rounded-lg overflow-hidden">
              <div
                className="relative w-full"
                style={{ paddingBottom: "56.25%" }}
              >
                <iframe
                  src={loomUrl.replace("/share/", "/embed/")}
                  className="absolute inset-0 w-full h-full"
                  allowFullScreen
                  title="Loom video preview"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => onContinue(null)}
          className="gap-2"
        >
          <SkipForward className="w-4 h-4" />
          Passer cette étape
        </Button>
        <Button
          onClick={() => onContinue(loomUrl.trim() || null)}
          disabled={!!loomUrl.trim() && !isValidLoomUrl}
          size="lg"
        >
          Continuer vers l'email
        </Button>
      </div>
    </div>
  );
}
