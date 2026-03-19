import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function VoiceSettings() {
  const { toast } = useToast();
  const [brandVoice, setBrandVoice] = useState("");
  const [userVoice, setUserVoice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUserId(user.id);

        // Load brand voice from ai_brand_settings
        const { data: brandSettings } = await supabase
          .from("ai_brand_settings")
          .select("content")
          .eq("setting_type", "supertilt_voice")
          .maybeSingle();

        if (brandSettings) {
          setBrandVoice(brandSettings.content || "");
        }

        // Load user voice from profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("voice_description")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile) {
          setUserVoice(profile.voice_description || "");
        }
      } catch (error) {
        console.error("Error loading voice settings:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);

    try {
      // Save brand voice
      const { error: brandError } = await supabase
        .from("ai_brand_settings")
        .update({ content: brandVoice })
        .eq("setting_type", "supertilt_voice");

      if (brandError) throw brandError;

      // Save user voice
      const { error: userError } = await supabase
        .from("profiles")
        .update({ voice_description: userVoice })
        .eq("user_id", userId);

      if (userError) throw userError;

      toast({
        title: "Voix sauvegardées",
        description: "Les paramètres de voix ont été mis à jour.",
      });
    } catch (error) {
      console.error("Error saving voice settings:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les paramètres de voix.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? "Sauvegarde..." : "Sauvegarder les voix"}
        </Button>
      </CardContent>
    </Card>
  );
}
