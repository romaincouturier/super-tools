import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, FileText, Trash2, Upload } from "lucide-react";
import SupertiltLogo from "@/components/SupertiltLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useSignaturePad } from "@/hooks/useSignaturePad";
import { useJourneyTracking } from "@/hooks/useJourneyTracking";
import { publicOnboarding, OnboardingError, type PublicOnboarding, type OnboardingFile } from "@/services/authorOnboarding";

type Form = Record<string, string | number | boolean | null>;
type F = { key: string; label: string; long?: boolean; type?: string; hint?: string; optional?: boolean };

const SELLER: F[] = [
  { key: "legal_name", label: "Raison sociale", hint: "Apparaît dans le contrat" },
  { key: "postal_address", label: "Adresse postale", long: true },
  { key: "legal_rep_first_name", label: "Prénom du représentant légal" },
  { key: "legal_rep_last_name", label: "Nom du représentant légal" },
  { key: "siren", label: "SIREN", optional: true },
  { key: "phone", label: "Téléphone", type: "tel" },
];
const GAME: F[] = [
  { key: "game_name", label: "Nom du jeu tel qu'affiché en ligne" },
  { key: "author_email", label: "Email de l'auteur", type: "email" },
  { key: "pitch", label: "Pitch", long: true },
  { key: "price_ht", label: "Prix de vente HT (€)", type: "number" },
  { key: "game_page_url", label: "URL de la page du jeu", type: "url", optional: true, hint: "Ou ajoutez un PDF plus bas" },
  { key: "video_url", label: "URL de la vidéo de présentation", type: "url", optional: true },
  { key: "long_description", label: "Description longue (mécanique, exemple d'un tour…)", long: true },
  { key: "credits", label: "Mentions des auteurs et crédits", long: true },
];
const LOGISTICS: F[] = [
  { key: "weight_g", label: "Poids (grammes)", type: "number" },
  { key: "package_dimensions", label: "Dimensions du colis", hint: "Ex. 50 × 40 × 20 cm" },
  { key: "shipping_fee", label: "Frais de port pour un jeu (€)", type: "number" },
  { key: "shipping_delay", label: "Délai d'expédition", hint: "Ex. 3 jours ouvrés" },
];
const LOCATION: F[] = [
  { key: "location_duration_days", label: "Durée de location (jours)", type: "number" },
  { key: "location_price_ht", label: "Tarif de location HT (€)", type: "number" },
  { key: "location_late_fee_month", label: "Pénalité de retard par mois (€)", type: "number" },
  { key: "location_replacement_price", label: "Prix de remplacement (€)", type: "number" },
];
const EXTRA: F[] = [
  { key: "testimonials", label: "Témoignages de joueurs", long: true, optional: true },
  { key: "other_info", label: "Autres infos pour la fiche produit", long: true, optional: true },
];

function Field({ f, form, set, disabled }: { f: F; form: Form; set: (k: string, v: string) => void; disabled: boolean }) {
  const v = form[f.key] === null || form[f.key] === undefined ? "" : String(form[f.key]);
  return (
    <div className={f.long ? "sm:col-span-2" : ""}>
      <Label htmlFor={f.key}>{f.label}{f.optional ? <span className="text-muted-foreground font-normal"> (facultatif)</span> : " *"}</Label>
      {f.long
        ? <Textarea id={f.key} rows={4} value={v} disabled={disabled} onChange={(e) => set(f.key, e.target.value)} />
        : <Input id={f.key} type={f.type === "number" ? "text" : f.type ?? "text"} inputMode={f.type === "number" ? "decimal" : undefined} value={v} disabled={disabled} onChange={(e) => set(f.key, e.target.value)} />}
      {f.hint && <p className="text-xs text-muted-foreground mt-1">{f.hint}</p>}
    </div>
  );
}

