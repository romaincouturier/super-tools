import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CRMLayout from "@/components/crm/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  FileText,
  Search,
  Building2,
  Euro,
  Calendar,
  Send,
  CheckCircle,
  XCircle,
  Eye,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Quote {
  id: string;
  quote_number: string;
  lead_id: string;
  title: string;
  description: string | null;
  amount_ht: number;
  tax_rate: number;
  amount_ttc: number;
  status: string;
  valid_until: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  created_at: string;
  crm_leads?: {
    id: string;
    company_name: string;
    contact_name: string | null;
    contact_email: string | null;
  };
}

interface Lead {
  id: string;
  company_name: string;
  contact_name: string | null;
}

export default function Quotes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newQuote, setNewQuote] = useState({
    lead_id: searchParams.get("lead") || "",
    title: "",
    description: "",
    amount_ht: "",
    tax_rate: "20",
    valid_until: "",
  });

  useEffect(() => {
    fetchQuotes();
    fetchLeads();
  }, [statusFilter]);

  const fetchQuotes = async () => {
    let query = supabase
      .from("crm_quotes")
      .select("*, crm_leads(id, company_name, contact_name, contact_email)")
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les devis",
        variant: "destructive",
      });
    } else {
      setQuotes(data || []);
    }
    setLoading(false);
  };

  const fetchLeads = async () => {
    const { data } = await supabase
      .from("crm_leads")
      .select("id, company_name, contact_name")
      .order("company_name");

    if (data) setLeads(data);
  };

  const createQuote = async () => {
    if (!newQuote.lead_id || !newQuote.title.trim() || !newQuote.amount_ht) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    const amountHt = parseFloat(newQuote.amount_ht);
    const taxRate = parseFloat(newQuote.tax_rate);
    const amountTtc = amountHt * (1 + taxRate / 100);

    const { error } = await supabase.from("crm_quotes").insert({
      lead_id: newQuote.lead_id,
      title: newQuote.title,
      description: newQuote.description || null,
      amount_ht: amountHt,
      tax_rate: taxRate,
      amount_ttc: amountTtc,
      valid_until: newQuote.valid_until || null,
      status: "draft",
    });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de creer le devis",
        variant: "destructive",
      });
    } else {
      setDialogOpen(false);
      setNewQuote({
        lead_id: "",
        title: "",
        description: "",
        amount_ht: "",
        tax_rate: "20",
        valid_until: "",
      });
      fetchQuotes();
      toast({
        title: "Devis cree",
        description: "Le devis a ete cree avec succes",
      });
    }
  };

  const updateQuoteStatus = async (quoteId: string, status: string) => {
    const updates: Record<string, string | null> = { status };

    if (status === "sent") {
      updates.sent_at = new Date().toISOString();
    } else if (status === "accepted") {
      updates.accepted_at = new Date().toISOString();
    } else if (status === "rejected") {
      updates.rejected_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("crm_quotes")
      .update(updates)
      .eq("id", quoteId);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre a jour le statut",
        variant: "destructive",
      });
    } else {
      fetchQuotes();
      toast({
        title: "Statut mis a jour",
        description: `Le devis a ete marque comme ${getStatusLabel(status).toLowerCase()}`,
      });
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft":
        return "Brouillon";
      case "sent":
        return "Envoye";
      case "accepted":
        return "Accepte";
      case "rejected":
        return "Refuse";
      case "expired":
        return "Expire";
      default:
        return status;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Brouillon</Badge>;
      case "sent":
        return <Badge variant="default">Envoye</Badge>;
      case "accepted":
        return <Badge className="bg-green-500">Accepte</Badge>;
      case "rejected":
        return <Badge variant="destructive">Refuse</Badge>;
      case "expired":
        return <Badge variant="outline">Expire</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredQuotes = quotes.filter(
    (quote) =>
      quote.title.toLowerCase().includes(search.toLowerCase()) ||
      quote.quote_number.toLowerCase().includes(search.toLowerCase()) ||
      quote.crm_leads?.company_name.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const totalDraft = quotes.filter((q) => q.status === "draft").length;
  const totalSent = quotes.filter((q) => q.status === "sent").length;
  const totalAccepted = quotes
    .filter((q) => q.status === "accepted")
    .reduce((sum, q) => sum + q.amount_ttc, 0);
  const conversionRate =
    quotes.length > 0
      ? Math.round(
          (quotes.filter((q) => q.status === "accepted").length /
            quotes.filter((q) => q.status !== "draft").length) *
            100
        ) || 0
      : 0;

  return (
    <CRMLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Devis</h1>
            <p className="text-muted-foreground">
              Gerez vos propositions commerciales
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau devis
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Creer un devis</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Lead *</Label>
                  <Select
                    value={newQuote.lead_id}
                    onValueChange={(v) =>
                      setNewQuote({ ...newQuote, lead_id: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner un lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {leads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.company_name}
                          {lead.contact_name && ` - ${lead.contact_name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Titre *</Label>
                  <Input
                    value={newQuote.title}
                    onChange={(e) =>
                      setNewQuote({ ...newQuote, title: e.target.value })
                    }
                    placeholder="Ex: Formation React avancee"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newQuote.description}
                    onChange={(e) =>
                      setNewQuote({ ...newQuote, description: e.target.value })
                    }
                    placeholder="Details du devis..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Montant HT *</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={newQuote.amount_ht}
                        onChange={(e) =>
                          setNewQuote({ ...newQuote, amount_ht: e.target.value })
                        }
                        placeholder="0.00"
                        className="pr-8"
                      />
                      <Euro className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div>
                    <Label>TVA (%)</Label>
                    <Select
                      value={newQuote.tax_rate}
                      onValueChange={(v) =>
                        setNewQuote({ ...newQuote, tax_rate: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="5.5">5.5%</SelectItem>
                        <SelectItem value="10">10%</SelectItem>
                        <SelectItem value="20">20%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {newQuote.amount_ht && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span>Montant TTC</span>
                      <span className="font-medium">
                        {(
                          parseFloat(newQuote.amount_ht) *
                          (1 + parseFloat(newQuote.tax_rate) / 100)
                        ).toLocaleString("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </span>
                    </div>
                  </div>
                )}
                <div>
                  <Label>Valide jusqu'au</Label>
                  <Input
                    type="date"
                    value={newQuote.valid_until}
                    onChange={(e) =>
                      setNewQuote({ ...newQuote, valid_until: e.target.value })
                    }
                  />
                </div>
                <Button onClick={createQuote} className="w-full">
                  Creer le devis
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-100 rounded-full">
                  <FileText className="h-6 w-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalDraft}</p>
                  <p className="text-sm text-muted-foreground">Brouillons</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Send className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalSent}</p>
                  <p className="text-sm text-muted-foreground">Envoyes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <Euro className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {totalAccepted.toLocaleString("fr-FR")}
                  </p>
                  <p className="text-sm text-muted-foreground">EUR acceptes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-full">
                  <CheckCircle className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{conversionRate}%</p>
                  <p className="text-sm text-muted-foreground">Conversion</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un devis..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="draft">Brouillons</SelectItem>
              <SelectItem value="sent">Envoyes</SelectItem>
              <SelectItem value="accepted">Acceptes</SelectItem>
              <SelectItem value="rejected">Refuses</SelectItem>
              <SelectItem value="expired">Expires</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quotes Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucun devis</h3>
              <p className="text-muted-foreground mb-4">
                Commencez par creer un nouveau devis
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau devis
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numero</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead className="hidden sm:table-cell">Lead</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead>Montant TTC</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-mono text-sm">
                        {quote.quote_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{quote.title}</p>
                          <p className="text-sm text-muted-foreground sm:hidden">
                            {quote.crm_leads?.company_name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <button
                          onClick={() =>
                            navigate(`/crm/leads/${quote.crm_leads?.id}`)
                          }
                          className="flex items-center gap-1 text-sm hover:text-primary"
                        >
                          <Building2 className="h-3 w-3" />
                          {quote.crm_leads?.company_name}
                        </button>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {format(new Date(quote.created_at), "dd/MM/yyyy", {
                          locale: fr,
                        })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {quote.amount_ttc.toLocaleString("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </TableCell>
                      <TableCell>{getStatusBadge(quote.status)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {quote.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateQuoteStatus(quote.id, "sent")
                              }
                              title="Marquer comme envoye"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          {quote.status === "sent" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  updateQuoteStatus(quote.id, "accepted")
                                }
                                title="Marquer comme accepte"
                                className="text-green-600"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  updateQuoteStatus(quote.id, "rejected")
                                }
                                title="Marquer comme refuse"
                                className="text-red-600"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </CRMLayout>
  );
}
