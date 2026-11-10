import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useExecutionAttestationMutations, useExecutionAttestations } from "@/hooks/useExecutionAttestations";
import AttestationsTable from "./AttestationsTable";

export default function AttestationsSection({ missionId, trainingId }: { missionId?: string; trainingId?: string }) {
  const { toast } = useToast();
  const { data, isLoading } = useExecutionAttestations({ missionId, trainingId });
  const { create } = useExecutionAttestationMutations();
  const add = () => create.mutateAsync({ missionId, trainingId })
    .then(() => toast({ title: "Attestation créée en brouillon", description: "Vérifie et complète-la avant de générer le lien." }))
    .catch((e) => toast({ title: "Création impossible", description: (e as Error).message, variant: "destructive" }));
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Attestations de bonne exécution</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" asChild><Link to="/attestations">Toutes</Link></Button>
          <Button size="sm" onClick={add} disabled={create.isPending}>Nouvelle attestation</Button>
        </div>
      </div>
      {isLoading ? <Spinner /> : <AttestationsTable rows={data ?? []} />}
    </section>
  );
}
