import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, History, Award, FileText, RefreshCw, Search, X } from "lucide-react";
import SupertiltLogo from "@/components/SupertiltLogo";
import UserMenu from "@/components/UserMenu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ActivityLog {
  id: string;
  created_at: string;
  action_type: string;
  recipient_email: string;
  details: Record<string, unknown>;
}

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "outline" }> = {
  certificate_sent: { 
    label: "Certificat envoyé", 
    icon: <Award className="w-4 h-4" />,
    variant: "default" 
  },
  micro_devis_sent: { 
    label: "Micro-devis envoyé", 
    icon: <FileText className="w-4 h-4" />,
    variant: "secondary" 
  },
};

const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatDateForInput = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

const Historique = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const navigate = useNavigate();

  // Search filters
  const [searchRecipient, setSearchRecipient] = useState("");
  const [searchDetails, setSearchDetails] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        if (!session?.user) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs((data as ActivityLog[]) || []);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getActionInfo = (actionType: string) => {
    return ACTION_LABELS[actionType] || { 
      label: actionType, 
      icon: <History className="w-4 h-4" />,
      variant: "outline" as const
    };
  };

  const getDetailsDisplay = (log: ActivityLog): string => {
    const details = log.details;
    if (!details) return "-";
    
    const parts: string[] = [];
    
    if (details.formation_name) {
      parts.push(String(details.formation_name));
    }
    if (details.participant_name) {
      parts.push(String(details.participant_name));
    }
    if (details.type_subrogation) {
      const subrogationLabels: Record<string, string> = {
        sans: "Sans subrogation",
        avec: "Avec subrogation",
        les2: "Les 2 devis",
      };
      parts.push(subrogationLabels[String(details.type_subrogation)] || String(details.type_subrogation));
    }
    
    return parts.length > 0 ? parts.join(" • ") : "-";
  };

  const clearFilters = () => {
    setSearchRecipient("");
    setSearchDetails("");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = searchRecipient || searchDetails || dateFrom || dateTo;

  // Filter logs based on search criteria
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by recipient email
      if (searchRecipient && !log.recipient_email.toLowerCase().includes(searchRecipient.toLowerCase())) {
        return false;
      }

      // Filter by details
      if (searchDetails) {
        const detailsStr = getDetailsDisplay(log).toLowerCase();
        if (!detailsStr.includes(searchDetails.toLowerCase())) {
          return false;
        }
      }

      // Filter by date range
      if (dateFrom) {
        const logDate = new Date(log.created_at);
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (logDate < fromDate) {
          return false;
        }
      }

      if (dateTo) {
        const logDate = new Date(log.created_at);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (logDate > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [logs, searchRecipient, searchDetails, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-foreground text-background py-4 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SupertiltLogo className="h-10" invert />
            <span className="text-xl font-bold">SuperTools</span>
          </div>
          {user && <UserMenu user={user} onLogout={handleLogout} />}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
              <History className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold">Historique des activités</h1>
          </div>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLogs}
              disabled={loadingLogs}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingLogs ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Search Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="w-5 h-5" />
                Recherche
              </CardTitle>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Effacer les filtres
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="searchRecipient">Destinataire</Label>
                <Input
                  id="searchRecipient"
                  type="text"
                  placeholder="Email..."
                  value={searchRecipient}
                  onChange={(e) => setSearchRecipient(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="searchDetails">Détails</Label>
                <Input
                  id="searchDetails"
                  type="text"
                  placeholder="Formation, participant..."
                  value={searchDetails}
                  onChange={(e) => setSearchDetails(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateFrom">Date de début</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateTo">Date de fin</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Dernières activités
              {hasActiveFilters && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({filteredLogs.length} résultat{filteredLogs.length !== 1 ? "s" : ""})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLogs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {hasActiveFilters ? "Aucun résultat pour ces critères" : "Aucune activité enregistrée"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Date & Heure</TableHead>
                    <TableHead className="w-[180px]">Action</TableHead>
                    <TableHead>Destinataire</TableHead>
                    <TableHead>Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const actionInfo = getActionInfo(log.action_type);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">
                          {formatDateTime(log.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={actionInfo.variant} className="gap-1">
                            {actionInfo.icon}
                            {actionInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {log.recipient_email}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {getDetailsDisplay(log)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Historique;
