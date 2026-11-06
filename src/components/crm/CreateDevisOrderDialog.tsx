import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useCreateDevisOrder, useLatestGameDevis, useOrderableGames } from "@/hooks/useDevisOrders";
import { matchGameByTitle, type DevisOrderAddress, type DevisOrderLine } from "@/services/devisOrders";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cardId: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  onCreated?: (orderNumber: string) => void;
}

const EUR = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const ADDRESS_FIELDS: Array<[keyof DevisOrderAddress, string]> = [
  ["company", "Société"], ["first_name", "Prénom"], ["last_name", "Nom"], ["address_1", "Adresse"],
  ["postcode", "Code postal"], ["city", "Ville"], ["country", "Pays"], ["phone", "Téléphone"],
];

function AddressFields({ value, onChange, disabled }: { value: DevisOrderAddress; onChange: (v: DevisOrderAddress) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ADDRESS_FIELDS.map(([k, label]) => (
        <div key={k} className={k === "address_1" || k === "company" ? "col-span-2 space-y-1" : "space-y-1"}>
          <Label className="text-xs">{label}</Label>
          <Input className="h-8 text-sm" disabled={disabled} value={value[k] ?? ""} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
        </div>
      ))}
    </div>
  );
}

export default function CreateDevisOrderDialog(props: Props) {
  const { open, onOpenChange, cardId } = props;
  const { toast } = useToast();
  const { data: devis, isLoading: loadingDevis } = useLatestGameDevis(open ? cardId : null);
  const { data: games = [], isLoading: loadingGames } = useOrderableGames(open);
  const create = useCreateDevisOrder();

  const [lines, setLines] = useState<DevisOrderLine[]>([]);
  const [shippingFee, setShippingFee] = useState(0);
  const [adminFee, setAdminFee] = useState(0);
  const [billing, setBilling] = useState<DevisOrderAddress>({});
  const [shipping, setShipping] = useState<DevisOrderAddress>({});
  const [sameAddress, setSameAddress] = useState(true);
  const [customerEmail, setCustomerEmail] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => { if (!open) setInitialized(false); }, [open]);

  useEffect(() => {
    if (!open || initialized || loadingDevis || loadingGames) return;
    const prefLines: DevisOrderLine[] = (devis?.items ?? []).map((it) => {
      const g = matchGameByTitle(it.title, games);
      return { gameId: g?.id ?? "", quantity: Number(it.quantity) || 1, unitPrice: Number(it.unitPrice) || 0, discountPercent: 0, isLocation: g?.game_type === "location" };
    });
    setLines(prefLines.length ? prefLines : [{ gameId: "", quantity: 1, unitPrice: 0, discountPercent: 0, isLocation: false }]);
    setShippingFee(devis?.shippingFee ?? 0);
    setAdminFee(devis?.adminFee ?? 0);
    const addr: DevisOrderAddress = {
      company: props.company || devis?.clientName || "",
      first_name: props.firstName, last_name: props.lastName,
      address_1: props.address ?? "", postcode: props.postalCode ?? "", city: props.city ?? "", country: "FR",
    };
    setBilling(addr);
    setShipping(addr);
    setCustomerEmail(props.email || devis?.recipientEmail || "");
    setInitialized(true);
  }, [open, initialized, loadingDevis, loadingGames, devis, games, props]);

  const lineTotal = (l: DevisOrderLine) => +(l.quantity * l.unitPrice * (1 - (l.discountPercent || 0) / 100)).toFixed(2);
  const totalHt = useMemo(() => lines.reduce((s, l) => s + lineTotal(l), 0) + (shippingFee || 0) + (adminFee || 0), [lines, shippingFee, adminFee]);
  const unmatched = (devis?.items ?? []).filter((it) => !matchGameByTitle(it.title, games)).map((it) => it.title);
  const valid = lines.length > 0 && lines.every((l) => l.gameId && l.quantity > 0 && l.unitPrice >= 0 && l.discountPercent >= 0 && l.discountPercent <= 100);

  const update = (i: number, patch: Partial<DevisOrderLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    try {
      const res = await create.mutateAsync({
        crmCardId: cardId,
        devisActivityLogId: devis?.activityLogId ?? null,
        customer: { firstName: billing.first_name, lastName: billing.last_name, email: customerEmail, company: billing.company },
        billingAddress: { ...billing, email: customerEmail },
        shippingAddress: sameAddress ? billing : shipping,
        lines,
        shippingFee,
        adminFee,
      });
      toast({
        title: res.existing ? `Commande ${res.order_number} déjà existante` : `Commande ${res.order_number} créée`,
        description: res.existing ? "Aucune nouvelle commande n'a été créée." : res.auto_send ? "Les auteurs et partenaires concernés sont prévenus." : "L'envoi automatique aux auteurs est désactivé : envoyez-les depuis le kanban.",
      });
      props.onCreated?.(res.order_number);
      onOpenChange(false);
    } catch (e) {
      toastError(toast, e, { title: "Échec de la création de la commande" });
    }
  };

  const loading = loadingDevis || loadingGames || !initialized;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer la commande issue du devis</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <div className="space-y-5 text-sm">
            <p className="text-muted-foreground">
              {devis ? `Pré-rempli depuis le devis du ${new Date(devis.createdAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}.` : "Aucun devis de jeux trouvé pour cette opportunité : saisissez les lignes."}
              {" "}Aucune commande ni facture n'est créée sur la boutique.
            </p>
            {unmatched.length > 0 && (
              <p className="rounded border border-destructive/40 bg-destructive/5 p-2 text-destructive">
                Jeux du devis à choisir manuellement : {unmatched.join(", ")}
              </p>
            )}

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_70px_90px_70px_70px_90px_32px] gap-2 text-xs text-muted-foreground">
                <span>Jeu</span><span>Qté</span><span>Prix HT</span><span>Remise %</span><span>Location</span><span className="text-right">Total HT</span><span />
              </div>
              {lines.map((l, i) => {
                const game = games.find((g) => g.id === l.gameId);
                return (
                  <div key={i} className="grid grid-cols-[1fr_70px_90px_70px_70px_90px_32px] items-center gap-2">
                    <Select value={l.gameId} onValueChange={(v) => { const g = games.find((x) => x.id === v); update(i, { gameId: v, isLocation: g?.game_type === "location" }); }}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Choisir un jeu" /></SelectTrigger>
                      <SelectContent>{games.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input className="h-8" type="number" min={1} step={1} value={l.quantity} onChange={(e) => update(i, { quantity: Math.max(0, parseInt(e.target.value || "0", 10)) })} />
                    <Input className="h-8" type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => update(i, { unitPrice: parseFloat(e.target.value || "0") })} />
                    <Input className="h-8" type="number" min={0} max={100} step="0.5" value={l.discountPercent} onChange={(e) => update(i, { discountPercent: parseFloat(e.target.value || "0") })} />
                    <Switch checked={l.isLocation} disabled={!game || (game.game_type !== "location" && game.location_variation_id == null)} onCheckedChange={(v) => update(i, { isLocation: v })} />
                    <span className="text-right font-medium">{EUR(lineTotal(l))}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Retirer la ligne" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { gameId: "", quantity: 1, unitPrice: 0, discountPercent: 0, isLocation: false }])}>
                <Plus className="mr-1 h-4 w-4" />Ajouter une ligne
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label className="text-xs">Frais de port HT</Label><Input className="h-8" type="number" min={0} step="0.01" value={shippingFee} onChange={(e) => setShippingFee(parseFloat(e.target.value || "0"))} /></div>
              <div className="space-y-1"><Label className="text-xs">Frais de dossier HT</Label><Input className="h-8" type="number" min={0} step="0.01" value={adminFee} onChange={(e) => setAdminFee(parseFloat(e.target.value || "0"))} /></div>
              <div className="space-y-1"><Label className="text-xs">Total HT</Label><p className="h-8 pt-1.5 font-semibold">{EUR(totalHt)}</p></div>
            </div>

            <div className="space-y-1"><Label className="text-xs">Email du client</Label><Input className="h-8" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><p className="font-medium">Adresse de facturation</p><AddressFields value={billing} onChange={setBilling} /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><p className="font-medium">Adresse de livraison</p>
                  <label className="flex items-center gap-2 text-xs"><Switch checked={sameAddress} onCheckedChange={setSameAddress} />Identique</label>
                </div>
                <AddressFields value={sameAddress ? billing : shipping} onChange={setShipping} disabled={sameAddress} />
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={loading || !valid || create.isPending}>
            {create.isPending && <Spinner className="mr-1" />}Valider la commande
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
