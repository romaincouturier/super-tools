import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, EyeOff, ExternalLink } from "lucide-react";
import { loadArenaApiKeys, saveArenaApiKeys } from "@/lib/arena/api";
import type { ApiKeys } from "@/lib/arena/types";

export default function ArenaKeySettings() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKeys>({ claude: "", openai: "", gemini: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    loadArenaApiKeys().then((loaded) => {
      setKeys(loaded);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveArenaApiKeys(keys);
      toast({ title: "Cles API sauvegardees", description: "Les cles AI Arena ont ete mises a jour." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de sauvegarder les cles.", variant: "destructive" });
    }
    setSaving(false);
  };

  const hasAnyKey = true; // Claude is always available via server key

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chargement...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          AI Arena
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Discussions Multi-Agents</span>
        </CardTitle>
        <CardDescription>
          La clé Anthropic (Claude) est gérée côté serveur. Configurez ici les clés optionnelles pour OpenAI et Gemini.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowKeys(!showKeys)}
            className="text-xs"
          >
            {showKeys ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
            {showKeys ? "Masquer les cles" : "Afficher les cles"}
          </Button>
          {hasAnyKey && (
            <a href="/arena" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Ouvrir AI Arena <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="inline-block h-2 w-2 rounded-full bg-[#D97706]" />
              Anthropic (Claude) — <span className="text-primary">disponible</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Clé gérée côté serveur (ANTHROPIC_API_KEY). Aucune configuration nécessaire.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[#10A37F]" />
              OpenAI
              <span className="text-xs text-muted-foreground">(optionnel)</span>
            </Label>
            <Input
              type={showKeys ? "text" : "password"}
              value={keys.openai || ""}
              onChange={(e) => setKeys({ ...keys, openai: e.target.value })}
              placeholder="sk-..."
            />
            <p className="text-[11px] text-muted-foreground">
              Pour utiliser GPT-4o / GPT-4o Mini comme provider alternatif.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[#4285F4]" />
              Google Gemini
              <span className="text-xs text-muted-foreground">(optionnel)</span>
            </Label>
            <Input
              type={showKeys ? "text" : "password"}
              value={keys.gemini || ""}
              onChange={(e) => setKeys({ ...keys, gemini: e.target.value })}
              placeholder="AIza..."
            />
            <p className="text-[11px] text-muted-foreground">
              Pour utiliser Gemini 2.0 Flash / Gemini 2.5 Pro comme provider alternatif.
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Sauvegarde..." : "Sauvegarder les cles"}
        </Button>
      </CardContent>
    </Card>
  );
}
