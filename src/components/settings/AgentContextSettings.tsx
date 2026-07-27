import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Save } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useAgentBusinessContext } from "@/hooks/useAgentBusinessContext";

export default function AgentContextSettings() {
  const { value, setValue, loading, saving, save } = useAgentBusinessContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Contexte métier de l'agent
        </CardTitle>
        <CardDescription>
          Ce texte est injecté dans le prompt de l'agent à chaque conversation.
          Décrivez votre activité, vos offres, votre vocabulaire, vos définitions
          (ex : ce qui compte comme CA signé), vos clients récurrents, la saisonnalité.
          Plus ce contexte est précis, plus l'agent est pertinent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                "Exemple :\n" +
                "- Supertilt est un organisme de formation spécialisé en …\n" +
                "- Nos offres : formations intra/inter, coaching, e-learning, jeux pédagogiques\n" +
                "- CA signé = somme des devis avec status 'signed' (total_ht)\n" +
                "- Une formation est confirmée quand …\n" +
                "- Nos clients récurrents : …"
              }
              rows={14}
              className="font-mono text-sm"
            />
            <div className="flex justify-end">
              <Button onClick={() => save(value)} disabled={saving} className="gap-2">
                {saving ? <Spinner /> : <Save className="h-4 w-4" />}
                Enregistrer
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
