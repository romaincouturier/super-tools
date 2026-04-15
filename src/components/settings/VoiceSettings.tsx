import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useVoiceSettings } from "@/hooks/useVoiceSettings";
import { getErrorMessage } from "@/lib/error-utils";

export default function VoiceSettings() {
  const { toast } = useToast();
  const { brandVoice, userVoice, loading, saving, setBrandVoice, setUserVoice, save } = useVoiceSettings();

  const handleSave = async () => {
    const result = await save();
    if (result?.success) {
      toast({ title: "Voix sauvegardées", description: "Les paramètres de voix ont été mis à jour." });
    } else {
      console.error("Error saving voice settings:", result?.error);
      toast({ title: "Erreur", description: getErrorMessage(result?.error), variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voix IA</CardTitle>
        <CardDescription>
          Configurez la voix de marque et votre voix éditoriale personnelle pour la génération de contenu IA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="brand-voice">Voix de marque</Label>
          <Textarea
            id="brand-voice"
            value={brandVoice}
            onChange={(e) => setBrandVoice(e.target.value)}
            placeholder="Ton professionnel mais accessible, tutoiement, phrases courtes, vocabulaire formation professionnelle..."
            rows={4}
            className="max-w-2xl"
          />
          <p className="text-xs text-muted-foreground">
            Décrivez le ton et le style de communication de votre marque. Cette voix sera utilisée pour toutes les générations IA.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="user-voice">Ma voix éditoriale</Label>
          <Textarea
            id="user-voice"
            value={userVoice}
            onChange={(e) => setUserVoice(e.target.value)}
            placeholder="Experte mais accessible, partage d'expérience terrain, ton direct et authentique, utilise des exemples concrets..."
            rows={4}
            className="max-w-2xl"
          />
          <p className="text-xs text-muted-foreground">
            Décrivez votre style d'écriture personnel. Cette voix sera utilisée lorsque le contenu est généré en votre nom (articles de blog, posts LinkedIn...).
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full max-w-2xl">
          {saving ? <Spinner className="mr-2" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? "Sauvegarde..." : "Sauvegarder les voix"}
        </Button>
      </CardContent>
    </Card>
  );
}
