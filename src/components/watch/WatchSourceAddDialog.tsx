import { useState } from "react";
import { z } from "zod";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProposeWatchSource, type ProposeWatchSourceInput } from "@/hooks/useWatchSources";
import { WATCH_EXPERTS, WATCH_SOURCE_TYPES, WATCH_SOURCE_LANGUAGES, normalizeWatchSourceUrl } from "@/lib/watchSources";
import { toast } from "@/lib/toast";

const initial: ProposeWatchSourceInput = { expert: "strategie", theme: "", name: "", type: "site", language: "fr", url: "", why: "", how_to_follow: "", proposed_by: "romain" };
const schema = z.object({
  expert: z.string().refine((v) => Object.prototype.hasOwnProperty.call(WATCH_EXPERTS, v)),
  name: z.string().trim().min(1).max(300), theme: z.string().trim().max(160),
  url: z.string().max(4000).transform(normalizeWatchSourceUrl),
  type: z.enum(WATCH_SOURCE_TYPES), language: z.enum(["fr", "en", "autre"]),
  why: z.string(), how_to_follow: z.string(), proposed_by: z.string().trim().min(1),
});

export default function WatchSourceAddDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const mutation = useProposeWatchSource();
  const field = (key: keyof ProposeWatchSourceInput, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const parsed = schema.parse(form);
      const result = await mutation.mutateAsync({ ...form, ...parsed, expert: form.expert });
      if (!result.saved) {
        toast.info(`Source déjà enregistrée : ${result.source.name}`);
        return;
      }
      toast.success("Source proposée");
      setOpen(false);
      setForm(initial);
    } catch (error) {
      toast.error("Impossible d’ajouter la source. Vérifiez le nom et l’URL.", { cause: error });
    }
  };
  return <Dialog open={open} onOpenChange={setOpen}>
    <Button className="gap-2" onClick={() => { setForm(initial); setOpen(true); }}><Plus className="h-4 w-4" />Ajouter une source</Button>
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Ajouter une source</DialogTitle></DialogHeader>
      <form id="watch-source-form" onSubmit={submit} className="space-y-4">
        <div className="space-y-1"><Label htmlFor="source-expert">Expert</Label><Select value={form.expert} onValueChange={(v) => field("expert", v)}><SelectTrigger id="source-expert"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(WATCH_EXPERTS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label htmlFor="source-name">Nom</Label><Input id="source-name" required maxLength={300} value={form.name} onChange={(e) => field("name", e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="source-url">URL canonique</Label><Input id="source-url" type="url" required maxLength={4000} value={form.url} onChange={(e) => field("url", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="source-type">Type</Label><Select value={form.type} onValueChange={(v) => field("type", v)}><SelectTrigger id="source-type"><SelectValue /></SelectTrigger><SelectContent>{WATCH_SOURCE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor="source-language">Langue</Label><Select value={form.language} onValueChange={(v) => field("language", v)}><SelectTrigger id="source-language"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(WATCH_SOURCE_LANGUAGES).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="space-y-1"><Label htmlFor="source-theme">Thème</Label><Input id="source-theme" maxLength={160} value={form.theme} onChange={(e) => field("theme", e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="source-why">Pourquoi cette source est utile</Label><Textarea id="source-why" value={form.why} onChange={(e) => field("why", e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="source-follow">Comment s’abonner</Label><Textarea id="source-follow" value={form.how_to_follow} onChange={(e) => field("how_to_follow", e.target.value)} /></div>
      </form>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>Annuler</Button><Button type="submit" form="watch-source-form" disabled={mutation.isPending}>{mutation.isPending ? "Enregistrement…" : "Proposer"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}