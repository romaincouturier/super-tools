import { useMemo, useState } from "react";
import { FileSignature } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useExecutionAttestations } from "@/hooks/useExecutionAttestations";
import AttestationsTable from "@/components/attestations/AttestationsTable";
import { effectiveStatus, STATUS_LABELS } from "@/components/attestations/attestationStatus";

export default function Attestations() {
  const { data, isLoading } = useExecutionAttestations();
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [client, setClient] = useState("");
  const rows = useMemo(() => (data ?? []).filter((a) =>
    (status === "all" || effectiveStatus(a) === status) &&
    (source === "all" || (source === "public" ? a.is_public_entity : a.source_type === source)) &&
    (!client || `${a.client_name ?? ""} ${a.public_entity_name ?? ""}`.toLowerCase().includes(client.toLowerCase()))), [data, status, source, client]);
  return (
    <ModuleLayout>
      <PageHeader icon={FileSignature} title="Attestations de bonne exécution" subtitle="Missions et formations" />
      <div className="container max-w-5xl py-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Tous statuts</SelectItem>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes sources</SelectItem><SelectItem value="mission">Missions</SelectItem>
            <SelectItem value="training">Formations</SelectItem><SelectItem value="public">Collectivités</SelectItem>
          </SelectContent>
        </Select>
        <Input className="w-56" placeholder="Client ou collectivité" value={client} onChange={(e) => setClient(e.target.value)} />
      </div>
      {isLoading ? <Spinner /> : <AttestationsTable rows={rows} showSource />}
      </div>
    </ModuleLayout>
  );
}
