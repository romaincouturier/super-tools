import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CRMLayout from "@/components/crm/CRMLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
} from "lucide-react";
import { format, isPast, addDays } from "date-fns";
import { fr } from "date-fns/locale";

interface Invoice {
  id: string;
  invoice_number: string;
  lead_id: string;
  quote_id: string | null;
  title: string;
  amount_ht: number;
  tax_rate: number;
  amount_ttc: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  crm_leads?: {
    id: string;
    company_name: string;
    contact_name: string | null;
  };
  crm_quotes?: {
    quote_number: string;
    title: string;
  };
}

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  lead_id: string;
  amount_ht: number;
  tax_rate: number;
  amount_ttc: number;
  crm_leads?: {
    company_name: string;
  };
}

interface Lead {
  id: string;
  company_name: string;
}

export default function Invoices() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    quote_id: "",
    lead_id: "",
    title: "",
    amount_ht: "",
    tax_rate: "20",
    due_date: "",
  });

  useEffect(() => {
    fetchInvoices();
    fetchQuotes();
    fetchLeads();
  }, [statusFilter]);

  const fetchInvoices = async () => {
    let query = supabase
      .from("crm_invoices")
      .select(
        "*, crm_leads(id, company_name, contact_name), crm_quotes(quote_number, title)"
      )
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les factures",
        variant: "destructive",
      });
    } else {
      setInvoices(data || []);
    }
    setLoading(false);
  };

  const fetchQuotes = async () => {
    const { data } = await supabase
      .from("crm_quotes")
      .select("id, quote_number, title, lead_id, amount_ht, tax_rate, amount_ttc, crm_leads(company_name)")
      .eq("status", "accepted")
      .order("created_at", { ascending: false });

    if (data) setQuotes(data);
  };

  const fetchLeads = async () => {
    const { data } = await supabase
      .from("crm_leads")
      .select("id, company_name")
      .order("company_name");

    if (data) setLeads(data);
  };

  const handleQuoteSelect = (quoteId: string) => {
    const quote = quotes.find((q) => q.id === quoteId);
    if (quote) {
      setNewInvoice({
        ...newInvoice,
        quote_id: quoteId,
        lead_id: quote.lead_id,
        title: quote.title,
        amount_ht: quote.amount_ht.toString(),
        tax_rate: quote.tax_rate.toString(),
        due_date: format(addDays(new Date(), 30), "yyyy-MM-dd"),
      });
    }
  };

  const createInvoice = async () => {
    if (!newInvoice.lead_id || !newInvoice.title.trim() || !newInvoice.amount_ht) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    const amountHt = parseFloat(newInvoice.amount_ht);
    const taxRate = parseFloat(newInvoice.tax_rate);
    const amountTtc = amountHt * (1 + taxRate / 100);

    const { error } = await supabase.from("crm_invoices").insert({
      lead_id: newInvoice.lead_id,
      quote_id: newInvoice.quote_id || null,
      title: newInvoice.title,
      amount_ht: amountHt,
      tax_rate: taxRate,
      amount_ttc: amountTtc,
      due_date: newInvoice.due_date || null,
      status: "draft",
    });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de creer la facture",
        variant: "destructive",
      });
    } else {
      setDialogOpen(false);
      setNewInvoice({
        quote_id: "",
        lead_id: "",
        title: "",
        amount_ht: "",
        tax_rate: "20",
        due_date: "",
      });
      fetchInvoices();
      toast({
        title: "Facture creee",
        description: "La facture a ete creee avec succes",
      });
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, status: string) => {
    const updates: Record<string, string | null> = { status };

    if (status === "paid") {
      updates.paid_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("crm_invoices")
      .update(updates)
      .eq("id", invoiceId);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre a jour le statut",
        variant: "destructive",
      });
    } else {
      fetchInvoices();
      toast({
        title: "Statut mis a jour",
        description:
          status === "paid"
            ? "La facture a ete marquee comme payee"
            : "Le statut a ete mis a jour",
      });
    }
  };

  const getStatusBadge = (invoice: Invoice) => {
    if (invoice.status === "paid") {
      return <Badge className="bg-green-500">Payee</Badge>;
    }
    if (invoice.status === "draft") {
      return <Badge variant="secondary">Brouillon</Badge>;
    }
    if (invoice.status === "sent") {
      if (invoice.due_date && isPast(new Date(invoice.due_date))) {
        return <Badge variant="destructive">En retard</Badge>;
      }
      return <Badge variant="default">Envoyee</Badge>;
    }
    if (invoice.status === "cancelled") {
      return <Badge variant="outline">Annulee</Badge>;
    }
    return <Badge variant="outline">{invoice.status}</Badge>;
  };

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.title.toLowerCase().includes(search.toLowerCase()) ||
      invoice.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      invoice.crm_leads?.company_name.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const totalPending = invoices
    .filter((i) => i.status === "sent")
    .reduce((sum, i) => sum + i.amount_ttc, 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount_ttc, 0);
  const totalOverdue = invoices
    .filter(
      (i) =>
        i.status === "sent" && i.due_date && isPast(new Date(i.due_date))
    )
    .reduce((sum, i) => sum + i.amount_ttc, 0);

  return (
    <CRMLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Factures</h1>
            <p className="text-muted-foreground">Gerez votre facturation</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle facture
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Creer une facture</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {quotes.length > 0 && (
                  <div>
                    <Label>A partir d'un devis accepte</Label>
                    <Select
                      value={newInvoice.quote_id}
                      onValueChange={handleQuoteSelect}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selectionner un devis (optionnel)" />
                      </SelectTrigger>
                      <SelectContent>
                        {quotes.map((quote) => (
                          <SelectItem key={quote.id} value={quote.id}>
                            {quote.quote_number} - {quote.title} (
                            {quote.crm_leads?.company_name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Lead *</Label>
                  <Select
                    value={newInvoice.lead_id}
                    onValueChange={(v) =>
                      setNewInvoice({ ...newInvoice, lead_id: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner un lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {leads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Titre *</Label>
                  <Input
                    value={newInvoice.title}
                    onChange={(e) =>
                      setNewInvoice({ ...newInvoice, title: e.target.value })
                    }
                    placeholder="Ex: Formation React - Janvier 2026"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Montant HT *</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={newInvoice.amount_ht}
                        onChange={(e) =>
                          setNewInvoice({
                            ...newInvoice,
                            amount_ht: e.target.value,
                          })
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
                      value={newInvoice.tax_rate}
                      onValueChange={(v) =>
                        setNewInvoice({ ...newInvoice, tax_rate: v })
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
                {newInvoice.amount_ht && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span>Montant TTC</span>
                      <span className="font-medium">
                        {(
                          parseFloat(newInvoice.amount_ht) *
                          (1 + parseFloat(newInvoice.tax_rate) / 100)
                        ).toLocaleString("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </span>
                    </div>
                  </div>
                )}
                <div>
                  <Label>Date d'echeance</Label>
                  <Input
                    type="date"
                    value={newInvoice.due_date}
                    onChange={(e) =>
                      setNewInvoice({ ...newInvoice, due_date: e.target.value })
                    }
                  />
                </div>
                <Button onClick={createInvoice} className="w-full">
                  Creer la facture
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-full">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {totalPending.toLocaleString("fr-FR")} EUR
                  </p>
                  <p className="text-sm text-muted-foreground">En attente</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {totalOverdue.toLocaleString("fr-FR")} EUR
                  </p>
                  <p className="text-sm text-muted-foreground">En retard</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {totalPaid.toLocaleString("fr-FR")} EUR
                  </p>
                  <p className="text-sm text-muted-foreground">Payees</p>
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
              placeholder="Rechercher une facture..."
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
              <SelectItem value="sent">Envoyees</SelectItem>
              <SelectItem value="paid">Payees</SelectItem>
              <SelectItem value="cancelled">Annulees</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Invoices Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucune facture</h3>
              <p className="text-muted-foreground mb-4">
                Commencez par creer une nouvelle facture
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle facture
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
                    <TableHead className="hidden md:table-cell">
                      Echeance
                    </TableHead>
                    <TableHead>Montant TTC</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{invoice.title}</p>
                          {invoice.crm_quotes && (
                            <p className="text-xs text-muted-foreground">
                              Devis {invoice.crm_quotes.quote_number}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground sm:hidden">
                            {invoice.crm_leads?.company_name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <button
                          onClick={() =>
                            navigate(`/crm/leads/${invoice.crm_leads?.id}`)
                          }
                          className="flex items-center gap-1 text-sm hover:text-primary"
                        >
                          <Building2 className="h-3 w-3" />
                          {invoice.crm_leads?.company_name}
                        </button>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {invoice.due_date
                          ? format(new Date(invoice.due_date), "dd/MM/yyyy", {
                              locale: fr,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {invoice.amount_ttc.toLocaleString("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        })}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {invoice.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                updateInvoiceStatus(invoice.id, "sent")
                              }
                            >
                              Envoyer
                            </Button>
                          )}
                          {invoice.status === "sent" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                updateInvoiceStatus(invoice.id, "paid")
                              }
                              className="text-green-600"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Payee
                            </Button>
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
