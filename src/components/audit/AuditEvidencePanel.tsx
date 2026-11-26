import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AuditEvidence } from "@/services/auditEvidence";
import { evidenceStatus } from "../../../supabase/functions/_shared/audit-evidence";

const fmt = (d: string) => new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
const sourceText = (e: AuditEvidence) => e.source_type === "agent" ? `Agent : ${e.source_label.replace(/^agent:/, "")}` : e.source_label;

function EvidenceBody({ e }: { e: AuditEvidence }) {
  return (
    <div className="space-y-1 text-xs">
      <p><span className="font-medium">{e.answer === "oui" ? "Oui" : "Non"}</span> · contrôle du {fmt(e.checked_at)} · {sourceText(e)}</p>
      <p className="whitespace-pre-wrap">{e.evidence_summary}</p>
      {e.evidence_urls.length > 0 && (
        <ul className="list-disc pl-4">
          {e.evidence_urls.map((u) => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer" className="underline break-all">{u}</a></li>)}
        </ul>
      )}
    </div>
  );
}

function detailsText(d: AuditEvidence["evidence_details"]) {
  if (d && typeof d === "object" && !Array.isArray(d) && Object.keys(d).length === 1 && "text" in d) return String(d.text);
  return JSON.stringify(d, null, 2);
}

const STATUS_LABEL = {
  valide: "Validée par un humain",
  perimee: "Périmée, à reconfirmer",
  a_confirmer: "À confirmer",
  a_valider_humain: "MCP : validation humaine requise",
} as const;

export function AuditEvidencePanel({ history, onValidate, validating = false }: {
  history: AuditEvidence[];
  onValidate?: (evidence: AuditEvidence) => void;
  validating?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const latest = history[0];
  if (!latest) return null;
  const status = evidenceStatus(latest);
  return (
    <div className="rounded-md bg-muted/40 p-2 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium">Dernière preuve</p>
        <Badge variant={status === "valide" ? "secondary" : "outline"}>{STATUS_LABEL[status]}</Badge>
      </div>
      <EvidenceBody e={latest} />
      <div className="flex flex-wrap gap-3">
        <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => setOpen(true)}>Voir le détail</Button>
        {status === "a_valider_humain" && onValidate && (
          <Button size="sm" variant="link" className="h-auto p-0 text-xs" disabled={validating} onClick={() => onValidate(latest)}>
            {validating ? "Validation…" : "Valider cette preuve"}
          </Button>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Preuves de la question {latest.question_id}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {history.map((e) => (
              <div key={e.id} className="border rounded-md p-2 space-y-2">
                <p className="text-xs text-muted-foreground">Enregistrée le {fmt(e.recorded_at)}</p>
                <EvidenceBody e={e} />
                {e.evidence_details != null && <pre className="text-xs whitespace-pre-wrap bg-muted p-2 rounded">{detailsText(e.evidence_details)}</pre>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
