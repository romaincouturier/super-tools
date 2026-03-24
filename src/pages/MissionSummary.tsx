import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { rpc } from "@/lib/supabase-rpc";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import {
  Loader2,
  Briefcase,
  Calendar,
  Euro,
  Clock,
  Receipt,
  FileText,
  ExternalLink,
  Download,
  Package,
  Image as ImageIcon,
  CheckCircle2,
  MapPin,
  Navigation,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { getGoogleMapsDirectionsUrl, getGoogleMapsSearchUrl } from "@/lib/googleMaps";

// ---------- Types ----------

interface MissionData {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  initial_amount: number | null;
  daily_rate: number | null;
  total_days: number | null;
  emoji: string | null;
  location: string | null;
}

interface Activity {
  id: string;
  description: string;
  activity_date: string;
  duration_type: "hours" | "days";
  duration: number;
  billable_amount: number | null;
  invoice_url: string | null;
  invoice_number: string | null;
  is_billed: boolean;
  notes: string | null;
}

interface MissionDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  is_deliverable: boolean;
}

interface MissionMedia {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string;
  is_deliverable: boolean;
}

interface Deliverable {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  source: "document" | "media";
}

interface MissionAction {
  id: string;
  title: string;
  status: string;
  position: number;
}

type Lang = "fr" | "en";
type KanbanStatus = "todo" | "in_progress" | "done";

// ---------- Translations ----------

const t: Record<Lang, Record<string, string>> = {
  fr: {
    loading: "Chargement...",
    error: "Mission introuvable",
    errorDesc: "Cette mission n'existe pas ou le lien est invalide.",
    missionSummary: "Résumé de la mission",
    client: "Client",
    period: "Période",
    to: "au",
    ongoing: "En cours",
    actionsTitle: "Actions",
    todo: "À faire",
    inProgress: "En cours",
    done: "Terminé",
    invoiceSummary: "Synthèse financière (HT)",
    totalBudget: "Budget total HT",
    consumed: "Consommé HT",
    billed: "Facturé HT",
    remainingToBill: "Reste à facturer HT",
    invoices: "Factures",
    invoiceNumber: "N° Facture",
    date: "Date",
    description: "Description",
    amount: "Montant",
    status: "Statut",
    billedBadge: "Facturé",
    pendingBadge: "En attente",
    noActivities: "Aucune action enregistrée",
    noInvoices: "Aucune facture émise",
    duration: "Durée",
    hours: "h",
    days: "j",
    viewInvoice: "Voir la facture",
    progress: "Avancement",
    deliverables: "Livrables",
    downloadAll: "Télécharger tout",
    download: "Télécharger",
    noActions: "Aucune action définie",
    location: "Lieu",
    directions: "Itinéraire",
    viewOnMap: "Voir sur Google Maps",
  },
  en: {
    loading: "Loading...",
    error: "Mission not found",
    errorDesc: "This mission does not exist or the link is invalid.",
    missionSummary: "Mission Summary",
    client: "Client",
    period: "Period",
    to: "to",
    ongoing: "Ongoing",
    actionsTitle: "Actions",
    todo: "To Do",
    inProgress: "In Progress",
    done: "Done",
    invoiceSummary: "Financial Summary (excl. tax)",
    totalBudget: "Total Budget (excl. tax)",
    consumed: "Consumed (excl. tax)",
    billed: "Billed (excl. tax)",
    remainingToBill: "Remaining to bill (excl. tax)",
    invoices: "Invoices",
    invoiceNumber: "Invoice #",
    date: "Date",
    description: "Description",
    amount: "Amount",
    status: "Status",
    billedBadge: "Billed",
    pendingBadge: "Pending",
    noActivities: "No actions recorded",
    noInvoices: "No invoices issued",
    duration: "Duration",
    hours: "h",
    days: "d",
    viewInvoice: "View invoice",
    progress: "Progress",
    deliverables: "Deliverables",
    downloadAll: "Download all",
    download: "Download",
    noActions: "No actions defined",
    location: "Location",
    directions: "Directions",
    viewOnMap: "View on Google Maps",
  },
};

// ---------- Helpers ----------

