import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, Copy, RefreshCw, FileDown, AlertCircle, Loader2, ChevronDown, Mail, Paperclip, Eye, MousePointerClick, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";

interface SentDevisDetails {
  crm_card_id?: string;
  formation_name?: string;
  client_name?: string;
  type_subrogation?: string;
  nb_participants?: number;
  pdf_sans_subrogation_url?: string;
  pdf_avec_subrogation_url?: string;
  pdf_sans_storage_path?: string;
  pdf_avec_storage_path?: string;
  form_data?: Record<string, unknown>;
}

interface SentDevis {
  id: string;
  created_at: string;
  details: SentDevisDetails;
}

interface CrmEmail {
  id: string;
  subject: string;
  recipient_email: string;
  body_html: string;
  sent_at: string;
  attachment_names: string[];
  delivery_status?: string;
  opened_at?: string | null;
  open_count?: number;
  clicked_at?: string | null;
  click_count?: number;
}

interface SentDevisSectionProps {
  email: string | null;
  cardId: string | null;
  emails?: CrmEmail[];
}

const SentDevisSection = ({ email, cardId, emails }: SentDevisSectionProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);

  const { data: sentDevis, isLoading, refetch } = useQuery({
    queryKey: ["crm-sent-devis", email, cardId],
    queryFn: async () => {
      if (!email || !cardId) return [];

      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, created_at, details")
        .eq("action_type", "micro_devis_sent")
        .eq("recipient_email", email)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const allDevis = (data || []) as SentDevis[];
      return allDevis.filter(
        (d) => d.details?.crm_card_id === cardId
      );
    },
    enabled: !!email && !!cardId,
  });

  // Build a unified timeline: emails + devis, sorted by date desc
  const timelineItems: Array<{ type: "email" | "devis"; date: string; email?: CrmEmail; devis?: SentDevis }> = [];

  if (emails) {
    for (const e of emails) {
      timelineItems.push({ type: "email", date: e.sent_at, email: e });
    }
  }

  if (sentDevis) {
    for (const d of sentDevis) {
      timelineItems.push({ type: "devis", date: d.created_at, devis: d });
    }
  }

  timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleOpenPdf = async (storagePath: string | undefined | null, fallbackUrl: string | undefined | null, loadKey: string) => {
    // Prefer signed URL from Supabase Storage
    if (storagePath) {
      setLoadingPdf(loadKey);
      try {
        const { data, error } = await supabase.storage
          .from("devis-pdfs")
          .createSignedUrl(storagePath, 3600); // 1 hour
        if (data?.signedUrl && !error) {
          window.open(data.signedUrl, "_blank");
          setLoadingPdf(null);
          return;
        }
      } catch {
        // Fall through to fallback URL
      }
      setLoadingPdf(null);
    }

    // Fallback to old PDFMonkey URL
    if (fallbackUrl) {
      window.open(fallbackUrl, "_blank");
      return;
    }

    toast.error("PDF expiré. Dupliquez le devis pour en générer un nouveau.");
  };

  const handleDuplicate = (devis: SentDevis) => {
    const formData = devis.details?.form_data;
    if (!formData) {
      toast.error("Pas de données de formulaire pour dupliquer");
      return;
    }

    const params = new URLSearchParams();
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });
    if (cardId) params.set("crmCardId", cardId);
    params.set("source", "crm");

    window.open(`/micro-devis?${params.toString()}`, "_blank");
  };

  const getSubrogationLabel = (type?: string) => {
    switch (type) {
      case "sans": return "Sans subrogation";
      case "avec": return "Avec subrogation";
      case "les2": return "Les 2 devis";
      default: return type;
    }
  };

  if (isLoading) return null;
  if (timelineItems.length === 0) return null;

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Historique emails & devis
        </h4>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-6 w-6 p-0">
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
      <div className="space-y-2">
        {timelineItems.map((item) => {
          if (item.type === "devis" && item.devis) {
            const devis = item.devis;
            const details = devis.details;
            const hasSansStorage = !!details?.pdf_sans_storage_path;
            const hasAvecStorage = !!details?.pdf_avec_storage_path;
            const hasSansPdf = hasSansStorage || !!details?.pdf_sans_subrogation_url;
            const hasAvecPdf = hasAvecStorage || !!details?.pdf_avec_subrogation_url;
            const hasPdf = hasSansPdf || hasAvecPdf;

            return (
              <div
                key={`devis-${devis.id}`}
                className="p-3 bg-muted/50 rounded-lg text-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs flex items-center gap-1.5">
                    <Receipt className="h-3 w-3 text-orange-500" />
                    {details?.formation_name || "Devis"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(devis.created_at), "dd MMM yyyy", { locale: fr })}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {details?.client_name && (
                    <Badge variant="outline" className="text-[10px] h-5">
                      {details.client_name}
                    </Badge>
                  )}
                  {details?.type_subrogation && (
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {getSubrogationLabel(details.type_subrogation)}
                    </Badge>
                  )}
                  {details?.nb_participants && (
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {details.nb_participants} participant{details.nb_participants > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {hasSansPdf && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2"
                      disabled={loadingPdf === `${devis.id}-sans`}
                      onClick={() => handleOpenPdf(details.pdf_sans_storage_path, details.pdf_sans_subrogation_url, `${devis.id}-sans`)}
                    >
                      {loadingPdf === `${devis.id}-sans` ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <FileDown className="h-3 w-3 mr-1" />
                      )}
                      {details?.type_subrogation === "les2" ? "PDF sans subrogation" : "Ouvrir le PDF"}
                    </Button>
                  )}
                  {hasAvecPdf && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2"
                      disabled={loadingPdf === `${devis.id}-avec`}
                      onClick={() => handleOpenPdf(details.pdf_avec_storage_path, details.pdf_avec_subrogation_url, `${devis.id}-avec`)}
                    >
                      {loadingPdf === `${devis.id}-avec` ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <FileDown className="h-3 w-3 mr-1" />
                      )}
                      {details?.type_subrogation === "les2" ? "PDF avec subrogation" : "Ouvrir le PDF"}
                    </Button>
                  )}
                  {!hasPdf && (
                    <span className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      PDF expiré — dupliquez pour regénérer
                    </span>
                  )}
                  {details?.form_data && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => handleDuplicate(devis)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Dupliquer
                    </Button>
                  )}
                </div>
              </div>
            );
          }

          if (item.type === "email" && item.email) {
            const emailItem = item.email;
            const isExpanded = expandedId === emailItem.id;
            const hasTracking = !!emailItem.delivery_status;
            return (
              <div
                key={`email-${emailItem.id}`}
                className="border rounded-lg overflow-hidden"
              >
                <div
                  className="flex items-start justify-between gap-2 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : emailItem.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1.5">
                      <Mail className="h-3 w-3 text-blue-500 shrink-0" />
                      {emailItem.subject}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        À: {emailItem.recipient_email} •{" "}
                        {format(new Date(emailItem.sent_at), "d MMM yyyy HH:mm", { locale: fr })}
                        {emailItem.attachment_names && emailItem.attachment_names.length > 0 && (
                          <span> • <Paperclip className="inline h-3 w-3" /> {emailItem.attachment_names.length}</span>
                        )}
                      </span>
                      {hasTracking && (
                        <>
                          {emailItem.delivery_status === "bounced" ? (
                            <Badge variant="destructive" className="text-[9px] h-4 px-1 gap-0.5">
                              <XCircle className="h-2.5 w-2.5" /> Bounced
                            </Badge>
                          ) : emailItem.delivery_status === "delivered" ? (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5 text-green-600 border-green-200 bg-green-50">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Délivré
                            </Badge>
                          ) : null}
                          {(emailItem.open_count || 0) > 0 && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5 text-blue-600 border-blue-200 bg-blue-50">
                              <Eye className="h-2.5 w-2.5" /> Ouvert{emailItem.open_count! > 1 ? ` ×${emailItem.open_count}` : ""}
                            </Badge>
                          )}
                          {(emailItem.click_count || 0) > 0 && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5 text-purple-600 border-purple-200 bg-purple-50">
                              <MousePointerClick className="h-2.5 w-2.5" /> Clic{emailItem.click_count! > 1 ? ` ×${emailItem.click_count}` : ""}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform mt-0.5", isExpanded && "rotate-180")} />
                </div>
                {isExpanded && emailItem.body_html && (
                  <div
                    className="px-4 pb-4 pt-2 border-t bg-background prose prose-sm dark:prose-invert max-w-none [&_a]:text-primary [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(emailItem.body_html, { ADD_ATTR: ["target"], ALLOW_DATA_ATTR: false }) }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName === "A") {
                        e.stopPropagation();
                        const href = target.getAttribute("href");
                        if (href) window.open(href, "_blank", "noopener");
                        e.preventDefault();
                      }
                    }}
                  />
                )}
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
};

export default SentDevisSection;
