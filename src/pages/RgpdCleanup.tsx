import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Shield,
  Trash2,
  Eye,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Users,
  CalendarDays,
  RefreshCw,
  History,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EligibleTraining {
  training_id: string;
  training_name: string;
  client_name: string;
  end_date: string;
  participants_count: number;
  days_since_end: number;
}

interface CleanupLog {
  id: string;
  cleanup_date: string;
  cutoff_date: string;
  trainings_anonymized: number;
  participants_anonymized: number;
  questionnaires_deleted: number;
  evaluations_anonymized: number;
  signatures_deleted: number;
  emails_purged: number;
  executed_by: string;
  execution_mode: string;
}

const RgpdCleanup = () => {
  const [loading, setLoading] = useState(false);
  const [eligibleTrainings, setEligibleTrainings] = useState<EligibleTraining[]>([]);
  const [cleanupLogs, setCleanupLogs] = useState<CleanupLog[]>([]);
  const [cutoffDate, setCutoffDate] = useState<string>("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [executing, setExecuting] = useState(false);
  const { toast } = useToast();

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("rgpd-cleanup", {
        body: { action: "preview", cutoffYears: 3 },
      });

      if (error) throw error;

      setEligibleTrainings(data.eligible_trainings || []);
      setCutoffDate(data.cutoff_date);
    } catch (err) {
      console.error("Error fetching preview:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les formations \u00e9ligibles.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("rgpd-cleanup", {
        body: { action: "history" },
      });

      if (error) throw error;

      setCleanupLogs(data.logs || []);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  useEffect(() => {
    fetchPreview();
    fetchHistory();
  }, []);

  const handleExecuteCleanup = async () => {
    setExecuting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const executedBy = userData.user?.email || "unknown";

      const { data, error } = await supabase.functions.invoke("rgpd-cleanup", {
        body: {
          action: "execute",
          cutoffYears: 3,
          executedBy,
        },
      });

      if (error) throw error;

      toast({
        title: "Nettoyage RGPD termin\u00e9",
        description: `${data.trainings_anonymized} formation(s) anonymis\u00e9e(s), ${data.participants_anonymized} participant(s) trait\u00e9(s).`,
      });

      // Refresh data
      fetchPreview();
      fetchHistory();
    } catch (err) {
      console.error("Error executing cleanup:", err);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors du nettoyage RGPD.",
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
      setShowConfirmDialog(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd MMMM yyyy", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy '\u00e0' HH:mm", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const totalParticipants = eligibleTrainings.reduce(
    (sum, t) => sum + (t.participants_count || 0),
    0
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Conformit\u00e9 RGPD
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestion de la purge des donn\u00e9es personnelles apr\u00e8s 3 ans (Qualiopi)
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            fetchPreview();
            fetchHistory();
          }}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      <Tabs defaultValue="preview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Aper\u00e7u
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Formations \u00e9ligibles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{eligibleTrainings.length}</div>
                <p className="text-xs text-muted-foreground">
                  termin\u00e9es avant le {cutoffDate && formatDate(cutoffDate)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Participants concern\u00e9s
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalParticipants}</div>
                <p className="text-xs text-muted-foreground">
                  donn\u00e9es \u00e0 anonymiser
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  D\u00e9lai de conservation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">3 ans</div>
                <p className="text-xs text-muted-foreground">
                  conform\u00e9ment \u00e0 Qualiopi
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Eligible Trainings Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    Formations \u00e9ligibles au nettoyage
                  </CardTitle>
                  <CardDescription>
                    Ces formations ont plus de 3 ans et leurs donn\u00e9es personnelles peuvent \u00eatre anonymis\u00e9es
                  </CardDescription>
                </div>
                {eligibleTrainings.length > 0 && (
                  <Button
                    variant="destructive"
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={executing}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Ex\u00e9cuter le nettoyage
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : eligibleTrainings.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
                  <h3 className="font-semibold">Aucune formation \u00e9ligible</h3>
                  <p className="text-muted-foreground">
                    Toutes les formations de moins de 3 ans sont conserv\u00e9es.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Formation</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Date de fin</TableHead>
                      <TableHead>Anciennet\u00e9</TableHead>
                      <TableHead className="text-right">Participants</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eligibleTrainings.map((training) => (
                      <TableRow key={training.training_id}>
                        <TableCell className="font-medium">
                          {training.training_name}
                        </TableCell>
                        <TableCell>{training.client_name}</TableCell>
                        <TableCell>{formatDate(training.end_date)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {Math.floor(training.days_since_end / 365)} ans
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {training.participants_count}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Info Box */}
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-800">
                    Informations sur le nettoyage RGPD
                  </h4>
                  <ul className="text-sm text-amber-700 mt-2 space-y-1">
                    <li>
                      \u2022 Les donn\u00e9es personnelles des participants sont anonymis\u00e9es (nom, email, entreprise)
                    </li>
                    <li>
                      \u2022 Les questionnaires de besoins sont supprim\u00e9s
                    </li>
                    <li>
                      \u2022 Les signatures d'\u00e9margement sont supprim\u00e9es
                    </li>
                    <li>
                      \u2022 Les \u00e9valuations sont conserv\u00e9es de mani\u00e8re anonyme (statistiques)
                    </li>
                    <li>
                      \u2022 Cette action est <strong>irr\u00e9versible</strong>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historique des nettoyages
              </CardTitle>
              <CardDescription>
                Journal des op\u00e9rations de purge RGPD effectu\u00e9es
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cleanupLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <h3 className="font-semibold">Aucun nettoyage effectu\u00e9</h3>
                  <p className="text-muted-foreground">
                    L'historique des op\u00e9rations de purge appara\u00eetra ici.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date d'ex\u00e9cution</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Ex\u00e9cut\u00e9 par</TableHead>
                      <TableHead className="text-right">Formations</TableHead>
                      <TableHead className="text-right">Participants</TableHead>
                      <TableHead className="text-right">Questionnaires</TableHead>
                      <TableHead className="text-right">Signatures</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cleanupLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{formatDateTime(log.cleanup_date)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={log.execution_mode === "automatic" ? "default" : "secondary"}
                          >
                            {log.execution_mode === "automatic" ? "Auto" : "Manuel"}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.executed_by || "-"}</TableCell>
                        <TableCell className="text-right">
                          {log.trainings_anonymized}
                        </TableCell>
                        <TableCell className="text-right">
                          {log.participants_anonymized}
                        </TableCell>
                        <TableCell className="text-right">
                          {log.questionnaires_deleted}
                        </TableCell>
                        <TableCell className="text-right">
                          {log.signatures_deleted}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmer le nettoyage RGPD
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Vous \u00eates sur le point d'anonymiser les donn\u00e9es personnelles de{" "}
                <strong>{eligibleTrainings.length} formation(s)</strong> et{" "}
                <strong>{totalParticipants} participant(s)</strong>.
              </p>
              <p className="text-destructive font-semibold">
                Cette action est irr\u00e9versible.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteCleanup}
              disabled={executing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {executing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Nettoyage en cours...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Confirmer le nettoyage
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RgpdCleanup;
