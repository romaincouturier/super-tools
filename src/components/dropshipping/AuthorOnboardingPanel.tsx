import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, FileSignature, FileText, Link2, Mail, PenLine, RotateCcw, Send, ShieldCheck, Globe, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskEmail, maskName } from "@/lib/demoMask";
import { useSignaturePad } from "@/hooks/useSignaturePad";
import { useAuthorInvitations, useInvalidateOnboarding } from "@/hooks/useAuthorOnboarding";
import { staffOnboarding, type InvitationDraft } from "@/services/authorOnboarding";
import { AUTHOR_STATUS_LABELS } from "@/lib/authorOnboardingLabels";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = { signed: "default", online: "default" };

function InviteDialog({ onClose, onDraft }: { onClose: () => void; onDraft: (d: InvitationDraft) => void }) {
  const [f, setF] = useState({ email: "", first_name: "", last_name: "", game_name: "", commission: "15" });
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const invalidate = useInvalidateOnboarding();
  const submit = async () => {
    setBusy(true);
    try {
      const d = await staffOnboarding.invite({ ...f, commission_rate: Number(f.commission.replace(",", ".")) / 100 });
      invalidate(); onDraft(d);
    } catch (e) { toast({ title: "Invitation impossible", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  const ok = f.email && f.first_name && f.last_name && f.game_name && Number(f.commission.replace(",", ".")) >= 0;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Inviter un auteur</DialogTitle>
          <DialogDescription>Crée l'auteur, le jeu en brouillon et un lien vers le formulaire. Aucun email n'est envoyé à cette étape.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><Label>Prénom</Label><Input value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></div>
          <div><Label>Nom</Label><Input value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></div>
          <div><Label>Nom du jeu</Label><Input value={f.game_name} onChange={(e) => setF({ ...f, game_name: e.target.value })} /></div>
          <div><Label>Commission (%)</Label><Input inputMode="decimal" value={f.commission} onChange={(e) => setF({ ...f, commission: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={!ok || busy}>{busy ? <Spinner /> : "Créer et préparer l'email"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DraftDialog({ draft, invitationId, onClose }: { draft: InvitationDraft; invitationId: string; onClose: () => void }) {
  const [subject, setSubject] = useState(draft.subject);
  const [content, setContent] = useState(draft.content);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const invalidate = useInvalidateOnboarding();
  const { copy } = useCopyToClipboard();
  const send = async () => {
    setBusy(true);
    try {
      await staffOnboarding.sendInvitation({ invitation_id: invitationId, link: draft.link, subject, content });
      invalidate(); toast({ title: "Invitation envoyée", description: draft.to }); onClose();
    } catch (e) { toast({ title: "Envoi impossible", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl">
        <DialogHeader><DialogTitle>Email d'invitation à relire</DialogTitle>
          <DialogDescription>Destinataire : {draft.to}. Le bloc {"{{invitation_button}}"} devient le bouton vers le formulaire.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={draft.link} className="text-xs" />
            <Button variant="outline" size="icon" onClick={() => copy(draft.link)}><Copy className="h-4 w-4" /></Button>
          </div>
          <div><Label>Objet</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div><Label>Message</Label><Textarea rows={12} value={content} onChange={(e) => setContent(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Plus tard</Button>
          <Button onClick={send} disabled={busy || !content.includes("{{invitation_button}}")}>{busy ? <Spinner /> : <><Send className="h-4 w-4 mr-1" />Envoyer</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SignatureDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const { canvasRef, clear, isEmpty, toDataURL } = useSignaturePad({});
  useEffect(() => { staffOnboarding.distributorSignature().then((r) => setCurrent(r.url)).catch(() => setCurrent(null)); }, []);
  const save = async () => {
    if (isEmpty()) { toast({ title: "Dessinez votre signature" }); return; }
    setBusy(true);
    try { const r = await staffOnboarding.distributorSignature(toDataURL()); setCurrent(r.url); clear(); toast({ title: "Signature enregistrée" }); }
    catch (e) { toast({ title: "Échec", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ma signature de distributeur</DialogTitle>
          <DialogDescription>Apposée sur chaque contrat de distribution généré.</DialogDescription>
        </DialogHeader>
        {current && <img src={current} alt="Signature actuelle" className="h-20 border rounded bg-background" />}
        {current === null && <p className="text-sm text-muted-foreground">Aucune signature enregistrée : les contrats seront générés sans.</p>}
        <div className="border rounded bg-background"><canvas ref={canvasRef} className="w-full h-40 touch-none" style={{ touchAction: "none" }} /></div>
        <DialogFooter>
          <Button variant="outline" onClick={clear}>Effacer</Button>
          <Button onClick={save} disabled={busy}>{busy ? <Spinner /> : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AuthorOnboardingPanel() {
  const { data: rows, isLoading } = useAuthorInvitations();
  const { isDemoMode } = useDemoMode();
  const [inviting, setInviting] = useState(false);
  const [signing, setSigning] = useState(false);
  const [draft, setDraft] = useState<{ d: InvitationDraft; id: string } | null>(null);
  const { toast } = useToast();
  const invalidate = useInvalidateOnboarding();

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); invalidate(); toast({ title: ok }); }
    catch (e) { toast({ title: "Action impossible", description: (e as Error).message, variant: "destructive" }); }
  };
  const open = async (path: string | null) => {
    const url = await staffOnboarding.fileUrl(path);
    if (url) window.open(url, "_blank", "noopener"); else toast({ title: "Fichier introuvable", variant: "destructive" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Onboarding des auteurs</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSigning(true)}><PenLine className="h-4 w-4 mr-1" />Ma signature</Button>
          <Button size="sm" onClick={() => setInviting(true)}><UserPlus className="h-4 w-4 mr-1" />Inviter un auteur</Button>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Auteur</TableHead><TableHead>Jeu</TableHead><TableHead>Statut</TableHead><TableHead>Invitation</TableHead><TableHead>Contrat</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-6"><Spinner /></TableCell></TableRow>}
            {!isLoading && !rows?.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucune invitation</TableCell></TableRow>}
            {(rows ?? []).map((r) => {
              const contracts = (r.distribution_contract_signatures ?? []).filter((c: any) => c.status !== "cancelled")
                .sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
              const c = contracts[0];
              const status = r.game_authors?.onboarding_status ?? "invited";
              const expired = new Date(r.expires_at) < new Date();
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium"><Link to={`/dropshipping/auteurs/${r.id}`} className="hover:underline">{isDemoMode ? maskName(r.game_authors?.name) : r.game_authors?.name}</Link><div className="text-xs text-muted-foreground">{isDemoMode ? maskEmail(r.recipient_email) : r.recipient_email}</div></TableCell>
                  <TableCell>{r.games?.title}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[status] ?? "secondary"}>{AUTHOR_STATUS_LABELS[status] ?? status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.invitation_sent_at ? `Envoyée le ${new Date(r.invitation_sent_at).toLocaleDateString("fr-FR")}` : "Non envoyée"}
                    {expired && !r.submitted_at && <div className="text-destructive">Lien expiré</div>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {c ? <div className="flex flex-col gap-1">
                      <span>{c.contrat_reference}{c.status === "pending" && c.reminder_count ? ` · ${c.reminder_count} relance(s)` : ""}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => open(c.signed_pdf_url ?? c.pdf_url)}><FileText className="h-3.5 w-3.5 mr-1" />{c.signed_pdf_url ? "Signé" : "PDF"}</Button>
                        {c.proof_file_url && <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => open(c.proof_file_url)}><ShieldCheck className="h-3.5 w-3.5 mr-1" />Preuve</Button>}
                      </div>
                    </div> : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {!r.submitted_at && <Button variant="ghost" size="sm" title="Génère un nouveau lien (l'ancien ne marche plus) et prépare l'email"
                        onClick={async () => { try { setDraft({ d: await staffOnboarding.newLink(r.id), id: r.id }); } catch (e) { toast({ title: "Impossible", description: (e as Error).message, variant: "destructive" }); } }}>
                        {r.invitation_sent_at ? <Link2 className="h-4 w-4" /> : <Mail className="h-4 w-4" />}</Button>}
                      {r.submitted_at && !c && <Button variant="ghost" size="sm" title="Générer le contrat" onClick={() => run(() => staffOnboarding.retryContract(r.id), "Contrat généré")}><FileSignature className="h-4 w-4" /></Button>}
                      {r.submitted_at && c?.status !== "signed" && <Button variant="ghost" size="sm" title="Rouvrir le formulaire (annule le contrat non signé)" onClick={() => confirm("Rouvrir le formulaire et annuler le contrat non signé ?") && run(() => staffOnboarding.reopen(r.id), "Formulaire rouvert")}><RotateCcw className="h-4 w-4" /></Button>}
                      {status === "signed" && <Button variant="ghost" size="sm" title="Marquer la fiche en ligne" onClick={() => run(() => staffOnboarding.setOnline(r.id), "Fiche en ligne")}><Globe className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {inviting && <InviteDialog onClose={() => setInviting(false)} onDraft={(d) => { setInviting(false); setDraft({ d, id: d.invitation_id! }); }} />}
      {draft && <DraftDialog draft={draft.d} invitationId={draft.id} onClose={() => setDraft(null)} />}
      {signing && <SignatureDialog onClose={() => setSigning(false)} />}
    </div>
  );
}
