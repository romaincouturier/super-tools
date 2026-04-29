import { useState, useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useMissionPages, MissionPage } from "@/hooks/useMissions";
import { htmlToPlainText } from "@/lib/htmlUtils";

interface Generate8PDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missionId: string;
  onGenerated: (html: string) => void;
}

interface CrmCardSummary {
  id: string;
  title: string;
  company: string | null;
  descriptionPreview: string;
}

const Generate8PDialog = ({ open, onOpenChange, missionId, onGenerated }: Generate8PDialogProps) => {
  const { toast } = useToast();
  const { data: pages } = useMissionPages(missionId);

  const [crmCard, setCrmCard] = useState<CrmCardSummary | null>(null);
  const [includeCrm, setIncludeCrm] = useState(true);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Fetch linked CRM card when dialog opens
  useEffect(() => {
    if (!open || !missionId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("crm_cards")
        .select("id, title, company, description_html, raw_input")
        .eq("linked_mission_id", missionId)
        .limit(1);
      if (!cancelled) {
        const card = data?.[0];
        const rawText = card
          ? htmlToPlainText(card.description_html || "") || (card.raw_input || "")
          : "";
        const preview = rawText.replace(/\s+/g, " ").trim().slice(0, 200);
        setCrmCard(
          card
            ? { id: card.id, title: card.title, company: card.company, descriptionPreview: preview }
            : null,
        );
        setIncludeCrm(!!card);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, missionId]);

  // Reset page selection when dialog opens
  useEffect(() => {
    if (open) setSelectedPageIds(new Set());
  }, [open]);

  const togglePage = (id: string) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-mission-8p", {
        body: {
          mission_id: missionId,
          include_crm_card: includeCrm && !!crmCard,
          page_ids: Array.from(selectedPageIds),
        },
      });
      if (error) throw error;
      const html = (data as { html?: string })?.html;
      if (!html) throw new Error("Réponse vide");
      onGenerated(html);
      onOpenChange(false);
      toast({ title: "Page 9P générée", description: `${(data as { sources_count?: number }).sources_count ?? 0} sources compilées` });
    } catch (err: unknown) {
      toastError(toast, err instanceof Error ? err : "Erreur lors de la génération");
    } finally {
      setLoading(false);
    }
  };

  const sortedPages = (pages || []).slice().sort((a: MissionPage, b: MissionPage) =>
    a.title.localeCompare(b.title, "fr"),
  );

  const hasAnySource = (includeCrm && !!crmCard) || selectedPageIds.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Générer une page 9P
          </DialogTitle>
          <DialogDescription>
            Sélectionne les sources à compiler. L'IA structurera le contenu en 9 sections : Present, Purpose, Public, Process, Product, Pitfalls, Preparation (Client / SuperTilt / Autres), Prerequisites, Puzzle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {crmCard && (
            <div className="rounded-lg border p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="crm-card"
                  checked={includeCrm}
                  onCheckedChange={(v) => setIncludeCrm(!!v)}
                />
                <label htmlFor="crm-card" className="flex-1 cursor-pointer text-sm">
                  <div className="font-medium">Descriptif & notes de l'opportunité</div>
                  <div className="text-muted-foreground text-xs">
                    {crmCard.title}
                    {crmCard.company ? ` — ${crmCard.company}` : ""}
                  </div>
                  {crmCard.descriptionPreview ? (
                    <div className="mt-1 text-muted-foreground text-xs italic line-clamp-3">
                      « {crmCard.descriptionPreview}{crmCard.descriptionPreview.length >= 200 ? "…" : ""} »
                    </div>
                  ) : (
                    <div className="mt-1 text-muted-foreground text-xs italic">
                      (aucun descriptif renseigné sur la carte CRM)
                    </div>
                  )}
                </label>
              </div>
            </div>
          )}

          {sortedPages.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium">Pages de la mission</div>
              <ScrollArea className="max-h-64 rounded-lg border">
                <div className="space-y-1 p-2">
                  {sortedPages.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded p-2 hover:bg-muted">
                      <Checkbox
                        id={`page-${p.id}`}
                        checked={selectedPageIds.has(p.id)}
                        onCheckedChange={() => togglePage(p.id)}
                      />
                      <label htmlFor={`page-${p.id}`} className="flex-1 cursor-pointer text-sm">
                        <span className="mr-2">{p.icon || "📄"}</span>
                        {p.title || "Sans titre"}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {!crmCard && sortedPages.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Aucune source disponible. Crée d'abord des pages dans cette mission ou lie-la à une carte CRM.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleGenerate} disabled={loading || !hasAnySource}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Générer la page 9P
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Generate8PDialog;
