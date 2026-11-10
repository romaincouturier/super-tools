import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useExecutionAttestationMutations } from "@/hooks/useExecutionAttestations";
import type { ExecutionAttestation, ExecutionAttestationPatch } from "@/services/executionAttestations";
import { attestationSections, missingForLink, PUBLIC_ENTITY_MENTION } from "../../../supabase/functions/_shared/execution-attestation";

type Form = Required<{ [K in keyof ExecutionAttestationPatch]: ExecutionAttestationPatch[K] }>;
const FIELDS: (keyof Form)[] = ["client_name", "client_address", "signer_name", "signer_function", "signer_email", "is_public_entity", "public_entity_name", "public_contract_reference", "subject", "start_date", "end_date", "location", "participants_count", "days_count", "amount_ht", "free_text", "certification_text", "link_validity_days", "provider_name", "provider_siren", "provider_nda", "provider_address"];

export default function AttestationEditDialog({ attestation, onClose }: { attestation: ExecutionAttestation | null; onClose: () => void }) {
  const { toast } = useToast();
  const { update } = useExecutionAttestationMutations();
  const [f, setF] = useState<Partial<Form>>({});
  useEffect(() => {
    if (attestation) setF(Object.fromEntries(FIELDS.map((k) => [k, attestation[k as keyof ExecutionAttestation]])) as Partial<Form>);
  }, [attestation]);
  if (!attestation) return null;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const text = (k: keyof Form, label: string, type = "text") => (
    <div className="space-y-1">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} type={type} value={(f[k] as string | number | null) ?? ""}
        onChange={(e) => set(k, (type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value || null) as never)} />
    </div>
  );
  const missing = missingForLink(f);
  const save = async () => {
    try {
      await update.mutateAsync({ id: attestation.id, patch: f });
      toast({ title: "Attestation enregistrée", description: attestation.status === "sent" ? "Elle repasse en brouillon : régénère le lien." : undefined });
      onClose();
    } catch (e) {
      toast({ title: "Enregistrement impossible", description: (e as Error).message, variant: "destructive" });
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Attestation de bonne exécution</DialogTitle></DialogHeader>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <section className="space-y-2">
              <h3 className="font-semibold text-sm">Client et signataire</h3>
              {text("client_name", "Client")}
              {text("client_address", "Adresse du client")}
              <div className="grid grid-cols-2 gap-2">{text("signer_name", "Nom du signataire")}{text("signer_function", "Fonction")}</div>
              {text("signer_email", "Email du signataire (copie du PDF signé)", "email")}
            </section>
            <section className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Switch id="is_public_entity" checked={!!f.is_public_entity} onCheckedChange={(v) => set("is_public_entity", v)} />
                <Label htmlFor="is_public_entity">{PUBLIC_ENTITY_MENTION}</Label>
              </div>
              {f.is_public_entity && <>{text("public_entity_name", "Nom de la collectivité")}{text("public_contract_reference", "Référence du marché ou bon de commande (facultatif)")}</>}
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold text-sm">Prestation</h3>
              {text("subject", "Objet")}
              <div className="grid grid-cols-2 gap-2">{text("start_date", "Début", "date")}{text("end_date", "Fin", "date")}</div>
              {text("location", "Lieu")}
              <div className="grid grid-cols-3 gap-2">{text("days_count", "Jours", "number")}{text("participants_count", "Participants", "number")}{text("amount_ht", "Montant HT", "number")}</div>
              <div className="space-y-1"><Label htmlFor="free_text">Description libre</Label><Textarea id="free_text" rows={5} value={f.free_text ?? ""} onChange={(e) => set("free_text", e.target.value || null)} /></div>
              <div className="space-y-1"><Label htmlFor="certification_text">Mention d'attestation</Label><Textarea id="certification_text" rows={3} value={f.certification_text ?? ""} onChange={(e) => set("certification_text", e.target.value)} /></div>
              {text("link_validity_days", "Validité du lien (jours)", "number")}
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold text-sm">Prestataire</h3>
              {text("provider_name", "Raison sociale")}{text("provider_address", "Adresse")}
              <div className="grid grid-cols-2 gap-2">{text("provider_siren", "SIREN")}{text("provider_nda", "N° de déclaration d'activité")}</div>
            </section>
          </div>
          <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-3 h-fit md:sticky md:top-0">
            <p className="font-semibold">Aperçu</p>
            {attestationSections(f).map((s) => (
              <div key={s.title}><p className="font-medium">{s.title}</p>{s.lines.map((l, i) => <p key={i} className="text-muted-foreground whitespace-pre-wrap">{l}</p>)}</div>
            ))}
            {missing.length > 0 && <p className="text-destructive">Avant de générer le lien : {missing.join(", ")}.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={update.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
