import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, Plus, Send, Copy, Users, Building, GraduationCap, Wallet, Filter, BarChart3 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";

interface Appreciation {
  id: string;
  training_id: string | null;
  stakeholder_type: string;
  stakeholder_name: string;
  stakeholder_email: string | null;
  token: string;
  date_envoi: string | null;
  date_reception: string | null;
  status: string;
  satisfaction_globale: number | null;
  points_forts: string | null;
  axes_amelioration: string | null;
  commentaires: string | null;
  year: number;
  created_at: string;
}

interface Training {
  id: string;
  training_name: string;
}

const stakeholderTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pedagogique: { label: "Équipe pédagogique", icon: <GraduationCap className="h-4 w-4" />, color: "bg-blue-100 text-blue-800" },
  financeur: { label: "Financeur", icon: <Wallet className="h-4 w-4" />, color: "bg-purple-100 text-purple-800" },
  beneficiaire_froid: { label: "Bénéficiaire (à froid)", icon: <Users className="h-4 w-4" />, color: "bg-green-100 text-green-800" },
  entreprise: { label: "Entreprise", icon: <Building className="h-4 w-4" />, color: "bg-orange-100 text-orange-800" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-800" },
  envoye: { label: "Envoyé", color: "bg-yellow-100 text-yellow-800" },
  recu: { label: "Reçu", color: "bg-green-100 text-green-800" },
};

