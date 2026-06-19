import { useState, useEffect } from "react";

const FEES_STORAGE_KEY = "game-devis-last-fees";
import { Plus, Trash2, Loader2, Send, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ClientInfoSection from "@/components/formations/ClientInfoSection";
import { useSirenSearch } from "@/hooks/useSirenSearch";
import { useGames, useGameDevisHistory } from "@/hooks/useDropshipping";
import { useGenerateGameDevis, type GameDevisItem } from "@/hooks/useGameDevis";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";

const EUR = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const DATE = (s: string) => new Date(s).toLocaleDateString("fr-FR");

interface LineItem {
  id: string;
  gameId: string;
  title: string;
  quantity: number;
  unitPrice: number;
}

export default function GameDevisTab() {
  const { toast } = useToast();
  const { data: games = [] } = useGames();
  const generateDevis = useGenerateGameDevis();
  const sirenSearch = useSirenSearch();
  const { refetch: refetchHistory } = useGameDevisHistory();

  const [nomClient, setNomClient] = useState("");
  const [adresseClient, setAdresseClient] = useState("");
  const [codePostalClient, setCodePostalClient] = useState("");
  const [villeClient, setVilleClient] = useState("");
  const [pays, setPays] = useState("france");
  const [paysAutre, setPaysAutre] = useState("");
  const [emailCommanditaire, setEmailCommanditaire] = useState("");
  const [civiliteCommanditaire, setCiviliteCommanditaire] = useState<"M." | "Mme" | "">("");
  const [prenomCommanditaire, setPrenomCommanditaire] = useState("");
  const [nomCommanditaire, setNomCommanditaire] = useState("");

  const [lines, setLines] = useState<LineItem[]>([]);
  const [fraisDePort, setFraisDePort] = useState<number | "">("");
  const [fraisDossier, setFraisDossier] = useState<number | "">("");
  const [noteDevis, setNoteDevis] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FEES_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { fraisDePort?: number; fraisDossier?: number };
      if (typeof saved.fraisDePort === "number") setFraisDePort(saved.fraisDePort);
      if (typeof saved.fraisDossier === "number") setFraisDossier(saved.fraisDossier);
    } catch {}
  }, []);

  const onSearchSiren = async () => {
    const r = await sirenSearch.handleSearchSiren();
    if (!r) return;
    if (r.nomClient) setNomClient(r.nomClient);
    if (r.adresseClient) setAdresseClient(r.adresseClient);
    if (r.codePostalClient) setCodePostalClient(r.codePostalClient);
    if (r.villeClient) setVilleClient(r.villeClient);
    if (r.pays) setPays(r.pays);
    if (r.paysAutre) setPaysAutre(r.paysAutre);
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), gameId: "", title: "", quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));

  const updateLine = (id: string, patch: Partial<LineItem>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const selectGame = (lineId: string, gameId: string) => {
    const game = games.find((g) => g.id === gameId);
    if (!game) return;
    updateLine(lineId, { gameId, title: game.title });
  };

  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const totalHT =
    subtotal + (typeof fraisDePort === "number" ? fraisDePort : 0) + (typeof fraisDossier === "number" ? fraisDossier : 0);

  const canSubmit =
    nomClient.trim() &&
    emailCommanditaire.trim() &&
    lines.length > 0 &&
    lines.every((l) => l.title && l.quantity > 0 && l.unitPrice > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const adresseCommanditaire = [civiliteCommanditaire, nomCommanditaire]
      .filter(Boolean)
      .join(" ")
      .trim();

    const items: GameDevisItem[] = lines.map((l) => ({
      title: l.title,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }));

    const finalPays = pays === "france" ? "France" : paysAutre;

    try {
      await generateDevis.mutateAsync({
        nomClient,
        adresseClient,
        codePostalClient,
        villeClient,
        pays: finalPays,
        emailCommanditaire: emailCommanditaire.trim().toLowerCase(),
        adresseCommanditaire: adresseCommanditaire || emailCommanditaire,
        items,
        fraisDePort: typeof fraisDePort === "number" ? fraisDePort : 0,
        fraisDossier: typeof fraisDossier === "number" ? fraisDossier : 0,
        noteDevis,
      });
      toast({ title: "Devis envoyé !", description: `Le devis a été généré et envoyé à ${emailCommanditaire}` });
      try {
        localStorage.setItem(
          FEES_STORAGE_KEY,
          JSON.stringify({
            fraisDePort: typeof fraisDePort === "number" ? fraisDePort : 0,
            fraisDossier: typeof fraisDossier === "number" ? fraisDossier : 0,
          }),
        );
      } catch {}
      setLines([]);
      refetchHistory();
    } catch (err) {
      toastError(toast, err);
    }
  };

  return (
    <div className="space-y-12">
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">
      <ClientInfoSection
        siren={sirenSearch.siren}
        setSiren={sirenSearch.setSiren}
        searchingSiren={sirenSearch.searchingSiren}
        onSearchSiren={onSearchSiren}
        nomClient={nomClient}
        setNomClient={setNomClient}
        searchingSirenByName={sirenSearch.searchingSirenByName}
        onSearchSirenByName={() => sirenSearch.handleSearchSirenByName(nomClient)}
        adresseClient={adresseClient}
        setAdresseClient={setAdresseClient}
        codePostalClient={codePostalClient}
        setCodePostalClient={setCodePostalClient}
        villeClient={villeClient}
        setVilleClient={setVilleClient}
        pays={pays}
        setPays={setPays}
        paysAutre={paysAutre}
        setPaysAutre={setPaysAutre}
        emailCommanditaire={emailCommanditaire}
        setEmailCommanditaire={setEmailCommanditaire}
        civiliteCommanditaire={civiliteCommanditaire}
        setCiviliteCommanditaire={setCiviliteCommanditaire}
        prenomCommanditaire={prenomCommanditaire}
        setPrenomCommanditaire={setPrenomCommanditaire}
        nomCommanditaire={nomCommanditaire}
        setNomCommanditaire={setNomCommanditaire}
      />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2">Jeux</h3>

        {lines.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
            Aucun jeu ajouté. Cliquez sur "Ajouter un jeu" pour commencer.
          </p>
        )}

        {lines.map((line) => (
          <div key={line.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-end p-3 border rounded-lg bg-muted/30">
            <div className="space-y-1">
              <Label className="text-xs">Jeu</Label>
              <Select value={line.gameId} onValueChange={(v) => selectGame(line.id, v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un jeu..." />
                </SelectTrigger>
                <SelectContent>
                  {games.filter((g) => g.status === "active").map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 w-20">
              <Label className="text-xs">Qté</Label>
              <Input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(e) => updateLine(line.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                className="text-center"
              />
            </div>
            <div className="space-y-1 w-28">
              <Label className="text-xs">Prix unitaire HT</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={line.unitPrice || ""}
                onChange={(e) => updateLine(line.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive mb-0.5"
              onClick={() => removeLine(line.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {lines.length > 0 && (
          <div className="text-sm text-right text-muted-foreground">
            Sous-total jeux : <span className="font-medium text-foreground">{EUR(subtotal)}</span>
          </div>
        )}

        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus className="h-4 w-4 mr-1.5" />Ajouter un jeu
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2">Frais</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="frais-port">Frais de port HT (€)</Label>
            <Input
              id="frais-port"
              type="number"
              min={0}
              step={0.01}
              value={fraisDePort}
              onChange={(e) => setFraisDePort(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="frais-dossier">Frais de dossier HT (€)</Label>
            <Input
              id="frais-dossier"
              type="number"
              min={0}
              step={0.01}
              value={fraisDossier}
              onChange={(e) => setFraisDossier(e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>
        </div>
        {lines.length > 0 && (
          <div className="rounded-lg bg-muted/50 p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sous-total jeux</span>
              <span>{EUR(subtotal)}</span>
            </div>
            {typeof fraisDePort === "number" && fraisDePort > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frais de port</span>
                <span>{EUR(fraisDePort)}</span>
              </div>
            )}
            {typeof fraisDossier === "number" && fraisDossier > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frais de dossier</span>
                <span>{EUR(fraisDossier)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-1 mt-1">
              <span>Total HT</span>
              <span>{EUR(totalHT)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="note-devis">Note sur le devis <span className="text-muted-foreground font-normal text-sm">(facultatif)</span></Label>
        <Textarea
          id="note-devis"
          placeholder="Conditions particulières, mentions spéciales..."
          value={noteDevis}
          onChange={(e) => setNoteDevis(e.target.value)}
          className="min-h-[80px]"
        />
      </div>

      <Button type="submit" className="w-full font-semibold text-lg py-6" disabled={!canSubmit || generateDevis.isPending}>
        {generateDevis.isPending ? (
          <><Loader2 className="w-5 h-5 animate-spin mr-2" />Génération en cours...</>
        ) : (
          <><Send className="w-5 h-5 mr-2" />Générer le devis jeux</>
        )}
      </Button>
    </form>

    <GameDevisHistory />
    </div>
  );
}

function GameDevisHistory() {
  const { data: history = [], isLoading } = useGameDevisHistory();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
        <FileText className="h-5 w-5" />Devis envoyés
      </h3>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : history.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">Aucun devis jeux envoyé pour le moment.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Destinataire</TableHead>
                <TableHead>Jeux</TableHead>
                <TableHead className="text-right">Total HT</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm">{DATE(d.created_at)}</TableCell>
                  <TableCell className="text-sm font-medium">{d.client_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.recipient_email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.items.reduce((s, i) => s + i.quantity, 0)} article(s)
                  </TableCell>
                  <TableCell className="text-right text-sm">{EUR(d.total_amount)}</TableCell>
                  <TableCell>
                    {d.pdf_url && (
                      <Button asChild variant="ghost" size="icon">
                        <a href={d.pdf_url} target="_blank" rel="noopener noreferrer" title="Ouvrir le PDF">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