function Files({ kind, label, files, token, onChange, disabled, multiple, accept }: {
  kind: string; label: string; files: OnboardingFile[]; token: string; onChange: (f: OnboardingFile[]) => void; disabled: boolean; multiple?: boolean; accept: string;
}) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const mine = files.filter((f) => f.kind === kind);
  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(list)) onChange((await publicOnboarding.upload(token, kind, file)).files);
    } catch (e) { toast({ title: "Envoi impossible", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  return (
    <div className="sm:col-span-2 space-y-2">
      <Label>{label}</Label>
      <ul className="space-y-1">
        {mine.map((f) => (
          <li key={f.id} className="flex items-center justify-between text-sm border rounded px-2 py-1">
            <span className="truncate">{f.original_name} <span className="text-muted-foreground">({Math.round(f.size_bytes / 1024)} Ko)</span></span>
            {!disabled && <Button variant="ghost" size="icon" onClick={async () => onChange((await publicOnboarding.deleteFile(token, f.id)).files)}><Trash2 className="h-4 w-4" /></Button>}
          </li>
        ))}
      </ul>
      {!disabled && (
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer border rounded px-3 py-2 hover:bg-muted">
          {busy ? <Spinner /> : <Upload className="h-4 w-4" />} Ajouter{multiple ? " des fichiers" : " un fichier"}
          <input type="file" className="hidden" accept={accept} multiple={multiple} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </label>
      )}
    </div>
  );
}

function SignStep({ token, data, onSigned }: { token: string; data: PublicOnboarding; onSigned: (url: string | null) => void }) {
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [name, setName] = useState([data.form.legal_rep_first_name, data.form.legal_rep_last_name].filter(Boolean).join(" "));
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const { journeyEvents, trackEvent, trackPageLoaded, getDeviceInfo } = useJourneyTracking();
  const { canvasRef, clear, isEmpty, toDataURL } = useSignaturePad({ onFirstStroke: () => trackEvent("signature_drawing_started") });
  useEffect(() => { trackPageLoaded?.(); }, [trackPageLoaded]);

  const sendCode = async () => {
    setBusy(true);
    try { setSentTo((await publicOnboarding.sendOtp(token)).sent_to); }
    catch (e) { toast({ title: "Code non envoyé", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };
  const sign = async () => {
    if (isEmpty()) { toast({ title: "Dessinez votre signature" }); return; }
    setBusy(true);
    trackEvent("submit_button_clicked");
    try {
      const r = await publicOnboarding.sign(token, {
        code, signatureData: toDataURL(), signerName: name, consent, userAgent: navigator.userAgent,
        deviceInfo: getDeviceInfo(), journeyEvents,
      });
      onSigned(r.download_url);
    } catch (e) { toast({ title: "Signature impossible", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Signer le contrat de distribution {data.contract?.reference}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {data.contract_pdf_url && (
          <Button variant="outline" asChild><a href={data.contract_pdf_url} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent("pdf_consulted")}><FileText className="h-4 w-4 mr-2" />Lire le contrat (PDF)</a></Button>
        )}
        <div className="space-y-2">
          <p className="text-sm">1. Recevez un code de vérification à l'adresse {data.contract?.recipient_email}.</p>
          <div className="flex gap-2 items-center flex-wrap">
            <Button variant="secondary" onClick={sendCode} disabled={busy}>{sentTo ? "Renvoyer un code" : "Recevoir mon code"}</Button>
            {sentTo && <span className="text-sm text-muted-foreground">Code envoyé à {sentTo}, valable 10 minutes.</span>}
          </div>
          {sentTo && <Input placeholder="Code à 6 chiffres" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="max-w-[200px]" />}
        </div>
        <div><Label>2. Nom et prénom du signataire</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <Label>3. Votre signature</Label>
          <div className="border rounded bg-background"><canvas ref={canvasRef} className="w-full h-44 touch-none" style={{ touchAction: "none" }} /></div>
          <Button variant="ghost" size="sm" onClick={() => { clear(); trackEvent("signature_cleared"); }}>Effacer</Button>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={consent} onCheckedChange={(c) => { setConsent(!!c); trackEvent(c ? "consent_checkbox_checked" : "consent_checkbox_unchecked"); }} />
          <span>J'ai lu le contrat de distribution, j'en accepte les conditions et je reconnais que cette signature électronique a valeur légale.</span>
        </label>
        <Button onClick={sign} disabled={busy || code.length !== 6 || !name.trim() || !consent}>{busy ? <Spinner /> : "Signer le contrat"}</Button>
      </CardContent>
    </Card>
  );
}

export default function ProposerMonJeu() {
  const { token = "" } = useParams();
  const [data, setData] = useState<PublicOnboarding | null>(null);
  const [form, setForm] = useState<Form>({});
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [signedUrl, setSignedUrl] = useState<string | null | undefined>(undefined);
  const dirty = useRef(false);
  const formRef = useRef<Form>({});
  const { toast } = useToast();

  const load = useCallback(async () => {
    try { const d = await publicOnboarding.get(token); setData(d); setForm(d.form); formRef.current = d.form; }
    catch (e) { setError((e as Error).message); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const editable = data?.status === "form";
  const set = (k: string, v: string | boolean) => { const next = { ...formRef.current, [k]: v }; formRef.current = next; setForm(next); dirty.current = true; };

  const save = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    try { setSavedAt((await publicOnboarding.save(token, formRef.current)).saved_at); }
    catch { dirty.current = true; }
  }, [token]);
  useEffect(() => {
    if (!editable) return;
    const t = setInterval(save, 5000);
    const flush = () => { void save(); };
    window.addEventListener("pagehide", flush);
    return () => { clearInterval(t); window.removeEventListener("pagehide", flush); };
  }, [editable, save]);

  const submit = async () => {
    if (!confirm("Soumettre le formulaire ? Vous ne pourrez plus le modifier ensuite.")) return;
    setSubmitting(true); setMissing([]);
    try {
      const r = await publicOnboarding.submit(token, formRef.current);
      dirty.current = false;
      if (r.contract_error) { toast({ title: "Formulaire envoyé", description: r.contract_error }); await load(); }
      else { setData(r); window.scrollTo({ top: 0 }); }
    } catch (e) {
      if (e instanceof OnboardingError && e.missing) setMissing(e.missing);
      toast({ title: "Formulaire incomplet", description: (e as Error).message, variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  if (error) return <div className="min-h-screen flex items-center justify-center p-6"><Card className="max-w-md"><CardContent className="p-6 text-center">{error}</CardContent></Card></div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Spinner size="md" /></div>;

  const section = (title: string, fields: F[]) => (
    <Card><CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent className="grid sm:grid-cols-2 gap-4">{fields.map((f) => <Field key={f.key} f={f} form={form} set={set} disabled={!editable} />)}</CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
        <div className="flex items-center gap-3"><SupertiltLogo className="h-10" /><h1 className="text-2xl font-bold">Proposer mon jeu sur SuperTilt</h1></div>

        {(data.status === "signed" || signedUrl !== undefined) ? (
          <Card><CardContent className="p-6 space-y-3 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-primary" />
            <p className="font-semibold">Contrat signé, merci !</p>
            <p className="text-sm text-muted-foreground">Une copie vous a été envoyée par email. Nous préparons la fiche produit.</p>
            {(signedUrl ?? data.contract_pdf_url) && <Button variant="outline" asChild><a href={(signedUrl ?? data.contract_pdf_url)!} target="_blank" rel="noopener noreferrer">Télécharger le contrat signé</a></Button>}
          </CardContent></Card>
        ) : data.status === "contract" ? (
          <SignStep token={token} data={data} onSigned={setSignedUrl} />
        ) : data.status === "submitted" ? (
          <Card><CardContent className="p-6 text-center">Formulaire reçu. Le contrat est en préparation : SuperTilt revient vers vous rapidement.</CardContent></Card>
        ) : (
          <p className="text-sm text-muted-foreground">Vos réponses sont enregistrées automatiquement : vous pouvez revenir plus tard avec le même lien (valable jusqu'au {new Date(data.expires_at).toLocaleDateString("fr-FR")}). Commission SuperTilt : {data.commission}.</p>
        )}

        {editable && <>
          {section("Vendeur", SELLER)}
          <Card><CardHeader><CardTitle className="text-lg">Jeu</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              {GAME.map((f) => <Field key={f.key} f={f} form={form} set={set} disabled={!editable} />)}
              <Files kind="logo" label="Logo * (PNG, JPG, WebP)" accept="image/png,image/jpeg,image/webp" files={data.files} token={token} disabled={!editable} onChange={(files) => setData({ ...data, files })} />
              <Files kind="photo" label="Photos * (20 maximum, 10 Mo par fichier)" accept="image/png,image/jpeg,image/webp" multiple files={data.files} token={token} disabled={!editable} onChange={(files) => setData({ ...data, files })} />
              <Files kind="pdf" label="PDF de présentation (si pas d'URL)" accept="application/pdf" multiple files={data.files} token={token} disabled={!editable} onChange={(files) => setData({ ...data, files })} />
            </CardContent>
          </Card>
          {section("Logistique", LOGISTICS)}
          <Card><CardHeader><CardTitle className="text-lg">Location (facultatif)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!form.location_enabled} onCheckedChange={(c) => set("location_enabled", !!c)} />Je propose aussi le jeu à la location</label>
              {form.location_enabled && <div className="grid sm:grid-cols-2 gap-4">{LOCATION.map((f) => <Field key={f.key} f={f} form={form} set={set} disabled={false} />)}</div>}
            </CardContent>
          </Card>
          {section("Informations complémentaires", EXTRA)}
          {missing.length > 0 && <Card className="border-destructive"><CardContent className="p-4 text-sm"><p className="font-medium mb-1">À compléter :</p><ul className="list-disc pl-5">{missing.map((m) => <li key={m}>{m}</li>)}</ul></CardContent></Card>}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground">{savedAt ? `Brouillon enregistré à ${new Date(savedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { dirty.current = true; void save(); }}>Enregistrer le brouillon</Button>
              <Button onClick={submit} disabled={submitting}>{submitting ? <><Spinner /> Préparation du contrat…</> : "Soumettre et voir le contrat"}</Button>
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}
