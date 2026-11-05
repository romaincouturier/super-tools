import { useEffect, useRef, useState } from "react";
import { Bold, Download, Heading2, List, Send, ExternalLink, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useTrainingRegulation } from "@/hooks/useTrainingRegulation";
import { generateRegulationPdf } from "@/lib/trainingRegulationPdf";
import { regulationDate } from "@/lib/trainingRegulation";
import { reportHandledError } from "@/lib/sentry";

export default function TrainingRegulationEditor({ onPublished }: { onPublished: (url: string) => void }) {
  const model = useTrainingRegulation(onPublished);
  const field = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    const timer = setTimeout(() => {
      generateRegulationPdf(model.content, new Date().toISOString()).then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview(objectUrl); setPreviewError("");
      }).catch(cause => { if (active) { reportHandledError(cause); setPreviewError("Aperçu PDF indisponible"); } });
    }, 650);
    return () => { active = false; clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [model.content]);
  const format = (prefix: string, suffix = "") => {
    const el = field.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    model.change(model.content.slice(0, start) + prefix + model.content.slice(start, end) + suffix + model.content.slice(end));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + prefix.length, end + prefix.length); });
  };
  return <section id="reglement-interieur" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-medium">Règlement intérieur des formations</h3>
      {model.url && <Button variant="outline" size="sm" asChild><a href={model.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />PDF publié</a></Button>}
    </div>
    {model.loading ? <Spinner /> : <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="regulation-content">Brouillon</Label>
            <span className="text-xs text-muted-foreground" role="status">{model.status === "saving" ? "Enregistrement…" : model.status === "saved" ? "Brouillon enregistré" : "Modifications non enregistrées"}</span>
          </div>
          <div className="flex items-center gap-1 border-b pb-2">
            <Button variant="ghost" size="icon" title="Titre" aria-label="Titre" disabled={model.publishing} onClick={() => format("\n## ")}><Heading2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" title="Gras" aria-label="Gras" disabled={model.publishing} onClick={() => format("**", "**")}><Bold className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" title="Liste" aria-label="Liste" disabled={model.publishing} onClick={() => format("\n- ")}><List className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" title="Enregistrer le brouillon" aria-label="Enregistrer le brouillon" disabled={model.publishing || model.status === "saving"} onClick={() => { void model.save().catch(() => undefined); }}><Save className="h-4 w-4" /></Button>
          </div>
          <Textarea ref={field} id="regulation-content" value={model.content} onChange={e => model.change(e.target.value)} onBlur={() => { void model.save().catch(() => undefined); }} disabled={model.publishing} className="min-h-[580px] font-mono text-sm leading-relaxed" />
          {model.error && <p role="alert" className="text-sm text-destructive">{model.error}</p>}
        </div>
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2"><Label>Aperçu PDF</Label>{preview && <Button variant="ghost" size="sm" asChild><a href={preview} download="reglement-interieur-brouillon.pdf"><Download className="mr-2 h-4 w-4" />Brouillon PDF</a></Button>}</div>
          {previewError ? <p role="alert" className="text-destructive text-sm">{previewError}</p> : preview ? <iframe title="Aperçu du règlement intérieur SuperTilt" src={preview} className="w-full h-[640px] border rounded-md bg-card" /> : <div className="h-[640px] flex items-center justify-center border rounded-md"><Spinner /></div>}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
        <Button disabled={model.publishing || !model.content.trim() || !!previewError} onClick={() => setConfirm(true)}>{model.publishing ? <Spinner className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}Publier le règlement</Button>
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Versions publiées</h4>
        {model.versions.length === 0 ? <p className="text-sm text-muted-foreground">{model.url ? "PDF actuel conservé jusqu’à la prochaine publication." : "Aucune version publiée."}</p> : <ul className="divide-y">{[...model.versions].reverse().map(version => <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="text-sm"><span className="font-medium">{version.published_at ? regulationDate(version.published_at) : version.label || "PDF précédent"}</span><span className="ml-2 text-muted-foreground">{version.url === model.url ? "En vigueur" : "Archivée"}</span></div>
          <div className="flex items-center gap-2">{version.content && <Button variant="ghost" size="sm" disabled={model.publishing} onClick={() => model.change(version.content || "")}>Reprendre en brouillon</Button>}<Button variant="outline" size="sm" asChild><a href={version.url} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" />PDF</a></Button></div>
        </li>)}</ul>}
      </div>
    </>}
    <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogHeader><DialogTitle>Publier ce règlement ?</DialogTitle><DialogDescription>Le nouveau PDF sera accessible aux participants. Le PDF actuel restera archivé. Aucun email ne sera envoyé.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirm(false)}>Annuler</Button><Button onClick={() => { setConfirm(false); void model.publish(); }}>Confirmer la publication</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}