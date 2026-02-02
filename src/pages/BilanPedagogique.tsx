import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  FileSpreadsheet,
  Download,
  RefreshCw,
  Loader2,
  Users,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Building2,
  TrendingUp,
  ArrowLeft,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SupertiltLogo from "@/components/SupertiltLogo";
import UserMenu from "@/components/UserMenu";

interface BPFData {
  year: number;
  statistics: {
    totalTrainings: number;
    totalParticipants: number;
    totalHours: number;
    byFormat: {
      intra: { trainings: number; participants: number; hours: number };
      inter: { trainings: number; participants: number; hours: number };
      online: { trainings: number; participants: number; hours: number };
    };
    byMonth: Array<{
      month: number;
      trainings: number;
      participants: number;
      hours: number;
    }>;
  };
  trainings: Array<{
    id: string;
    name: string;
    client: string;
    startDate: string;
    format: string;
    participantsCount: number;
    totalHours: number;
    hasEvaluations: boolean;
    hasAttendance: boolean;
  }>;
  missingElements: Array<{
    trainingId: string;
    trainingName: string;
    missing: string[];
  }>;
}

const BilanPedagogique = () => {
  const [loading, setLoading] = useState(true);
  const [bpfData, setBpfData] = useState<BPFData | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      fetchBPFData();
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchBPFData();
    }
  }, [selectedYear]);

  const fetchBPFData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-bpf", {
        body: { year: selectedYear },
      });

      if (error) throw error;
      setBpfData(data.data);
    } catch (err) {
      console.error("Error fetching BPF:", err);
      toast({
        title: "Erreur",
        description: "Impossible de g\u00e9n\u00e9rer le bilan.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const exportToCSV = () => {
    if (!bpfData) return;

    const headers = ["Formation", "Client", "Date", "Format", "Participants", "Heures", "Evaluations", "Emargement"];
    const rows = bpfData.trainings.map((t) => [
      t.name,
      t.client,
      t.startDate,
      t.format,
      t.participantsCount,
      t.totalHours,
      t.hasEvaluations ? "Oui" : "Non",
      t.hasAttendance ? "Oui" : "Non",
    ]);

    const csvContent = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BPF_${selectedYear}.csv`;
    link.click();

    toast({
      title: "Export r\u00e9ussi",
      description: "Le fichier CSV a \u00e9t\u00e9 t\u00e9l\u00e9charg\u00e9.",
    });
  };

  const getFormatLabel = (format: string) => {
    switch (format) {
      case "intra":
        return "Intra";
      case "inter":
        return "Inter";
      case "online":
        return "En ligne";
      default:
        return format;
    }
  };

  const getMissingLabel = (missing: string) => {
    switch (missing) {
      case "evaluations":
        return "Aucune \u00e9valuation";
      case "evaluations_incomplete":
        return "\u00c9valuations incompl\u00e8tes";
      case "attendance":
        return "Pas d'\u00e9margement";
      default:
        return missing;
    }
  };

  const monthNames = [
    "Jan", "F\u00e9v", "Mar", "Avr", "Mai", "Juin",
    "Juil", "Ao\u00fbt", "Sep", "Oct", "Nov", "D\u00e9c"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-foreground text-background py-4 px-4 sm:px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <SupertiltLogo className="h-8 sm:h-10" invert />
            <span className="text-lg sm:text-xl font-bold hidden xs:inline">SuperTools</span>
          </div>
          {user && <UserMenu user={user} onLogout={handleLogout} />}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header with controls */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0 mt-1">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-primary/10 hidden sm:block">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Bilan P\u00e9dagogique et Financier</h1>
                <p className="text-sm text-muted-foreground">Donn\u00e9es pour la d\u00e9claration annuelle</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 ml-0 sm:ml-12">
            <Select
              value={selectedYear.toString()}
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-24 sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchBPFData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
            <Button size="sm" onClick={exportToCSV} disabled={!bpfData}>
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : bpfData ? (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Actions de formation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{bpfData.statistics.totalTrainings}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Stagiaires form\u00e9s
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{bpfData.statistics.totalParticipants}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Heures-stagiaires
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {Math.round(bpfData.statistics.totalHours)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    \u00c9l\u00e9ments manquants
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-600">
                    {bpfData.missingElements.length}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
                <TabsTrigger value="trainings">Formations</TabsTrigger>
                <TabsTrigger value="missing">
                  \u00c0 compl\u00e9ter
                  {bpfData.missingElements.length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {bpfData.missingElements.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                {/* By Format */}
                <Card>
                  <CardHeader>
                    <CardTitle>R\u00e9partition par format</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                        <div className="flex items-center gap-2 text-blue-700 mb-2">
                          <Building2 className="h-5 w-5" />
                          <span className="font-semibold">Intra-entreprise</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p>{bpfData.statistics.byFormat.intra.trainings} formations</p>
                          <p>{bpfData.statistics.byFormat.intra.participants} stagiaires</p>
                          <p>{Math.round(bpfData.statistics.byFormat.intra.hours)} h-stagiaires</p>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                        <div className="flex items-center gap-2 text-green-700 mb-2">
                          <Users className="h-5 w-5" />
                          <span className="font-semibold">Inter-entreprises</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p>{bpfData.statistics.byFormat.inter.trainings} formations</p>
                          <p>{bpfData.statistics.byFormat.inter.participants} stagiaires</p>
                          <p>{Math.round(bpfData.statistics.byFormat.inter.hours)} h-stagiaires</p>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                        <div className="flex items-center gap-2 text-purple-700 mb-2">
                          <TrendingUp className="h-5 w-5" />
                          <span className="font-semibold">En ligne</span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p>{bpfData.statistics.byFormat.online.trainings} formations</p>
                          <p>{bpfData.statistics.byFormat.online.participants} stagiaires</p>
                          <p>{Math.round(bpfData.statistics.byFormat.online.hours)} h-stagiaires</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* By Month */}
                <Card>
                  <CardHeader>
                    <CardTitle>Activit\u00e9 mensuelle</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mois</TableHead>
                          <TableHead className="text-right">Formations</TableHead>
                          <TableHead className="text-right">Stagiaires</TableHead>
                          <TableHead className="text-right">Heures-stagiaires</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bpfData.statistics.byMonth.map((m) => (
                          <TableRow key={m.month}>
                            <TableCell>{monthNames[m.month - 1]}</TableCell>
                            <TableCell className="text-right">{m.trainings}</TableCell>
                            <TableCell className="text-right">{m.participants}</TableCell>
                            <TableCell className="text-right">{Math.round(m.hours)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="trainings">
                <Card>
                  <CardHeader>
                    <CardTitle>Liste des formations</CardTitle>
                    <CardDescription>
                      Toutes les formations de l'ann\u00e9e {selectedYear}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Formation</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Format</TableHead>
                          <TableHead className="text-right">Participants</TableHead>
                          <TableHead className="text-right">Heures</TableHead>
                          <TableHead className="text-center">\u00c9val.</TableHead>
                          <TableHead className="text-center">\u00c9marg.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bpfData.trainings.map((t) => (
                          <TableRow
                            key={t.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => navigate(`/formations/${t.id}`)}
                          >
                            <TableCell className="font-medium">{t.name}</TableCell>
                            <TableCell>{t.client}</TableCell>
                            <TableCell>
                              {format(new Date(t.startDate), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{getFormatLabel(t.format)}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{t.participantsCount}</TableCell>
                            <TableCell className="text-right">{t.totalHours}</TableCell>
                            <TableCell className="text-center">
                              {t.hasEvaluations ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {t.hasAttendance ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="missing">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      \u00c9l\u00e9ments manquants pour le BPF
                    </CardTitle>
                    <CardDescription>
                      Ces formations n\u00e9cessitent des compl\u00e9ments pour \u00eatre conformes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {bpfData.missingElements.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
                        <p className="font-semibold">Tout est complet !</p>
                        <p className="text-muted-foreground">
                          Toutes les formations ont leurs \u00e9valuations et \u00e9margements.
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Formation</TableHead>
                            <TableHead>\u00c9l\u00e9ments manquants</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bpfData.missingElements.map((item) => (
                            <TableRow key={item.trainingId}>
                              <TableCell className="font-medium">{item.trainingName}</TableCell>
                              <TableCell>
                                <div className="flex gap-2 flex-wrap">
                                  {item.missing.map((m) => (
                                    <Badge key={m} variant="destructive">
                                      {getMissingLabel(m)}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/formations/${item.trainingId}`)}
                                >
                                  Voir
                                </Button>
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
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucune donn\u00e9e disponible</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default BilanPedagogique;
