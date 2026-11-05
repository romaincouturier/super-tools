import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskName } from "@/lib/demoMask";
import { useNetworkContacts } from "@/hooks/useReseauContacts";
import { useLinkTranscriptToNetworkContact } from "@/hooks/useNetworkTranscripts";
import { WARMTH_LABELS, type WarmthLevel } from "@/types/reseau";

export default function LinkTranscriptToNetworkDialog({ transcriptId }: { transcriptId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [contactId, setContactId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [warmth, setWarmth] = useState<WarmthLevel>("warm");
  const [linkedin, setLinkedin] = useState("");
  const { isDemoMode } = useDemoMode();
  const { data: contacts = [] } = useNetworkContacts();
  const link = useLinkTranscriptToNetworkContact();

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return contacts
      .filter((c) => !s || c.name.toLowerCase().includes(s) || (c.context ?? "").toLowerCase().includes(s))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))
      .slice(0, 50);
  }, [contacts, search]);

  const canSubmit = mode === "existing" ? !!contactId : !!name.trim();

  const submit = () => {
    link.mutate(
      mode === "existing"
        ? { transcriptId, contactId: contactId! }
        : { transcriptId, newContact: { name, context, warmth, linkedin_url: linkedin } },
      {
        onSuccess: (r) => {
          toast.success(r.status === "already_assigned" ? "Déjà rattaché à ce contact" : "Transcript rattaché au contact Réseau");
          setOpen(false);
          setContactId(null);
          setName(""); setContext(""); setLinkedin(""); setWarmth("warm"); setSearch("");
        },
        onError: (e: any) => toast.error(e?.message ?? "Erreur"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          <Users className="h-3.5 w-3.5 mr-1" /> Rattacher à un contact Réseau
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rattacher à un contact Réseau</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Une interaction « réunion » est ajoutée au contact avec le résumé et le lien du transcript, et la date de dernier contact est mise à jour.
        </p>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")}>
          <TabsList className="w-full">
            <TabsTrigger value="existing" className="flex-1">Contact existant</TabsTrigger>
            <TabsTrigger value="new" className="flex-1">Nouveau contact</TabsTrigger>
          </TabsList>
          <TabsContent value="existing" className="space-y-2">
            <Input placeholder="Rechercher un contact" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filtered.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Aucun contact</p>}
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setContactId(c.id)}
                  className={`w-full text-left rounded border px-3 py-2 text-sm ${contactId === c.id ? "border-primary bg-accent" : "hover:bg-muted"}`}
                >
                  <span className="font-medium">{isDemoMode ? maskName(c.name) : c.name}</span>
                  <span className="text-xs text-muted-foreground"> · {WARMTH_LABELS[c.warmth]}{c.context ? ` · ${c.context}` : ""}</span>
                </button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="new" className="space-y-2">
            <Input placeholder="Nom du contact" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Contexte (ex : pair facilitateur, projet de partenariat)" value={context} onChange={(e) => setContext(e.target.value)} />
            <Select value={warmth} onValueChange={(v) => setWarmth(v as WarmthLevel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hot">Chaud</SelectItem>
                <SelectItem value="warm">Tiède</SelectItem>
                <SelectItem value="cold">Froid</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="URL LinkedIn (facultatif)" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
          </TabsContent>
        </Tabs>
        <Button onClick={submit} disabled={!canSubmit || link.isPending} className="w-full">
          Rattacher
        </Button>
      </DialogContent>
    </Dialog>
  );
}
