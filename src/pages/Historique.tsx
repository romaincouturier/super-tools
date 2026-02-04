import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, History, Award, FileText, RefreshCw, Search, X, Calendar, UserPlus, UserMinus, Send, Mail, Edit, Heart, ChevronDown, ChevronUp } from "lucide-react";
import AppHeader from "@/components/AppHeader";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  training_created: { 
    label: "Formation créée", 
    icon: <Calendar className="w-4 h-4" />,
    variant: "default" 
  },
  training_updated: { 
    label: "Formation modifiée", 
    icon: <Edit className="w-4 h-4" />,
    variant: "outline" 
  },
  participant_added: { 
    label: "Participant ajouté", 
    icon: <UserPlus className="w-4 h-4" />,
    variant: "secondary" 
  },
  participant_removed: { 
    label: "Participant supprimé", 
    icon: <UserMinus className="w-4 h-4" />,
    variant: "outline" 
  },
  needs_survey_sent: { 
    label: "Recueil des besoins envoyé", 
    icon: <Send className="w-4 h-4" />,
    variant: "secondary" 
  },
  training_documents_sent: { 
    label: "Documents de formation envoyés", 
    icon: <Mail className="w-4 h-4" />,
    variant: "default" 
  },
  thank_you_email_sent: { 
    label: "Email de remerciement envoyé", 
    icon: <Heart className="w-4 h-4" />,
    variant: "secondary" 
  },
  accessibility_needs_email_sent: { 
    label: "Besoins d'accessibilité envoyé", 
    icon: <Heart className="w-4 h-4" />,
    variant: "outline" 
  },
  attendance_signature_request_sent: { 
    label: "Demande d'émargement envoyée", 
    icon: <Send className="w-4 h-4" />,
    variant: "default" 
  },
  needs_survey_reminder_sent: { 
    label: "Rappel de questionnaire envoyé", 
    icon: <RefreshCw className="w-4 h-4" />,
    variant: "outline" 
  },
  questionnaire_confirmation_sent: { 
    label: "Confirmation de questionnaire envoyée", 
    icon: <Mail className="w-4 h-4" />,
    variant: "secondary" 
  },
  scheduled_email_force_sent: { 
    label: "Email programmé envoyé manuellement", 
    icon: <Send className="w-4 h-4" />,
    variant: "outline" 
  },
  evaluation_processed: { 
    label: "Évaluation traitée", 
    icon: <Award className="w-4 h-4" />,
    variant: "default" 
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
    
    if (details.training_name) {
      parts.push(String(details.training_name));
    }
    if (details.formation_name) {
      parts.push(String(details.formation_name));
    }
    if (details.participant_name && String(details.participant_name).trim()) {
      parts.push(String(details.participant_name));
    }
    if (details.client_name) {
      parts.push(String(details.client_name));
    }
    if (details.document_type) {
      const docTypes: Record<string, string> = {
        invoice: "Facture",
        sheets: "Feuilles d'émargement",
        all: "Tous les documents",
      };
      parts.push(docTypes[String(details.document_type)] || String(details.document_type));
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
      <AppHeader />

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
              <div className="space-y-2">
                {filteredLogs.map((log) => {
                  const actionInfo = getActionInfo(log.action_type);
                  const hasEmailDetails = log.details?.email_subject || log.details?.email_content;
                  
                  return (
                    <Collapsible key={log.id}>
                      <div className="border rounded-lg">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-4 p-3 hover:bg-muted/50 cursor-pointer transition-colors">
                            <div className="w-[140px] font-mono text-sm text-muted-foreground shrink-0">
                              {formatDateTime(log.created_at)}
                            </div>
                            <div className="w-[160px] shrink-0">
                              <Badge variant={actionInfo.variant} className="gap-1">
                                {actionInfo.icon}
                                {actionInfo.label}
                              </Badge>
                            </div>
                            <div className="font-medium shrink-0 w-[200px] truncate">
                              {log.recipient_email}
                            </div>
                            <div className="flex-1 text-muted-foreground text-sm truncate">
                              {getDetailsDisplay(log)}
                            </div>
                            {hasEmailDetails && (
                              <Badge variant="outline" className="gap-1 shrink-0">
                                <Mail className="w-3 h-3" />
                                Voir l'email
                                <ChevronDown className="w-3 h-3 transition-transform [[data-state=open]_&]:rotate-180" />
                              </Badge>
                            )}
                          </div>
                        </CollapsibleTrigger>
                        {hasEmailDetails && (
                          <CollapsibleContent>
                            <div className="border-t bg-muted/30 p-4 space-y-3">
                              {log.details?.email_subject && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">Sujet du mail</Label>
                                  <p className="font-medium">{String(log.details.email_subject)}</p>
                                </div>
                              )}
                              {log.details?.email_content && (
                                <div>
                                  <Label className="text-xs text-muted-foreground">Contenu du mail</Label>
                                  <div className="text-sm whitespace-pre-wrap bg-background rounded-md p-3 border mt-1 max-h-[300px] overflow-y-auto">
                                    {String(log.details.email_content)}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        )}
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Historique;
