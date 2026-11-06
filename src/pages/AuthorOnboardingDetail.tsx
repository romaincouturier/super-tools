import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, FileText, ShieldCheck } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskEmail, maskName } from "@/lib/demoMask";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useAuthorInvitationDetail } from "@/hooks/useAuthorOnboarding";
import { staffOnboarding } from "@/services/authorOnboarding";
import { AUTHOR_STATUS_LABELS, FORM_SECTIONS } from "@/lib/authorOnboardingLabels";

const KIND_LABEL: Record<string, string> = { logo: "Logo", photo: "Photo", pdf: "PDF" };

export default function AuthorOnboardingDetail() {
  const { id } = useParams();
  const { isDemoMode } = useDemoMode();
  const { data, isLoading, error } = useAuthorInvitationDetail(id);
  const { toast } = useToast();
  const open = async (path: string | null, download?: string) => {
    const url = await staffOnboarding.fileUrl(path, download);
    if (url) window.open(url, "_blank", "noopener"); else toast({ title: "Fichier introuvable", variant: "destructive" });
  };

  return (
    <ModuleLayout>
      <PageHeader title="Onboarding auteur" />
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <Button variant="ghost" size="sm" asChild><Link to="/commandes-jeux?tab=auteurs"><ArrowLeft className="h-4 w-4 mr-1" />Auteurs</Link></Button>
        {isLoading && <Spinner size="md" />}
        {error && <p className="text-destructive">Accès impossible à cette fiche.</p>}
        {data && (() => {
          const { invitation: inv, response, files } = data;
          const form = response?.data ?? {};
          const contracts = (inv.distribution_contract_signatures ?? []).sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
          const status = inv.game_authors?.onboarding_status ?? "invited";
          return <>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{inv.games?.title}</h1>
              <Badge>{AUTHOR_STATUS_LABELS[status] ?? status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{isDemoMode ? maskName(inv.game_authors?.name) : inv.game_authors?.name} · {isDemoMode ? maskEmail(inv.recipient_email) : inv.recipient_email} · commission {Math.round(Number(inv.commission_rate) * 10000) / 100} %</p>

            <Card><CardHeader><CardTitle className="text-lg">Contrat</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {!contracts.length && <p className="text-muted-foreground">Aucun contrat généré.</p>}
                {contracts.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 flex-wrap border rounded p-2">
                    <span>{c.contrat_reference} · {c.status === "signed" ? `signé le ${new Date(c.signed_at).toLocaleString("fr-FR")}` : c.status === "cancelled" ? "annulé" : "en attente de signature"}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => open(c.pdf_url)}><FileText className="h-4 w-4 mr-1" />Original</Button>
                      {c.signed_pdf_url && <Button size="sm" variant="outline" onClick={() => open(c.signed_pdf_url)}><FileText className="h-4 w-4 mr-1" />Signé</Button>}
                      {c.proof_file_url && <Button size="sm" variant="outline" onClick={() => open(c.proof_file_url)}><ShieldCheck className="h-4 w-4 mr-1" />Preuve</Button>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card><CardHeader><CardTitle className="text-lg">Médias</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {!files.length && <p className="text-muted-foreground">Aucun fichier.</p>}
                {files.map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between border rounded px-2 py-1">
                    <span><Badge variant="secondary" className="mr-2">{KIND_LABEL[f.kind]}</Badge>{f.original_name}</span>
                    <Button size="icon" variant="ghost" onClick={() => open(f.storage_path, f.original_name || "fichier")}><Download className="h-4 w-4" /></Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {FORM_SECTIONS.map((s) => (
              <Card key={s.title}><CardHeader><CardTitle className="text-lg">{s.title}</CardTitle></CardHeader>
                <CardContent><dl className="grid sm:grid-cols-[220px_1fr] gap-x-4 gap-y-2 text-sm">
                  {s.fields.map(([k, label]) => {
                    const v = form[k];
                    if (s.title === "Location" && k !== "location_enabled" && !form.location_enabled) return null;
                    return [<dt key={`${k}-l`} className="text-muted-foreground">{label}</dt>,
                      <dd key={`${k}-v`} className="whitespace-pre-wrap break-words">{typeof v === "boolean" ? (v ? "Oui" : "Non") : v === null || v === undefined || v === "" ? "—" : String(v)}</dd>];
                  })}
                </dl></CardContent>
              </Card>
            ))}
          </>;
        })()}
      </div>
    </ModuleLayout>
  );
}
