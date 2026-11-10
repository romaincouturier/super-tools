import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import SupertiltLogo from "@/components/SupertiltLogo";
import { useJourneyTracking } from "@/hooks/useJourneyTracking";
import { useSignaturePad } from "@/hooks/useSignaturePad";
import { fetchPublicAttestation, refusePublicAttestation, submitAttestationSignature, type PublicAttestation } from "@/services/executionAttestations";

const CLOSED: Record<string, string> = {
  signed: "Cette attestation a été signée. Merci !",
  refused: "Cette attestation a été refusée. Merci pour votre retour.",
  expired: "Ce lien de signature a expiré. Contactez SuperTilt pour en recevoir un nouveau.",
  cancelled: "Ce lien n'est plus valide.",
  draft: "Ce lien n'est plus valide.",
};

export default function SignatureAttestation() {
  const { token = "" } = useParams();
  const { toast } = useToast();
  const [data, setData] = useState<PublicAttestation | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [name, setName] = useState("");
  const [fn, setFn] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState("");
  const { trackEvent, trackPageLoaded, getDeviceInfo, journeyEvents } = useJourneyTracking();
  const { canvasRef, clear, isEmpty, toDataURL } = useSignaturePad({ onFirstStroke: () => trackEvent("signature_drawing_started") });

  useEffect(() => {
    document.title = "Attestation de bonne exécution · SuperTilt";
    trackPageLoaded();
    fetchPublicAttestation(token).then((d) => { setData(d); setName(d.signer_name ?? ""); setFn(d.signer_function ?? ""); }).catch(() => setInvalid(true));
  }, [token, trackPageLoaded]);

  const sign = async () => {
    if (isEmpty()) { toast({ title: "Merci de signer dans le cadre", variant: "destructive" }); return; }
    trackEvent("submit_button_clicked");
    setBusy(true);
    try {
      await submitAttestationSignature({ token, signatureData: toDataURL(), signerName: name, signerFunction: fn, consent, userAgent: navigator.userAgent, deviceInfo: getDeviceInfo(), journeyEvents: journeyEvents.current });
      setData((d) => d && { ...d, status: "signed" });
    } catch (e) {
      toast({ title: "Signature impossible", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };
  const refuse = async () => {
    setBusy(true);
    try { await refusePublicAttestation(token, reason); setData((d) => d && { ...d, status: "refused" }); }
    catch { toast({ title: "Refus impossible", variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const needsFn = !!data?.is_public_entity;
  const canSign = name.trim() && (!needsFn || fn.trim()) && consent && !busy;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-center"><SupertiltLogo /></div>
        {invalid ? <Card><CardContent className="py-10 text-center">Ce lien de signature est invalide.</CardContent></Card>
        : !data ? <div className="flex justify-center py-10"><Spinner /></div>
        : data.status !== "sent" ? (
          <Card><CardContent className="py-10 text-center space-y-3">
            {data.status === "signed" && <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />}
            <p>{CLOSED[data.status] ?? CLOSED.draft}</p>
            {data.status === "signed" && <p className="text-sm text-muted-foreground">Une copie du document signé vous est envoyée par email.</p>}
          </CardContent></Card>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle>Attestation de bonne exécution</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                {data.sections.map((s) => (
                  <div key={s.title}><p className="font-semibold">{s.title}</p>{s.lines.map((l, i) => <p key={i} className="text-muted-foreground whitespace-pre-wrap">{l}</p>)}</div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Signature</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1"><Label htmlFor="n">Nom et prénom</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => trackEvent("signer_name_entered")} /></div>
                  <div className="space-y-1"><Label htmlFor="f">Fonction{needsFn ? "" : " (facultatif)"}</Label><Input id="f" value={fn} onChange={(e) => setFn(e.target.value)} /></div>
                </div>
                {needsFn && <p className="text-xs text-muted-foreground">Collectivité : {data.public_entity_name}</p>}
                <div className="rounded-md border bg-background">
                  <canvas ref={canvasRef} className="w-full h-48 touch-none" style={{ touchAction: "none" }} />
                </div>
                <Button variant="ghost" size="sm" onClick={() => { clear(); trackEvent("signature_cleared"); }}>Effacer</Button>
                <div className="flex items-start gap-2">
                  <Checkbox id="c" checked={consent} onCheckedChange={(v) => { setConsent(v === true); trackEvent(v ? "consent_checkbox_checked" : "consent_checkbox_unchecked"); }} />
                  <Label htmlFor="c" className="text-sm font-normal leading-snug">Je certifie l'exactitude des informations de cette attestation et j'accepte de la signer électroniquement.</Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={sign} disabled={!canSign}>{busy ? "Signature…" : "Signer l'attestation"}</Button>
                  <Button variant="outline" onClick={() => setRefusing((r) => !r)}>Je refuse</Button>
                </div>
                {refusing && (
                  <div className="space-y-2">
                    <Label htmlFor="r">Motif du refus</Label>
                    <Textarea id="r" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <Button variant="destructive" size="sm" onClick={refuse} disabled={!reason.trim() || busy}>Confirmer le refus</Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Vos nom, fonction, signature, adresse IP et informations techniques de connexion sont conservés par SuperTilt comme preuve de signature, conformément au RGPD.</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
