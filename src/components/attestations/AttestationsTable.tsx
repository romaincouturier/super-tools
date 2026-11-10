import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { useExecutionAttestationMutations } from "@/hooks/useExecutionAttestations";
import { getSignedAttestationPdfUrl, type ExecutionAttestation } from "@/services/executionAttestations";
import AttestationEditDialog from "./AttestationEditDialog";
import { effectiveStatus, STATUS_LABELS, STATUS_VARIANT } from "./attestationStatus";
import { format } from "date-fns";

export default function AttestationsTable({ rows, showSource = false }: { rows: ExecutionAttestation[]; showSource?: boolean }) {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { link, cancel } = useExecutionAttestationMutations();
  const [editing, setEditing] = useState<ExecutionAttestation | null>(null);
  const fail = (title: string) => (e: unknown) => toast({ title, description: (e as Error).message, variant: "destructive" });

  const makeLink = async (a: ExecutionAttestation) => {
    if (a.status === "sent" && !(await confirm({ title: "Régénérer le lien ?", description: "L'ancien lien ne fonctionnera plus." }))) return;
    try {
      const { url } = await link.mutateAsync(a.id);
      await navigator.clipboard.writeText(url).catch(() => undefined);
      toast({ title: "Lien de signature copié", description: url });
    } catch (e) { fail("Lien impossible")(e); }
  };
  const openPdf = async (a: ExecutionAttestation) => {
    try { window.open(await getSignedAttestationPdfUrl(a.signed_pdf_path!), "_blank", "noopener"); } catch (e) { fail("PDF indisponible")(e); }
  };
  const doCancel = async (a: ExecutionAttestation) => {
    if (!(await confirm({ title: "Annuler cette attestation ?", description: "Le lien de signature ne fonctionnera plus." }))) return;
    cancel.mutateAsync(a.id).catch(fail("Annulation impossible"));
  };

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Aucune attestation.</p>;
  return (
    <>
      <div className="divide-y rounded-md border">
        {rows.map((a) => {
          const st = effectiveStatus(a);
          return (
            <div key={a.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <Badge variant={STATUS_VARIANT[st]}>{STATUS_LABELS[st]}</Badge>
              <div className="flex-1 min-w-[12rem]">
                <p className="font-medium">{a.subject || "Sans objet"}</p>
                <p className="text-muted-foreground">
                  {[a.public_entity_name || a.client_name, a.signed_signer_name || a.signer_name].filter(Boolean).join(" · ")}
                  {a.is_public_entity && " · Collectivité"}
                  {" · "}
                  {a.signed_at ? `signée le ${format(new Date(a.signed_at), "dd/MM/yyyy")}` : a.sent_at ? `lien du ${format(new Date(a.sent_at), "dd/MM/yyyy")}` : `créée le ${format(new Date(a.created_at), "dd/MM/yyyy")}`}
                  {st === "refused" && a.refusal_reason && ` · Motif : ${a.refusal_reason}`}
                </p>
                {showSource && (
                  <Link className="text-xs underline text-muted-foreground" to={a.mission_id ? `/missions/${a.mission_id}` : `/formations/${a.training_id}`}>
                    {a.source_type === "mission" ? "Voir la mission" : "Voir la formation"}
                  </Link>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {st !== "signed" && st !== "cancelled" && <Button size="sm" variant="outline" onClick={() => setEditing(a)}>Modifier</Button>}
                {st !== "signed" && st !== "cancelled" && <Button size="sm" variant="outline" onClick={() => makeLink(a)} disabled={link.isPending}>{st === "draft" ? "Générer le lien" : "Nouveau lien"}</Button>}
                {st === "signed" && a.signed_pdf_path && <Button size="sm" onClick={() => openPdf(a)}>PDF signé</Button>}
                {st !== "signed" && st !== "cancelled" && <Button size="sm" variant="ghost" onClick={() => doCancel(a)}>Annuler</Button>}
              </div>
            </div>
          );
        })}
      </div>
      <AttestationEditDialog attestation={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog />
    </>
  );
}
