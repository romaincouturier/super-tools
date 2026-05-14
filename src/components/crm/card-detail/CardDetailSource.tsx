import { useState } from "react";
import { ChevronDown, ChevronUp, Globe, Clock, Monitor, Link2, MapPin, FileText, Hash } from "lucide-react";
import type { SourceMetadata } from "@/types/crm";

interface Props {
  metadata: SourceMetadata | null | undefined;
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
};

const Row = ({ icon: Icon, label, value, href }: { icon: any; label: string; value: string; href?: string }) => (
  <div className="flex items-start gap-2 text-xs">
    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <div className="text-muted-foreground">{label}</div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">
          {value}
        </a>
      ) : (
        <div className="break-all">{value}</div>
      )}
    </div>
  </div>
);

const CardDetailSource = ({ metadata }: Props) => {
  const [open, setOpen] = useState(false);
  if (!metadata) return null;
  const m = metadata;
  const hasAny = m.received_at || m.page_url || m.page_title || m.user_agent || m.referrer || m.remote_ip || m.form_name || m.form_id;
  if (!hasAny) return null;

  return (
    <div className="mt-6 border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Source de la demande
          {m.channel && <span className="text-xs text-muted-foreground font-normal">· {m.channel}</span>}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="p-4 space-y-2.5">
          {m.received_at && <Row icon={Clock} label="Reçu le" value={fmtDate(m.received_at) || ""} />}
          {m.form_name && <Row icon={FileText} label="Formulaire" value={m.form_name} />}
          {m.form_id && <Row icon={Hash} label="ID formulaire" value={m.form_id} />}
          {m.page_url && <Row icon={Link2} label="Page" value={m.page_title || m.page_url} href={m.page_url} />}
          {m.referrer && <Row icon={Link2} label="Référent" value={m.referrer} href={m.referrer} />}
          {m.user_agent && <Row icon={Monitor} label="Agent utilisateur" value={m.user_agent} />}
          {m.remote_ip && <Row icon={MapPin} label="Adresse IP" value={m.remote_ip} />}
        </div>
      )}
    </div>
  );
};

export default CardDetailSource;