function formatCurrency(amount: number, lang: Lang): string {
  return amount.toLocaleString(lang === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function isImageFile(fileName: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName);
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// ---------- Actions Kanban Column ----------

interface ActionsKanbanColumnProps {
  title: string;
  items: MissionAction[];
  color: string;
  icon: React.ReactNode;
}

const ActionsKanbanColumn = ({ title, items, color, icon }: ActionsKanbanColumnProps) => (
  <div className="flex-1 min-w-[200px]">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <h4 className="text-sm font-semibold">{title}</h4>
      <Badge variant="secondary" className="text-xs h-5 px-1.5">
        {items.length}
      </Badge>
    </div>
    <div className="space-y-2">
      {items.sort((a, b) => a.position - b.position).map((item) => (
        <Card key={item.id} className="border shadow-sm">
          <CardContent className="p-3">
            <p className="text-sm font-medium leading-snug">{item.title}</p>
          </CardContent>
        </Card>
      ))}
      {items.length === 0 && (
        <div
          className="border border-dashed rounded-lg p-4 text-center text-xs text-muted-foreground"
          style={{ borderColor: color + "40" }}
        >
          —
        </div>
      )}
    </div>
  </div>
);

// ---------- Deliverables Block ----------

interface DeliverablesBlockProps {
  deliverables: Deliverable[];
  lang: Lang;
}

const forceDownload = async (url: string, fileName: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback: open in new tab
    window.open(url, "_blank");
  }
};

const DeliverablesBlock = ({ deliverables, lang }: DeliverablesBlockProps) => {
  const L = t[lang];
  const [downloadingAll, setDownloadingAll] = useState(false);

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    try {
      for (const doc of deliverables) {
        await forceDownload(doc.file_url, doc.file_name);
        await new Promise((r) => setTimeout(r, 500));
      }
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            {L.deliverables}
            <Badge variant="secondary" className="text-xs ml-1">{deliverables.length}</Badge>
          </CardTitle>
          {deliverables.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              disabled={downloadingAll}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {L.downloadAll}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {deliverables.map((doc) => {
            const isImage = isImageFile(doc.file_name);
            return (
              <div
                key={doc.id}
                className="group border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {isImage ? (
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    <img
                      src={doc.file_url}
                      alt={doc.file_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted/50 flex items-center justify-center">
                    <FileText className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                )}
                <div className="p-3 space-y-1.5">
                  <p className="text-sm font-medium truncate" title={doc.file_name}>
                    {doc.file_name}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(doc.file_size)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary hover:text-primary/80"
                      onClick={() => forceDownload(doc.file_url, doc.file_name)}
                      title={L.download}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// ---------- Main Component ----------

const MissionSummary = () => {
  const { missionId } = useParams<{ missionId: string }>();
  const [mission, setMission] = useState<MissionData | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [documents, setDocuments] = useState<MissionDocument[]>([]);
  const [mediaItems, setMediaItems] = useState<MissionMedia[]>([]);
  const [actions, setActions] = useState<MissionAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lang, setLang] = useState<Lang>("fr");

  useEffect(() => {
    if (!missionId) return;
    const fetchData = async () => {
      try {
        const [missionRes, activitiesRes, documentsRes, actionsRes, mediaRes] = await Promise.all([
          rpc.getMissionPublicSummary(missionId!),
          rpc.getMissionActivitiesPublic(missionId!),
          rpc.getMissionDocumentsPublic(missionId!),
          rpc.getMissionActionsPublic(missionId!),
          rpc.getMissionMediaPublic(missionId!),
        ]);

        if (missionRes.error || !missionRes.data) {
          setError(true);
          setLoading(false);
          return;
        }

        setMission(missionRes.data);
        setActivities(Array.isArray(activitiesRes.data) ? activitiesRes.data as Activity[] : []);
        setDocuments(Array.isArray(documentsRes.data) ? documentsRes.data : []);
        setMediaItems(Array.isArray(mediaRes.data) ? mediaRes.data : []);
        setActions(Array.isArray(actionsRes.data) ? actionsRes.data : []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [missionId]);

  // Actions kanban
  const actionsKanban = useMemo(() => {
    const todo = actions.filter((a) => a.status === "todo");
    const inProgress = actions.filter((a) => a.status === "in_progress");
    const done = actions.filter((a) => a.status === "done");
    return { todo, inProgress, done };
  }, [actions]);

  // Deliverables: combine documents and media marked as deliverables
  const deliverables: Deliverable[] = useMemo(() => {
    const fromDocs: Deliverable[] = documents
      .filter((d) => d.is_deliverable)
      .map((d) => ({ id: d.id, file_name: d.file_name, file_url: d.file_url, file_size: d.file_size, source: "document" as const }));
    const fromMedia: Deliverable[] = mediaItems
      .filter((m) => m.is_deliverable)
      .map((m) => ({ id: m.id, file_name: m.file_name, file_url: m.file_url, file_size: m.file_size, source: "media" as const }));
    return [...fromDocs, ...fromMedia];
  }, [documents, mediaItems]);

  // Financial calculations
  const totalConsumed = activities.reduce((sum, a) => sum + (a.billable_amount || 0), 0);
  const totalBilled = activities.reduce((sum, a) => a.is_billed ? sum + (a.billable_amount || 0) : sum, 0);
  const budget = mission?.initial_amount || 0;
  const remainingToBill = budget - totalBilled;
  const billedPercent = budget > 0 ? Math.min(100, (totalBilled / budget) * 100) : 0;

  // Invoiced activities
  const invoicedActivities = activities.filter((a) => a.invoice_number || a.is_billed);

  const locale = lang === "fr" ? fr : enUS;
  const L = t[lang];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">{L.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <Briefcase className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-bold">{L.error}</h2>
            <p className="text-muted-foreground">{L.errorDesc}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {mission.emoji && <span className="text-3xl">{mission.emoji}</span>}
              <h1 className="text-2xl md:text-3xl font-bold">{mission.title}</h1>
            </div>
            {mission.client_name && (
              <p className="text-muted-foreground flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                {L.client}: <strong>{mission.client_name}</strong>
              </p>
            )}
            {(mission.start_date || mission.end_date) && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {L.period}:{" "}
                {mission.start_date && format(parseISO(mission.start_date), "d MMM yyyy", { locale })}
                {mission.start_date && mission.end_date && ` ${L.to} `}
                {mission.end_date && format(parseISO(mission.end_date), "d MMM yyyy", { locale })}
                {!mission.end_date && mission.start_date && ` — ${L.ongoing}`}
              </p>
            )}
            {mission.description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{mission.description}</p>
            )}
          </div>

          {/* Language toggle */}
          <div className="flex items-center gap-1 border rounded-lg p-1 shrink-0">
            <Button
              variant={lang === "fr" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => setLang("fr")}
            >
              FR
            </Button>
            <Button
              variant={lang === "en" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => setLang("en")}
            >
              EN
            </Button>
          </div>
        </div>

        <Separator />

        {/* Location with Google Maps link */}
        {mission.location && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-primary" />
                {L.location}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <p className="text-lg">{mission.location}</p>
                <Button size="sm" asChild>
                  <a
                    href={getGoogleMapsDirectionsUrl(mission.location)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    {L.directions}
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={getGoogleMapsSearchUrl(mission.location)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {L.viewOnMap}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deliverables (only if there are any marked) */}
        {deliverables.length > 0 && (
          <DeliverablesBlock deliverables={deliverables} lang={lang} />
        )}

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Euro className="h-5 w-5 text-primary" />
              {L.invoiceSummary}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="text-xs text-blue-600 font-medium">{L.totalBudget}</div>
                <div className="text-lg font-bold text-blue-700">
                  {formatCurrency(budget, lang)} €
                </div>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                <div className="text-xs text-orange-600 font-medium">{L.consumed}</div>
                <div className="text-lg font-bold text-orange-700">
                  {formatCurrency(totalConsumed, lang)} €
                </div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="text-xs text-green-600 font-medium">{L.billed}</div>
                <div className="text-lg font-bold text-green-700">
                  {formatCurrency(totalBilled, lang)} €
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                <div className="text-xs text-purple-600 font-medium">{L.remainingToBill}</div>
                <div className="text-lg font-bold text-purple-700">
                  {formatCurrency(Math.max(0, remainingToBill), lang)} €
                </div>
              </div>
            </div>

            {budget > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{L.progress}</span>
                  <span className="font-medium">{Math.round(billedPercent)}%</span>
                </div>
                <Progress value={billedPercent} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions Kanban (mission_actions, not activities) */}
        {actions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                {L.actionsTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 overflow-x-auto pb-2">
                <ActionsKanbanColumn
                  title={L.todo}
                  items={actionsKanban.todo}
                  color="#6b7280"
                  icon={<Clock className="h-3 w-3" />}
                />
                <ActionsKanbanColumn
                  title={L.inProgress}
                  items={actionsKanban.inProgress}
                  color="#3b82f6"
                  icon={<Clock className="h-3 w-3" />}
                />
                <ActionsKanbanColumn
                  title={L.done}
                  items={actionsKanban.done}
                  color="#22c55e"
                  icon={<CheckCircle2 className="h-3 w-3" />}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5 text-primary" />
              {L.invoices}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoicedActivities.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">{L.noInvoices}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">{L.invoiceNumber}</th>
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">{L.date}</th>
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">{L.description}</th>
                      <th className="text-right py-2 pr-4 font-medium text-muted-foreground">{L.amount}</th>
                      <th className="text-center py-2 font-medium text-muted-foreground">{L.status}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicedActivities.map((activity) => (
                      <tr key={activity.id} className="border-b last:border-0">
                        <td className="py-2.5 pr-4 font-medium">
                          {activity.invoice_number || "—"}
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          {format(parseISO(activity.activity_date), "dd/MM/yyyy")}
                        </td>
                        <td className="py-2.5 pr-4 max-w-[250px] truncate">
                          {activity.description}
                        </td>
                        <td className="py-2.5 pr-4 text-right whitespace-nowrap font-medium">
                          {activity.billable_amount != null
                            ? `${formatCurrency(activity.billable_amount, lang)} €`
                            : "—"}
                        </td>
                        <td className="py-2.5 text-center">
                          <Badge
                            variant={activity.is_billed ? "default" : "secondary"}
                            className={activity.is_billed ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                          >
                            {activity.is_billed ? L.billedBadge : L.pendingBadge}
                          </Badge>
                        </td>
                        <td className="py-2.5 pl-2">
                          {activity.invoice_url && (
                            <a
                              href={activity.invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 text-xs"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          <p>SuperTilt — {L.missionSummary}</p>
        </div>
      </div>
    </div>
  );
};

export default MissionSummary;
