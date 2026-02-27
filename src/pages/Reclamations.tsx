import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Link2, Copy, Sparkles, FileDown, AlertCircle, Clock, CheckCircle2, MessageSquareWarning } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  SEVERITY_COLORS,
  NATURE_LABELS,
  NATURE_COLORS,
  PROBLEM_TYPES,
  NATURES,
  CANALS,
  SEVERITIES,
} from "@/lib/reclamationConstants";

type Reclamation = {
  id: string;
  token: string;
  date_reclamation: string | null;
  client_name: string | null;
  client_email: string | null;
  canal: string | null;
  nature: string | null;
  problem_type: string | null;
  attendu_initial: string | null;
  resultat_constate: string | null;
  description: string | null;
  severity: string | null;
  status: string;
  actions_decided: string | null;
  response_sent: string | null;
  response_date: string | null;
  ai_analysis: string | null;
  ai_response_draft: string | null;
  qualiopi_summary: string | null;
  training_id: string | null;
  mission_id: string | null;
  created_at: string;
  updated_at: string;
};

const Reclamations = () => {
  const { user, loading: authLoading } = useAuth();
  const { hasAccess, loading: accessLoading } = useModuleAccess();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [reclamations, setReclamations] = useState<Reclamation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRec, setSelectedRec] = useState<Reclamation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterNature, setFilterNature] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  // New reclamation dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newProblemType, setNewProblemType] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSeverity, setNewSeverity] = useState("");
  const [newNature, setNewNature] = useState("reclamation");
  const [newCanal, setNewCanal] = useState("mail");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const fetchReclamations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reclamations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching reclamations:", error);
      toast({ title: "Erreur", description: "Impossible de charger les réclamations.", variant: "destructive" });
    } else {
      setReclamations((data as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchReclamations();
  }, [user]);

  const filtered = useMemo(() => {
    return reclamations.filter((r) => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterNature !== "all" && r.nature !== filterNature) return false;
      if (filterType !== "all" && r.problem_type !== filterType) return false;
      if (filterSeverity !== "all" && r.severity !== filterSeverity) return false;
      return true;
    });
  }, [reclamations, filterStatus, filterNature, filterType, filterSeverity]);

  const stats = useMemo(() => {
    const open = reclamations.filter((r) => r.status === "open").length;
    const inProgress = reclamations.filter((r) => r.status === "in_progress").length;
    const closed = reclamations.filter((r) => r.status === "closed").length;
    return { open, inProgress, closed, total: reclamations.length };
  }, [reclamations]);

  const generateLink = async () => {
    setGeneratingLink(true);
    try {
      const token = uuidv4();
      const { error } = await supabase.from("reclamations").insert({
        token,
        status: "draft",
        created_by: user?.id,
      } as any);

      if (error) throw error;

      const url = `${window.location.origin}/reclamation/${token}`;
      await navigator.clipboard.writeText(url);
      toast({ title: "Lien copié", description: "Le lien de réclamation a été copié dans le presse-papier." });
      fetchReclamations();
    } catch (e) {
      console.error("Error generating link:", e);
      toast({ title: "Erreur", description: "Impossible de générer le lien.", variant: "destructive" });
    } finally {
      setGeneratingLink(false);
    }
  };

  const createManual = async () => {
    if (!newClientName.trim() || !newDescription.trim()) {
      toast({ title: "Champs requis", description: "Nom du client et description sont obligatoires.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const token = uuidv4();
      const { error } = await supabase.from("reclamations").insert({
        token,
        client_name: newClientName.trim(),
        client_email: newClientEmail.trim() || null,
        nature: newNature,
        canal: newCanal,
        problem_type: newProblemType || null,
        description: newDescription.trim(),
        severity: newSeverity || null,
        status: "open",
        date_reclamation: new Date().toISOString().split("T")[0],
        created_by: user?.id,
      } as any);

      if (error) throw error;

      toast({ title: "Réclamation créée" });
      setNewDialogOpen(false);
      setNewClientName("");
      setNewClientEmail("");
      setNewProblemType("");
      setNewDescription("");
      setNewSeverity("");
      setNewCanal("mail");
      fetchReclamations();
    } catch (e) {
      console.error("Error creating reclamation:", e);
      toast({ title: "Erreur", description: "Impossible de créer la réclamation.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const updateReclamation = async (id: string, updates: Partial<Reclamation>) => {
    const { error } = await supabase
      .from("reclamations")
      .update(updates as any)
      .eq("id", id);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de mettre à jour.", variant: "destructive" });
    } else {
      toast({ title: "Mis à jour" });
      fetchReclamations();
      if (selectedRec?.id === id) {
        setSelectedRec((prev) => prev ? { ...prev, ...updates } : prev);
      }
    }
  };

  const runAiAssist = async (action: string) => {
    if (!selectedRec) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reclamation-ai-assist", {
        body: { action, reclamation: selectedRec },
      });

      if (error) throw error;

      const updates: Partial<Reclamation> = {};
      if (action === "analyze" && data?.analysis) updates.ai_analysis = data.analysis;
      if (action === "draft_response" && data?.draft) updates.ai_response_draft = data.draft;
      if (action === "qualiopi_summary" && data?.summary) updates.qualiopi_summary = data.summary;

      if (Object.keys(updates).length > 0) {
        await updateReclamation(selectedRec.id, updates);
      }

      toast({ title: "IA terminée", description: `Action "${action}" exécutée.` });
    } catch (e) {
      console.error("AI assist error:", e);
      toast({ title: "Erreur IA", description: "L'assistance IA a échoué.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const exportRegistre = () => {
    const lines = reclamations
      .filter((r) => r.status !== "draft")
      .map((r) => `${r.date_reclamation || "-"}\t${r.client_name || "-"}\t${r.problem_type || "-"}\t${r.severity || "-"}\t${r.actions_decided || "-"}\t${STATUS_LABELS[r.status] || r.status}`);
    const header = "Date\tClient\tType\tGravité\tActions\tStatut";
    const text = [header, ...lines].join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Registre copié", description: "Le tableau récapitulatif a été copié dans le presse-papier." });
  };

  if (authLoading || accessLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <MessageSquareWarning className="h-7 w-7 text-primary" />
              <h1 className="text-2xl font-bold">Réclamations</h1>
              <Badge variant="outline" className="text-xs">Indicateur 31</Badge>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={exportRegistre} disabled={reclamations.length === 0}>
                <FileDown className="h-4 w-4 mr-1" /> Export registre
              </Button>
              <Button variant="outline" size="sm" onClick={generateLink} disabled={generatingLink}>
                {generatingLink ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
                Générer un lien
              </Button>
              <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nouvelle réclamation</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Nouvelle réclamation</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label>Nature du signalement *</Label>
                      <Select value={newNature} onValueChange={setNewNature}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {NATURES.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>Nom / Structure *</Label>
                        <Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Email</Label>
                        <Input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>Canal</Label>
                        <Select value={newCanal} onValueChange={setNewCanal}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CANALS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Type de problème</Label>
                        <Select value={newProblemType} onValueChange={setNewProblemType}>
                          <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                          <SelectContent>
                            {PROBLEM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Description *</Label>
                      <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={4} />
                    </div>
                    <div className="space-y-1">
                      <Label>Gravité</Label>
                      <Select value={newSeverity} onValueChange={setNewSeverity}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                        <SelectContent>
                          {SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={createManual} disabled={creating} className="w-full">
                      {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Créer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4 text-center">
              <AlertCircle className="h-5 w-5 text-orange-500 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats.open}</p>
              <p className="text-xs text-muted-foreground">Ouvertes</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <Clock className="h-5 w-5 text-blue-500 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">En cours</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats.closed}</p>
              <p className="text-xs text-muted-foreground">Clôturées</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <MessageSquareWarning className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent></Card>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="open">Ouvertes</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="closed">Clôturées</SelectItem>
                <SelectItem value="draft">Brouillons</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterNature} onValueChange={setFilterNature}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Nature" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes natures</SelectItem>
                {NATURES.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {PROBLEM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Gravité" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes gravités</SelectItem>
                <SelectItem value="mineure">Mineure</SelectItem>
                <SelectItem value="significative">Significative</SelectItem>
                <SelectItem value="majeure">Majeure</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              Aucune réclamation{filterStatus !== "all" || filterType !== "all" || filterSeverity !== "all" ? " avec ces filtres" : ""}.
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <Card
                  key={r.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => { setSelectedRec(r); setDrawerOpen(true); }}
                >
                  <CardContent className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{r.client_name || "—"}</span>
                        {r.nature && <Badge className={`text-xs ${NATURE_COLORS[r.nature] || ""}`}>{NATURE_LABELS[r.nature] || r.nature}</Badge>}
                        {r.problem_type && <Badge variant="outline" className="text-xs">{r.problem_type}</Badge>}
                        {r.severity && <Badge className={`text-xs ${SEVERITY_COLORS[r.severity] || ""}`}>{r.severity}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">{r.description || "En attente de soumission"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{r.date_reclamation || ""}</span>
                      <Badge className={`text-xs ${STATUS_COLORS[r.status] || ""}`}>{STATUS_LABELS[r.status] || r.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Detail drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedRec && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  Réclamation — {selectedRec.client_name || "Sans nom"}
                  <Badge className={`text-xs ${STATUS_COLORS[selectedRec.status] || ""}`}>{STATUS_LABELS[selectedRec.status] || selectedRec.status}</Badge>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Nature :</span> {selectedRec.nature ? (NATURE_LABELS[selectedRec.nature] || selectedRec.nature) : "—"}</div>
                  <div><span className="text-muted-foreground">Date :</span> {selectedRec.date_reclamation || "—"}</div>
                  <div><span className="text-muted-foreground">Email :</span> {selectedRec.client_email || "—"}</div>
                  <div><span className="text-muted-foreground">Canal :</span> {selectedRec.canal || "—"}</div>
                  <div><span className="text-muted-foreground">Type :</span> {selectedRec.problem_type || "—"}</div>
                  <div><span className="text-muted-foreground">Gravité :</span> {selectedRec.severity || "—"}</div>
                </div>

                <Separator />

                {/* Attendu / Constaté (Indicateur 30) */}
                {(selectedRec as any).attendu_initial && (
                  <div>
                    <Label className="text-muted-foreground">Attendu initial</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{(selectedRec as any).attendu_initial}</p>
                  </div>
                )}
                {(selectedRec as any).resultat_constate && (
                  <div>
                    <Label className="text-muted-foreground">Résultat constaté</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{(selectedRec as any).resultat_constate}</p>
                  </div>
                )}

                {/* Description */}
                <div>
                  <Label className="text-muted-foreground">Description détaillée</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{selectedRec.description || "Aucune description"}</p>
                </div>

                <Separator />

                {/* Status change */}
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select
                    value={selectedRec.status}
                    onValueChange={(v) => updateReclamation(selectedRec.id, { status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Ouverte</SelectItem>
                      <SelectItem value="in_progress">En cours</SelectItem>
                      <SelectItem value="closed">Clôturée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Actions decided */}
                <div className="space-y-2">
                  <Label>Actions décidées</Label>
                  <Textarea
                    value={selectedRec.actions_decided || ""}
                    onChange={(e) => setSelectedRec((prev) => prev ? { ...prev, actions_decided: e.target.value } : prev)}
                    onBlur={() => selectedRec.actions_decided !== null && updateReclamation(selectedRec.id, { actions_decided: selectedRec.actions_decided })}
                    rows={3}
                    placeholder="Actions correctives décidées..."
                  />
                </div>

                {/* Response sent */}
                <div className="space-y-2">
                  <Label>Réponse envoyée au client</Label>
                  <Textarea
                    value={selectedRec.response_sent || ""}
                    onChange={(e) => setSelectedRec((prev) => prev ? { ...prev, response_sent: e.target.value } : prev)}
                    onBlur={() => updateReclamation(selectedRec.id, { response_sent: selectedRec.response_sent, response_date: selectedRec.response_sent ? new Date().toISOString().split("T")[0] : null })}
                    rows={3}
                    placeholder="Message de réponse envoyé..."
                  />
                </div>

                {/* Qualiopi summary */}
                <div className="space-y-2">
                  <Label>Résumé Qualiopi</Label>
                  <Textarea
                    value={selectedRec.qualiopi_summary || ""}
                    onChange={(e) => setSelectedRec((prev) => prev ? { ...prev, qualiopi_summary: e.target.value } : prev)}
                    onBlur={() => updateReclamation(selectedRec.id, { qualiopi_summary: selectedRec.qualiopi_summary })}
                    rows={3}
                    placeholder="Résumé exploitable pour l'audit Qualiopi..."
                  />
                </div>

                <Separator />

                {/* AI section */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Assistance IA</h3>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => runAiAssist("analyze")} disabled={aiLoading}>
                      {aiLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Analyser
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => runAiAssist("draft_response")} disabled={aiLoading}>
                      Brouillon réponse
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => runAiAssist("qualiopi_summary")} disabled={aiLoading}>
                      Résumé Qualiopi
                    </Button>
                  </div>

                  {selectedRec.ai_analysis && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <Label className="text-xs text-muted-foreground">Analyse IA</Label>
                      <p className="text-sm whitespace-pre-wrap mt-1">{selectedRec.ai_analysis}</p>
                    </div>
                  )}
                  {selectedRec.ai_response_draft && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Brouillon de réponse IA</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedRec.ai_response_draft || "");
                            toast({ title: "Copié" });
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-sm whitespace-pre-wrap mt-1">{selectedRec.ai_response_draft}</p>
                    </div>
                  )}
                </div>

                {/* Copy public link */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/reclamation/${selectedRec.token}`);
                    toast({ title: "Lien copié" });
                  }}
                >
                  <Link2 className="h-4 w-4 mr-1" /> Copier le lien public
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Reclamations;