const Appreciations = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [appreciations, setAppreciations] = useState<Appreciation[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newAppreciation, setNewAppreciation] = useState({
    stakeholder_type: "pedagogique",
    stakeholder_name: "",
    stakeholder_email: "",
    training_id: "",
    year: new Date().getFullYear(),
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { navigate("/auth"); return; }
      setUser(session.user);
      fetchData();
      setLoading(false);
    });
  }, [navigate]);

  const fetchData = async () => {
    const [{ data: appData }, { data: trainingsData }] = await Promise.all([
      (supabase as any).from("stakeholder_appreciations").select("*").order("created_at", { ascending: false }),
      supabase.from("trainings").select("id, training_name").order("start_date", { ascending: false }),
    ]);
    setAppreciations(appData || []);
    setTrainings(trainingsData || []);
  };

  const filtered = appreciations.filter((a) => {
    if (filterType !== "all" && a.stakeholder_type !== filterType) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: appreciations.length,
    envoye: appreciations.filter((a) => a.status === "envoye").length,
    recu: appreciations.filter((a) => a.status === "recu").length,
    tauxRetour: appreciations.filter((a) => a.status === "envoye" || a.status === "recu").length > 0
      ? Math.round((appreciations.filter((a) => a.status === "recu").length / appreciations.filter((a) => a.status === "envoye" || a.status === "recu").length) * 100)
      : 0,
  };

  const handleCreate = async () => {
    if (!newAppreciation.stakeholder_name.trim()) {
      toast({ title: "Erreur", description: "Veuillez saisir un nom.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const token = uuidv4();
      const { error } = await (supabase as any).from("stakeholder_appreciations").insert({
        stakeholder_type: newAppreciation.stakeholder_type,
        stakeholder_name: newAppreciation.stakeholder_name.trim(),
        stakeholder_email: newAppreciation.stakeholder_email.trim() || null,
        training_id: newAppreciation.training_id || null,
        year: newAppreciation.year,
        token,
        status: "draft",
        created_by: user?.id,
      });
      if (error) throw error;

      toast({ title: "Appréciation créée" });
      setShowAddDialog(false);
      setNewAppreciation({ stakeholder_type: "pedagogique", stakeholder_name: "", stakeholder_email: "", training_id: "", year: new Date().getFullYear() });
      fetchData();
    } catch (error) {
      console.error(error);
      toast({ title: "Erreur", description: "Impossible de créer l'appréciation.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/appreciation/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Lien copié", description: "Le lien du formulaire a été copié dans le presse-papiers." });
  };

  const handleMarkSent = async (id: string) => {
    await (supabase as any).from("stakeholder_appreciations").update({ status: "envoye", date_envoi: new Date().toISOString() }).eq("id", id);
    fetchData();
    toast({ title: "Marqué comme envoyé" });
  };

  const getTrainingName = (trainingId: string | null) => {
    if (!trainingId) return null;
    return trainings.find((t) => t.id === trainingId)?.training_name;
  };

  const handleExportRegistry = () => {
    const headers = ["Type", "Nom", "Email", "Formation", "Année", "Date envoi", "Date réception", "Statut", "Satisfaction", "Points forts", "Axes amélioration"];
    const rows = appreciations.map((a) => [
      stakeholderTypeConfig[a.stakeholder_type]?.label || a.stakeholder_type,
      a.stakeholder_name,
      a.stakeholder_email || "",
      getTrainingName(a.training_id) || "",
      a.year,
      a.date_envoi ? new Date(a.date_envoi).toLocaleDateString("fr-FR") : "",
      a.date_reception ? new Date(a.date_reception).toLocaleDateString("fr-FR") : "",
      statusConfig[a.status]?.label || a.status,
      a.satisfaction_globale?.toString() || "",
      a.points_forts || "",
      a.axes_amelioration || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join("\t")).join("\n");
    navigator.clipboard.writeText(csv);
    toast({ title: "Registre copié", description: "Le registre a été copié dans le presse-papiers (format tableur)." });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Appréciations parties prenantes</h1>
              <p className="text-sm text-muted-foreground">Indicateur 30 Qualiopi — Recueil des appréciations</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportRegistry}>
              <Copy className="h-4 w-4 mr-2" />
              Exporter registre
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau recueil
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle><div className="text-2xl font-bold">{stats.total}</div></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Envoyés</CardTitle><div className="text-2xl font-bold">{stats.envoye}</div></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Reçus</CardTitle><div className="text-2xl font-bold">{stats.recu}</div></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Taux de retour</CardTitle><div className="text-2xl font-bold">{stats.tauxRetour}%</div></CardHeader></Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les parties prenantes</SelectItem>
                {Object.entries(stakeholderTypeConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="draft">Brouillon</SelectItem>
              <SelectItem value="envoye">Envoyé</SelectItem>
              <SelectItem value="recu">Reçu</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <Card>
          <CardHeader><CardTitle>Liste des appréciations</CardTitle></CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucune appréciation enregistrée.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((a) => {
                  const typeConfig = stakeholderTypeConfig[a.stakeholder_type];
                  const stConfig = statusConfig[a.status];
                  return (
                    <div key={a.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{a.stakeholder_name}</span>
                            {typeConfig && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.color}`}>
                                {typeConfig.icon}
                                {typeConfig.label}
                              </span>
                            )}
                            {stConfig && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stConfig.color}`}>
                                {stConfig.label}
                              </span>
                            )}
                            {a.satisfaction_globale && (
                              <Badge variant="outline">{a.satisfaction_globale}/5</Badge>
                            )}
                          </div>
                          {a.stakeholder_email && (
                            <div className="text-sm text-muted-foreground mt-1">{a.stakeholder_email}</div>
                          )}
                          {a.training_id && (
                            <div className="text-sm text-muted-foreground mt-1">
                              Formation : {getTrainingName(a.training_id)}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-2">
                            Année {a.year}
                            {a.date_envoi && <> • Envoyé le {new Date(a.date_envoi).toLocaleDateString("fr-FR")}</>}
                            {a.date_reception && <> • Reçu le {new Date(a.date_reception).toLocaleDateString("fr-FR")}</>}
                          </div>
                          {a.status === "recu" && (a.points_forts || a.axes_amelioration) && (
                            <div className="mt-2 text-sm space-y-1">
                              {a.points_forts && <p><strong>Points forts :</strong> {a.points_forts}</p>}
                              {a.axes_amelioration && <p><strong>Axes d'amélioration :</strong> {a.axes_amelioration}</p>}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" title="Copier le lien" onClick={() => handleCopyLink(a.token)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          {a.status === "draft" && (
                            <Button variant="ghost" size="icon" title="Marquer comme envoyé" onClick={() => handleMarkSent(a.id)}>
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau recueil d'appréciation</DialogTitle>
            <DialogDescription>Créez un lien de recueil pour une partie prenante.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type de partie prenante *</Label>
              <Select value={newAppreciation.stakeholder_type} onValueChange={(v) => setNewAppreciation({ ...newAppreciation, stakeholder_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(stakeholderTypeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nom / Structure *</Label>
              <Input value={newAppreciation.stakeholder_name} onChange={(e) => setNewAppreciation({ ...newAppreciation, stakeholder_name: e.target.value })} placeholder="Ex: Jean Dupont" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={newAppreciation.stakeholder_email} onChange={(e) => setNewAppreciation({ ...newAppreciation, stakeholder_email: e.target.value })} placeholder="email@exemple.fr" />
            </div>
            <div className="space-y-2">
              <Label>Formation (optionnel)</Label>
              <Select value={newAppreciation.training_id} onValueChange={(v) => setNewAppreciation({ ...newAppreciation, training_id: v })}>
                <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucune</SelectItem>
                  {trainings.map((t) => <SelectItem key={t.id} value={t.id}>{t.training_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Année</Label>
              <Input type="number" value={newAppreciation.year} onChange={(e) => setNewAppreciation({ ...newAppreciation, year: parseInt(e.target.value) || new Date().getFullYear() })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Appreciations;
