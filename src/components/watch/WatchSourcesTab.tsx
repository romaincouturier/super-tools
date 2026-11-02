import { useMemo, useState } from "react";
import { Check, ExternalLink, MailPlus, Search, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useWatchSources, useUpdateWatchSource } from "@/hooks/useWatchSources";
import { WATCH_EXPERTS, WATCH_SOURCE_STATUSES, WATCH_SOURCE_TYPES, WATCH_SOURCE_LANGUAGES, type WatchSource } from "@/lib/watchSources";
import { toast } from "@/lib/toast";
import WatchSourceAddDialog from "./WatchSourceAddDialog";

function SourceRow({ source }: { source: WatchSource }) {
  const mutation = useUpdateWatchSource();
  const change = async (patch: Parameters<typeof mutation.mutateAsync>[0]) => {
    try { await mutation.mutateAsync(patch); }
    catch (error) { toast.error("Impossible de mettre à jour la source", { cause: error }); }
  };
  return <article className="border-b py-5 space-y-3">
    <div className="flex flex-wrap justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-medium inline-flex items-center gap-2 max-w-full break-words text-primary">{source.name}<ExternalLink className="h-3.5 w-3.5 shrink-0" /></a>
        <p className="text-xs text-muted-foreground break-words">{WATCH_EXPERTS[source.expert]} · {source.type} · {WATCH_SOURCE_LANGUAGES[source.language]}{source.theme && ` · ${source.theme}`}</p>
      </div>
      <Badge variant={source.status === "proposed" ? "default" : "secondary"}>{WATCH_SOURCE_STATUSES[source.status]}</Badge>
    </div>
    {source.why && <p className="text-sm whitespace-pre-wrap break-words">{source.why}</p>}
    {source.how_to_follow && <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{source.how_to_follow}</p>}
    {source.notes && <p className="text-sm whitespace-pre-wrap break-words">{source.notes}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={source.status === "to_subscribe" ? "secondary" : "outline"} disabled={mutation.isPending || source.status === "to_subscribe"} onClick={() => change({ id: source.id, status: "to_subscribe" })} className="gap-1.5"><MailPlus className="h-4 w-4" />À abonner</Button>
        <Button size="sm" variant={source.status === "followed" ? "secondary" : "outline"} disabled={mutation.isPending || source.status === "followed"} onClick={() => change({ id: source.id, status: "followed" })} className="gap-1.5"><Check className="h-4 w-4" />Suivie</Button>
        <Button size="sm" variant="ghost" disabled={mutation.isPending || source.status === "dropped"} onClick={() => change({ id: source.id, status: "dropped" })} className="gap-1.5"><X className="h-4 w-4" />Abandonner</Button>
      </div>
      <div className="flex items-center gap-1" role="group" aria-label={`Utilité de ${source.name}`}>
        <span className="text-xs text-muted-foreground mr-1">Utilité</span>
        {[1, 2, 3, 4, 5].map((rating) => <Button key={rating} variant="ghost" size="icon" className="h-8 w-8" title={`${rating}/5`} aria-label={`Utilité ${rating} sur 5`} aria-pressed={source.usefulness === rating} disabled={mutation.isPending} onClick={() => change({ id: source.id, usefulness: source.usefulness === rating ? null : rating })}><Star className={source.usefulness !== null && rating <= source.usefulness ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4 text-muted-foreground"} /></Button>)}
      </div>
    </div>
    <p className="text-xs text-muted-foreground">{source.items_count} fiche{source.items_count !== 1 ? "s" : ""} · Proposée par {source.proposed_by}{source.last_useful_at && ` · Dernière fiche utile : ${new Date(source.last_useful_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}`}</p>
  </article>;
}

export default function WatchSourcesTab() {
  const { data: sources = [], isLoading, isError, refetch } = useWatchSources();
  const [search, setSearch] = useState("");
  const [expert, setExpert] = useState("all");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [language, setLanguage] = useState("all");
  const filtered = useMemo(() => sources.filter((source) =>
    (expert === "all" || source.expert === expert) && (status === "all" || source.status === status)
    && (type === "all" || source.type === type) && (language === "all" || source.language === language)
    && [source.name, source.theme, source.why, source.notes, source.url, source.how_to_follow, source.proposed_by, WATCH_EXPERTS[source.expert]].join(" ").toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr"))), [sources, expert, status, type, language, search]);
  const filter = (label: string, value: string, set: (v: string) => void, options: Record<string, string>) =>
    <Select value={value} onValueChange={set}><SelectTrigger aria-label={label} className="w-full sm:w-auto sm:min-w-[140px] sm:max-w-[270px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{label}</SelectItem>{Object.entries(options).map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select>;
  return <section className="space-y-4">
    <div className="flex flex-wrap justify-between gap-3 items-center">
      <div className="flex flex-wrap gap-2">{Object.entries(WATCH_SOURCE_STATUSES).map(([key, label]) => <Button key={key} size="sm" variant={status === key ? "secondary" : "outline"} onClick={() => setStatus(status === key ? "all" : key)}>{label}<Badge className="ml-2" variant="secondary">{sources.filter((s) => s.status === key).length}</Badge></Button>)}</div>
      <WatchSourceAddDialog />
    </div>
    <div className="flex flex-wrap gap-3">
      <div className="relative w-full"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Rechercher une source" className="pl-9" placeholder="Rechercher une source…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {filter("Tous les experts", expert, setExpert, WATCH_EXPERTS)}
      {filter("Tous les statuts", status, setStatus, WATCH_SOURCE_STATUSES)}
      {filter("Tous les types", type, setType, Object.fromEntries(WATCH_SOURCE_TYPES.map((t) => [t, t])))}
      {filter("Toutes les langues", language, setLanguage, WATCH_SOURCE_LANGUAGES)}
      {(search || [expert, status, type, language].some((v) => v !== "all")) && <Button variant="ghost" onClick={() => { setSearch(""); setExpert("all"); setStatus("all"); setType("all"); setLanguage("all"); }} className="gap-1"><X className="h-4 w-4" />Effacer</Button>}
    </div>
    {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : isError ? <div className="text-center py-12 space-y-3"><p>Impossible de charger les sources.</p><Button variant="outline" onClick={() => refetch()}>Réessayer</Button></div> : <>
      <p className="text-xs text-muted-foreground">{filtered.length} source{filtered.length !== 1 ? "s" : ""}</p>
      {filtered.length ? filtered.map((source) => <SourceRow key={source.id} source={source} />) : <p className="text-center text-muted-foreground py-12">Aucune source{sources.length ? " correspondant aux filtres" : " enregistrée"}.</p>}
    </>}
  </section>;
}