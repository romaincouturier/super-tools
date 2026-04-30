import { useState, useEffect, useMemo } from "react";
import { Loader2, Sparkles, Search, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
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
  const [isLinkedCard, setIsLinkedCard] = useState(false);
  const [includeCrm, setIncludeCrm] = useState(true);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // CRM search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<CrmCardSummary[]>([]);
  const [searching, setSearching] = useState(false);

  const buildSummary = (card: {
    id: string;
    title: string;
    company: string | null;
    description_html: string | null;
    raw_input: string | null;
  }): CrmCardSummary => {
    const rawText = htmlToPlainText(card.description_html || "") || (card.raw_input || "");
    const preview = rawText.replace(/\s+/g, " ").trim().slice(0, 200);
    return { id: card.id, title: card.title, company: card.company, descriptionPreview: preview };
  };

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
        if (card) {
          setCrmCard(buildSummary(card));
          setIsLinkedCard(true);
          setIncludeCrm(true);
        } else {
          setCrmCard(null);
          setIsLinkedCard(false);
          setIncludeCrm(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, missionId]);

  // Reset page selection + search when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPageIds(new Set());
      setSearchOpen(false);
      setSearchTerm("");
      setSearchResults([]);
    }
  }, [open]);

  // Debounced CRM search
  useEffect(() => {
    if (!searchOpen) return;
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const safe = term.replace(/[%_\\,()."]/g, (ch) => `\\${ch}`);
        const { data } = await supabase
          .from("crm_cards")
          .select("id, title, company, description_html, raw_input")
          .or(`title.ilike.%${safe}%,company.ilike.%${safe}%`)
          .order("created_at", { ascending: false })
          .limit(15);
        setSearchResults((data || []).map(buildSummary));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, searchOpen]);

  const togglePage = (id: string) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sortedPages = useMemo(
    () =>
      (pages || []).slice().sort((a: MissionPage, b: MissionPage) =>
        a.title.localeCompare(b.title, "fr"),
      ),
    [pages],
  );

  const toggleAllPages = () => {
    if (selectedPageIds.size === sortedPages.length) {
      setSelectedPageIds(new Set());
    } else {
      setSelectedPageIds(new Set(sortedPages.map((p) => p.id)));
    }
  };

  const pickCrmCard = (card: CrmCardSummary) => {
    setCrmCard(card);
    setIncludeCrm(true);
    setIsLinkedCard(false);
    setSearchOpen(false);
    setSearchTerm("");
    setSearchResults([]);
  };

  const clearCrmCard = () => {
    setCrmCard(null);
    setIncludeCrm(false);
    setIsLinkedCard(false);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-mission-8p", {
        body: {
          mission_id: missionId,
          include_crm_card: includeCrm && !!crmCard,
          // Pass explicit id so the edge function uses this exact card
          // (works even if the card isn't linked via linked_mission_id).
          crm_card_id: includeCrm && crmCard ? crmCard.id : undefined,
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

  const hasAnySource = (includeCrm && !!crmCard) || selectedPageIds.size > 0;
  const allSelected = sortedPages.length > 0 && selectedPageIds.size === sortedPages.length;

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
          {/* CRM card block */}
          <div className="rounded-lg border p-3">
            {crmCard ? (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="crm-card"
                  checked={includeCrm}
                  onCheckedChange={(v) => setIncludeCrm(!!v)}
                />
                <label htmlFor="crm-card" className="flex-1 cursor-pointer text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">
                      Descriptif & notes de l'opportunité
                      {!isLinkedCard && (
                        <span className="ml-2 text-muted-foreground text-xs font-normal">
                          (sélectionnée manuellement)
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={(e) => {
                        e.preventDefault();
                        clearCrmCard();
                        setSearchOpen(true);
                      }}
                    >
                      Changer
                    </Button>
                  </div>
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
            ) : !searchOpen ? (
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">Descriptif & notes d'une opportunité CRM</div>
                  <div className="text-muted-foreground text-xs">
                    Aucune carte CRM liée à cette mission.
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="mr-1 h-3.5 w-3.5" />
                  Choisir
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="text-muted-foreground absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                    <Input
                      autoFocus
                      placeholder="Titre ou société…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8 pl-7 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchTerm("");
                      setSearchResults([]);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {searching && (
                  <div className="text-muted-foreground text-xs">Recherche…</div>
                )}
                {!searching && searchTerm.trim().length >= 2 && searchResults.length === 0 && (
                  <div className="text-muted-foreground text-xs">Aucun résultat</div>
                )}
                {searchResults.length > 0 && (
                  <ScrollArea className="max-h-48 rounded border">
                    <div className="space-y-1 p-1">
                      {searchResults.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => pickCrmCard(r)}
                          className="hover:bg-muted block w-full rounded p-2 text-left text-sm"
                        >
                          <div className="font-medium">{r.title}</div>
                          {r.company && (
                            <div className="text-muted-foreground text-xs">{r.company}</div>
                          )}
                          {r.descriptionPreview && (
                            <div className="text-muted-foreground line-clamp-1 text-xs italic">
                              « {r.descriptionPreview} »
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>

          {/* Pages block */}
          {sortedPages.length > 0 ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">
                  Pages de la mission
                  <span className="text-muted-foreground ml-2 text-xs font-normal">
                    ({sortedPages.length})
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={toggleAllPages}
                >
                  {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                </Button>
              </div>
              <ScrollArea className="h-72 rounded-lg border">
                <div className="space-y-1 p-2">
                  {sortedPages.map((p) => (
                    <div key={p.id} className="hover:bg-muted flex items-center gap-3 rounded p-2">
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
          ) : (
            <p className="text-muted-foreground text-sm">
              Aucune page dans cette mission. Crée d'abord des pages ou sélectionne une carte CRM.
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
