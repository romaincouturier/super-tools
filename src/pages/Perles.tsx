import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Search, Trash2 } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import PearlLogo from "@/components/PearlLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useToast } from "@/hooks/use-toast";
import { usePearlMutations, usePearls } from "@/hooks/usePearls";
import { maskText } from "@/lib/demoMask";
import { todayAsISO } from "@/lib/dateFormatters";
import { formatPearlDate } from "@/lib/pearls";
import { toastError } from "@/lib/toastError";
import { getSignedUrl } from "@/lib/storageUrl";
import {
  PEARL_BUCKET,
  PEARL_SOURCE_LABELS,
  type Pearl,
  type PearlSource,
} from "@/services/pearls";

function usePearlImageUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (path) getSignedUrl(PEARL_BUCKET, path).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

function PearlCard({ p, onEdit }: { p: Pearl; onEdit: (p: Pearl) => void }) {
  const { isDemoMode } = useDemoMode();
  const { toast } = useToast();
  const { update, remove } = usePearlMutations();
  const image = usePearlImageUrl(p.image_path);
  const author = p.author_name || p.author_company
    ? [p.author_name, p.author_company].filter(Boolean).join(", ")
    : "Auteur inconnu";
  const mask = (v: string) => (isDemoMode ? maskText(v) : v);

  return (
    <Card className={p.archived ? "opacity-60" : ""}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {p.title && <p className="font-medium">{mask(p.title)}</p>}
            <p className="text-xs text-muted-foreground">
              {formatPearlDate(p.pearl_date, p.pearl_time)} · {mask(author)}
              {p.is_anonymous && " (anonyme au tableau de bord)"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!p.is_positive && <Badge variant="secondary">Hors tableau de bord</Badge>}
            <Badge variant="outline">{PEARL_SOURCE_LABELS[p.source]}</Badge>
          </div>
        </div>
        <p className="text-sm whitespace-pre-line">{mask(p.message)}</p>
        {p.message_fr && <p className="text-sm whitespace-pre-line text-muted-foreground">{mask(p.message_fr)}</p>}
        {image && <img src={image} alt="" className="max-h-48 rounded border" />}
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={() => onEdit(p)}><Pencil className="h-4 w-4" /></Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => update.mutate({ id: p.id, input: { archived: !p.archived } }, { onError: (e) => toastError(toast, e) })}
            aria-label={p.archived ? "Désarchiver" : "Archiver"}
          >
            {p.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (window.confirm("Supprimer définitivement cette perle ?")) {
                remove.mutate(p.id, { onError: (e) => toastError(toast, e) });
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


function PearlDialog({ pearl, open, onClose }: { pearl: Pearl | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { create, update } = usePearlMutations();
  const [message, setMessage] = useState("");
  const [messageFr, setMessageFr] = useState("");
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [positive, setPositive] = useState(true);
  const [date, setDate] = useState(todayAsISO());
  const [time, setTime] = useState("");
  const [source, setSource] = useState<PearlSource>("autre");
  const [image, setImage] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setMessage(pearl?.message ?? "");
    setMessageFr(pearl?.message_fr ?? "");
    setTitle(pearl?.title ?? "");
    setName(pearl?.author_name ?? "");
    setCompany(pearl?.author_company ?? "");
    setAnonymous(pearl?.is_anonymous ?? false);
    setPositive(pearl?.is_positive ?? true);
    setDate(pearl?.pearl_date ?? todayAsISO());
    setTime(pearl?.pearl_time?.slice(0, 5) ?? "");
    setSource(pearl?.source ?? "autre");
    setImage(null);
  }, [open, pearl]);

  const pending = create.isPending || update.isPending;

  const submit = () => {
    const input = {
      message: message.trim(),
      message_fr: messageFr.trim() || null,
      title: title.trim() || null,
      author_name: name.trim() || null,
      author_company: company.trim() || null,
      is_anonymous: anonymous,
      is_positive: positive,
      pearl_date: date,
      pearl_time: time || null,
      source,
    };
    const opts = { onSuccess: onClose, onError: (e: unknown) => toastError(toast, e) };
    if (pearl) update.mutate({ id: pearl.id, input, image }, opts);
    else create.mutate({ input, image }, opts);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{pearl ? "Modifier la perle" : "Nouvelle perle"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="pearl-message">Message</Label>
            <Textarea id="pearl-message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pearl-message-fr">Traduction française (optionnelle)</Label>
            <Textarea id="pearl-message-fr" rows={3} value={messageFr} onChange={(e) => setMessageFr(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pearl-title">Titre (optionnel)</Label>
            <Input id="pearl-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pearl-name">Personne</Label>
              <Input id="pearl-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pearl-company">Entreprise</Label>
              <Input id="pearl-company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="pearl-positive" checked={positive} onCheckedChange={(v) => setPositive(v === true)} />
            <Label htmlFor="pearl-positive">Positive : peut s'afficher sur le tableau de bord</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="pearl-anon" checked={anonymous} onCheckedChange={(v) => setAnonymous(v === true)} />
            <Label htmlFor="pearl-anon">Anonyme sur le tableau de bord</Label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pearl-date">Date</Label>
              <Input id="pearl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pearl-time">Heure</Label>
              <Input id="pearl-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as PearlSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PEARL_SOURCE_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pearl-image">Image (optionnelle)</Label>
            <Input
              id="pearl-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={pending || !message.trim() || !date}>
            {pending ? <Spinner size="sm" /> : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Perles() {
  const { data = [], isLoading } = usePearls();
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [tone, setTone] = useState<string>("all");
  const [editing, setEditing] = useState<Pearl | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((p) => {
      if (!showArchived && p.archived) return false;
      if (source !== "all" && p.source !== source) return false;
      if (tone === "positive" && !p.is_positive) return false;
      if (tone === "other" && p.is_positive) return false;
      if (!q) return true;
      return [p.title, p.message, p.message_fr, p.author_name, p.author_company]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [data, search, source, tone, showArchived]);

  const openDialog = (p: Pearl | null) => {
    setEditing(p);
    setDialogOpen(true);
  };

  return (
    <ModuleLayout>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <PageHeader
          logo={<PearlLogo size={44} />}
          title="Perles clients"
          subtitle={`Les mots qui font plaisir, à garder et à relire. ${data.filter((p) => !p.archived).length} perles.`}
          actions={<Button onClick={() => openDialog(null)}><Plus className="h-4 w-4 mr-1" /> Nouvelle perle</Button>}
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input className="pl-9" placeholder="Rechercher" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les sources</SelectItem>
              {Object.entries(PEARL_SOURCE_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les perles</SelectItem>
              <SelectItem value="positive">Positives (best of)</SelectItem>
              <SelectItem value="other">Hors tableau de bord</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Checkbox id="pearl-archived" checked={showArchived} onCheckedChange={(v) => setShowArchived(v === true)} />
            <Label htmlFor="pearl-archived">Archivées</Label>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune perle.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => <PearlCard key={p.id} p={p} onEdit={openDialog} />)}
          </div>
        )}
      </div>
      <PearlDialog pearl={editing} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </ModuleLayout>
  );
}
