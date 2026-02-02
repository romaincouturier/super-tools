import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles,
  FileText,
  Linkedin,
  Instagram,
  Copy,
  Check,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AiAssistPanelProps {
  content: string;
  onApply: (newContent: string) => void;
}

type ActionType = "reformulate" | "adapt_blog" | "adapt_linkedin" | "adapt_instagram";

const actions = [
  {
    id: "reformulate" as ActionType,
    label: "Reformuler",
    icon: RefreshCw,
    description: "Améliorer le style et la clarté",
  },
  {
    id: "adapt_blog" as ActionType,
    label: "Article de blog",
    icon: FileText,
    description: "Adapter pour un article de blog",
  },
  {
    id: "adapt_linkedin" as ActionType,
    label: "LinkedIn",
    icon: Linkedin,
    description: "Adapter pour LinkedIn",
  },
  {
    id: "adapt_instagram" as ActionType,
    label: "Instagram",
    icon: Instagram,
    description: "Adapter pour Instagram",
  },
];

const AiAssistPanel = ({ content, onApply }: AiAssistPanelProps) => {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [copied, setCopied] = useState(false);

  const handleAction = async (action: ActionType) => {
    if (!content.trim()) {
      toast.error("Le contenu est vide");
      return;
    }

    setLoading(true);
    setActiveAction(action);
    setResult("");

    try {
      const { data, error } = await supabase.functions.invoke("ai-content-assist", {
        body: { action, content },
      });

      if (error) throw error;

      setResult(data.result || "");
    } catch (error) {
      console.error("Error with AI assist:", error);
      toast.error("Erreur lors du traitement IA");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Copié dans le presse-papier");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    onApply(result);
    toast.success("Contenu appliqué");
    setResult("");
    setActiveAction(null);
  };

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Sparkles className="h-5 w-5" />
        <span className="text-sm">
          Utilisez l'IA pour reformuler ou adapter votre contenu
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              variant="outline"
              className="h-auto py-3 flex-col items-start"
              onClick={() => handleAction(action.id)}
              disabled={loading}
            >
              <div className="flex items-center gap-2">
                {loading && activeAction === action.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="font-medium">{action.label}</span>
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                {action.description}
              </span>
            </Button>
          );
        })}
      </div>

      {result && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Résultat</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4 mr-1" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  Copier
                </Button>
                <Button size="sm" onClick={handleApply}>
                  Appliquer
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={result}
              onChange={(e) => setResult(e.target.value)}
              rows={8}
              className="resize-none"
            />
          </CardContent>
        </Card>
      )}

      {!content.trim() && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Ajoutez du contenu à la carte pour utiliser l'assistance IA
        </p>
      )}
    </div>
  );
};

export default AiAssistPanel;
