import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Mail,
  Plus,
  Send,
  CalendarDays,
  GripVertical,
  X,
  Loader2,
  PartyPopper,
  ChevronRight,
  ChevronDown,
  MessageCircle,
  ExternalLink,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Newsletter {
  id: string;
  title: string | null;
  scheduled_date: string;
  status: "draft" | "sent";
  sent_at: string | null;
  created_at: string;
}

interface NewsletterCard {
  id: string;
  newsletter_id: string;
  card_id: string;
  display_order: number;
  card_title?: string;
  card_type?: string;
  pending_comments?: number;
}

interface NewsletterSectionProps {
  onCardClick?: (cardId: string) => void;
  refreshKey?: number;
}

const NewsletterSection = ({ onCardClick, refreshKey }: NewsletterSectionProps) => {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [currentNewsletter, setCurrentNewsletter] = useState<Newsletter | null>(null);
  const [newsletterCards, setNewsletterCards] = useState<NewsletterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showConfirmSend, setShowConfirmSend] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [newsletterToolUrl, setNewsletterToolUrl] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedNewsletterIds, setExpandedNewsletterIds] = useState<Set<string>>(new Set());
  const [historyCards, setHistoryCards] = useState<Record<string, NewsletterCard[]>>({});

  // Fetch newsletter tool URL from app_settings
  useEffect(() => {
    const fetchToolUrl = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("setting_value")
          .eq("setting_key", "newsletter_tool_url")
          .single();
        if (data?.setting_value) {
          setNewsletterToolUrl(data.setting_value);
        }
      } catch {
        // Setting not configured yet
      }
    };
    fetchToolUrl();
  }, []);

  const fetchNewsletters = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("newsletters")
        .select("*")
        .order("scheduled_date", { ascending: true });

      if (error) throw error;

      const all = (data || []) as Newsletter[];
      setNewsletters(all);

      // Find next upcoming draft newsletter
      const drafts = all.filter((n) => n.status === "draft");
      if (drafts.length > 0) {
        setCurrentNewsletter(drafts[0]);
        await fetchNewsletterCards(drafts[0].id);
      } else {
        setCurrentNewsletter(null);
        setNewsletterCards([]);
      }
    } catch (error) {
      console.error("Error fetching newsletters:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNewsletterCards = async (newsletterId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from("newsletter_cards")
        .select("*")
        .eq("newsletter_id", newsletterId)
        .order("display_order", { ascending: true });

      if (error) throw error;

      // Fetch card titles and pending comment counts
      const cardIds = (data || []).map((nc: any) => nc.card_id);
      if (cardIds.length > 0) {
        const { data: cardsData } = await (supabase as any)
          .from("content_cards")
          .select("id, title, card_type")
          .in("id", cardIds);

        const cardMap = new Map(
          (cardsData || []).map((c: any) => [c.id, { title: c.title, card_type: c.card_type }])
        );

        // Fetch pending comments per card
        const pendingMap = new Map<string, number>();
        try {
          const { data: reviews } = await supabase
            .from("content_reviews")
            .select("id, card_id")
            .in("card_id", cardIds);

          if (reviews && reviews.length > 0) {
            const reviewIds = reviews.map((r: any) => r.id);
            const reviewToCard = new Map(reviews.map((r: any) => [r.id, r.card_id]));

            const { data: pendingComments } = await (supabase as any)
              .from("review_comments")
              .select("review_id")
              .eq("status", "pending")
              .in("review_id", reviewIds);

            for (const pc of pendingComments || []) {
              const cid = reviewToCard.get(pc.review_id);
              if (cid) pendingMap.set(cid, (pendingMap.get(cid) || 0) + 1);
            }
          }
        } catch {
          // Ignore errors fetching comments
        }

        setNewsletterCards(
          (data || []).map((nc: any) => ({
            ...nc,
            card_title: (cardMap.get(nc.card_id) as any)?.title || "Sans titre",
            card_type: (cardMap.get(nc.card_id) as any)?.card_type || "article",
            pending_comments: pendingMap.get(nc.card_id) || 0,
          }))
        );
      } else {
        setNewsletterCards([]);
      }
    } catch (error) {
      console.error("Error fetching newsletter cards:", error);
    }
  };

  useEffect(() => {
    fetchNewsletters();
  }, [fetchNewsletters, refreshKey]);

  const handleCreate = async () => {
    if (!newDate) {
      toast.error("Veuillez sélectionner une date");
      return;
    }

    setCreating(true);
    try {
      const { error } = await (supabase as any).from("newsletters").insert({
        title: newTitle.trim() || null,
        scheduled_date: newDate,
        status: "draft",
      });

      if (error) throw error;

      toast.success("Newsletter programmée");
      setShowCreateDialog(false);
      setNewDate("");
      setNewTitle("");
      await fetchNewsletters();
    } catch (error) {
      console.error("Error creating newsletter:", error);
      toast.error("Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmSent = async () => {
    if (!currentNewsletter) return;

    setSending(true);
    try {
      const { error } = await (supabase as any)
        .from("newsletters")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", currentNewsletter.id);

      if (error) throw error;

      // Confetti celebration
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#3b82f6", "#a855f7", "#ec4899"],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#3b82f6", "#a855f7", "#ec4899"],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();

      setJustSent(true);
      setShowConfirmSend(false);
      toast.success("Newsletter envoyée !");

      // Wait a moment then refresh to show next newsletter
      setTimeout(async () => {
        setJustSent(false);
        await fetchNewsletters();
      }, 4000);
    } catch (error) {
      console.error("Error marking newsletter as sent:", error);
      toast.error("Erreur lors de la confirmation");
    } finally {
      setSending(false);
    }
  };

  const toggleHistoryNewsletter = async (newsletterId: string) => {
    const newSet = new Set(expandedNewsletterIds);
    if (newSet.has(newsletterId)) {
      newSet.delete(newsletterId);
    } else {
      newSet.add(newsletterId);
      // Fetch cards if not already loaded
      if (!historyCards[newsletterId]) {
        await fetchNewsletterCardsForHistory(newsletterId);
      }
    }
    setExpandedNewsletterIds(newSet);
  };

  const fetchNewsletterCardsForHistory = async (newsletterId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from("newsletter_cards")
        .select("*")
        .eq("newsletter_id", newsletterId)
        .order("display_order", { ascending: true });

      if (error) throw error;

      const cardIds = (data || []).map((nc: any) => nc.card_id);
      if (cardIds.length > 0) {
        const { data: cardsData } = await (supabase as any)
          .from("content_cards")
          .select("id, title, card_type")
          .in("id", cardIds);

        const cardMap = new Map(
          (cardsData || []).map((c: any) => [c.id, { title: c.title, card_type: c.card_type }])
        );

        setHistoryCards((prev) => ({
          ...prev,
          [newsletterId]: (data || []).map((nc: any) => ({
            ...nc,
            card_title: (cardMap.get(nc.card_id) as any)?.title || "Sans titre",
            card_type: (cardMap.get(nc.card_id) as any)?.card_type || "article",
          })),
        }));
      } else {
        setHistoryCards((prev) => ({ ...prev, [newsletterId]: [] }));
      }
    } catch (error) {
      console.error("Error fetching history cards:", error);
    }
  };

  const handleRemoveCard = async (newsletterCardId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("newsletter_cards")
        .delete()
        .eq("id", newsletterCardId);

      if (error) throw error;

      if (currentNewsletter) {
        await fetchNewsletterCards(currentNewsletter.id);
      }
    } catch (error) {
      console.error("Error removing card:", error);
      toast.error("Erreur lors du retrait");
    }
  };

  if (loading) {
    return null;
  }

  // Just sent state - show celebration message
  if (justSent) {
    return (
      <Card className="mb-6 border-primary/30 bg-primary/5">
        <CardContent className="py-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <PartyPopper className="h-10 w-10 text-primary" />
            <p className="text-lg font-semibold">Newsletter envoyée avec succès !</p>
            <p className="text-sm text-muted-foreground">Bravo, continuez comme ça</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center gap-3 mb-3">
            <Mail className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-base">Newsletter</h3>
          </div>

          {currentNewsletter ? (
            <div className="space-y-3">
              {/* Newsletter info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {currentNewsletter.title || "Newsletter"} — {format(new Date(currentNewsletter.scheduled_date), "d MMMM yyyy", { locale: fr })}
                  </span>
                  <Badge variant="outline" className="text-xs">Programmée</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {newsletterToolUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(newsletterToolUrl, "_blank")}
                      className="gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Préparer la newsletter
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowConfirmSend(true)}
                    className="gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Confirmer l'envoi
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNewDate("");
                      setNewTitle("");
                      setShowCreateDialog(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Attached cards */}
              {newsletterCards.length > 0 ? (
                <div className="space-y-1">
                  {newsletterCards.map((nc) => (
                    <div
                      key={nc.id}
                      className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 group"
                    >
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{
                          backgroundColor: nc.card_type === "post" ? "#a855f7" : "#3b82f6",
                        }}
                      />
                      <button
                        className="text-sm text-left flex-1 truncate hover:text-primary"
                        onClick={() => onCardClick?.(nc.card_id)}
                      >
                        {nc.card_title}
                      </button>
                      {(nc.pending_comments ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-orange-600 shrink-0" title={`${nc.pending_comments} commentaire${nc.pending_comments! > 1 ? "s" : ""} en attente`}>
                          <MessageCircle className="h-3 w-3" />
                          {nc.pending_comments}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveCard(nc.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground pl-2">
                  Aucun contenu rattaché. Ajoutez des contenus depuis les cartes.
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between py-2">
              <p className="text-sm text-muted-foreground">
                Aucune newsletter programmée
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setNewDate("");
                  setNewTitle("");
                  setShowCreateDialog(true);
                }}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Programmer une newsletter
              </Button>
            </div>
          )}

          {/* Sent newsletters history */}
          {newsletters.filter((n) => n.status === "sent").length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <button
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="h-3.5 w-3.5" />
                <span>
                  {newsletters.filter((n) => n.status === "sent").length} newsletter{newsletters.filter((n) => n.status === "sent").length > 1 ? "s" : ""} envoyée{newsletters.filter((n) => n.status === "sent").length > 1 ? "s" : ""}
                </span>
                {showHistory ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronRight className="h-3 w-3 ml-auto" />}
              </button>

              {showHistory && (
                <div className="mt-2 space-y-1">
                  {newsletters
                    .filter((n) => n.status === "sent")
                    .sort((a, b) => new Date(b.sent_at || b.scheduled_date).getTime() - new Date(a.sent_at || a.scheduled_date).getTime())
                    .map((nl) => (
                      <div key={nl.id} className="rounded border bg-muted/30">
                        <button
                          className="flex items-center gap-2 py-1.5 px-2 w-full text-left hover:bg-muted/50 transition-colors"
                          onClick={() => toggleHistoryNewsletter(nl.id)}
                        >
                          {expandedNewsletterIds.has(nl.id) ? (
                            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-xs font-medium truncate flex-1">
                            {nl.title || "Newsletter"} — {format(new Date(nl.scheduled_date), "d MMM yyyy", { locale: fr })}
                          </span>
                          <Badge variant="outline" className="text-[10px] h-4 shrink-0">Envoyée</Badge>
                        </button>

                        {expandedNewsletterIds.has(nl.id) && (
                          <div className="px-2 pb-2">
                            {historyCards[nl.id] ? (
                              historyCards[nl.id].length > 0 ? (
                                <div className="space-y-0.5">
                                  {historyCards[nl.id].map((nc) => (
                                    <button
                                      key={nc.id}
                                      className="flex items-center gap-2 py-1 px-2 rounded text-xs hover:bg-muted/50 w-full text-left"
                                      onClick={() => onCardClick?.(nc.card_id)}
                                    >
                                      <div
                                        className="h-1.5 w-1.5 rounded-full shrink-0"
                                        style={{
                                          backgroundColor: nc.card_type === "post" ? "#a855f7" : "#3b82f6",
                                        }}
                                      />
                                      <span className="truncate">{nc.card_title}</span>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-muted-foreground px-2 py-1">Aucun article</p>
                              )
                            ) : (
                              <div className="flex justify-center py-2">
                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create newsletter dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Programmer une newsletter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nl-title">Titre (optionnel)</Label>
              <Input
                id="nl-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Newsletter de février"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nl-date">Date d'envoi prévue *</Label>
              <Input
                id="nl-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Création...
                </>
              ) : (
                "Programmer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm send alert dialog */}
      <AlertDialog open={showConfirmSend} onOpenChange={setShowConfirmSend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'envoi de la newsletter</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmez-vous que la newsletter
              {currentNewsletter?.title ? ` "${currentNewsletter.title}"` : ""} du{" "}
              {currentNewsletter && format(new Date(currentNewsletter.scheduled_date), "d MMMM yyyy", { locale: fr })} a bien été envoyée ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSent} disabled={sending}>
              {sending ? "Confirmation..." : "Oui, elle a été envoyée !"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default NewsletterSection;
