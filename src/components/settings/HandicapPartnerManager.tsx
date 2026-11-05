import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, AlertTriangle, ExternalLink } from "lucide-react";
import { HANDICAP_TYPES, handicapTypeLabel } from "@/lib/handicapPartners";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskEmail, maskPhone } from "@/lib/demoMask";
import {
  useHandicapPartners,
  type HandicapPartner,
  type HandicapPartnerInput,
} from "@/hooks/useHandicapPartners";

/**
 * Réseau de partenaires du handicap (indicateur 26).
 *
 * L'auditeur demande la liste des partenaires mobilisables et les modalités de
 * recours. Elle se tient ici plutôt que dans un classeur externe : visible,
 * sauvegardée, et présentable sans sortir de l'application.
 */

const EMPTY: HandicapPartnerInput = {
  organisation: "",
  handicap_type: "tous",
  address: null,
  phone: null,
  email: null,
  url: null,
  notes: null,
  last_contact_date: null,
  is_active: true,
};

export default function HandicapPartnerManager() {
  const { partners, loading, save, remove, uncovered, active } = useHandicapPartners();
  const { isDemoMode } = useDemoMode();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HandicapPartner | null>(null);
  const [form, setForm] = useState<HandicapPartnerInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (p: HandicapPartner) => {
    setEditing(p);
    const { id, created_at, updated_at, ...rest } = p;
    setForm(rest);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.organisation.trim()) return;
    setSaving(true);
    const ok = await save(form, editing?.id);
    setSaving(false);
    if (ok) setOpen(false);
  };

  const set = <K extends keyof HandicapPartnerInput>(key: K, value: HandicapPartnerInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4" id="partenaires-handicap">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">Réseau de partenaires handicap</h3>
          <p className="text-sm text-muted-foreground">
            Acteurs mobilisables pour accueillir, accompagner ou orienter un bénéficiaire en
            situation de handicap. {active} partenaire{active > 1 ? "s" : ""} actif
            {active > 1 ? "s" : ""}.
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      </div>

      {uncovered.length > 0 && (
        <p className="text-sm text-muted-foreground border-l-2 border-primary pl-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Aucun partenaire actif ne couvre : {uncovered.join(", ")}.</span>
        </p>
      )}

      {partners.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun partenaire enregistré. L'indicateur 26 attend un réseau identifié.
        </p>
      ) : (
        <div className="space-y-2">
          {partners.map((p) => (
            <div
              key={p.id}
              className="border rounded-lg p-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{p.organisation}</span>
                  <Badge variant="outline" className="text-xs">
                    {handicapTypeLabel(p.handicap_type)}
                  </Badge>
                  {!p.is_active && <Badge variant="secondary" className="text-xs">Inactif</Badge>}
                </div>
                <div className="text-xs text-muted-foreground space-x-2">
                  {p.phone && <span>{isDemoMode ? maskPhone(p.phone) : p.phone}</span>}
                  {p.email && <span>{isDemoMode ? maskEmail(p.email) : p.email}</span>}
                  {p.url && (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Site <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {p.notes && <p className="text-xs text-muted-foreground line-clamp-2">{p.notes}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Modifier">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(p.id)} aria-label="Retirer">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le partenaire" : "Nouveau partenaire"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="hp-organisation">Organisme</Label>
              <Input
                id="hp-organisation"
                value={form.organisation}
                onChange={(e) => set("organisation", e.target.value)}
                placeholder="AGEFIPH"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hp-type">Handicap couvert</Label>
              <Select value={form.handicap_type} onValueChange={(v) => set("handicap_type", v)}>
                <SelectTrigger id="hp-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HANDICAP_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hp-address">Adresse</Label>
              <Input
                id="hp-address"
                value={form.address ?? ""}
                onChange={(e) => set("address", e.target.value || null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="hp-phone">Téléphone</Label>
                <Input
                  id="hp-phone"
                  value={form.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value || null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hp-email">Email</Label>
                <Input
                  id="hp-email"
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value || null)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hp-url">Site web</Label>
              <Input
                id="hp-url"
                type="url"
                value={form.url ?? ""}
                onChange={(e) => set("url", e.target.value || null)}
                placeholder="https://"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hp-notes">Ce que ce partenaire permet</Label>
              <Textarea
                id="hp-notes"
                rows={3}
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value || null)}
                placeholder="Modalités de recours, prestations mobilisables..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="hp-last-contact">Dernier contact</Label>
                <Input
                  id="hp-last-contact"
                  type="date"
                  value={form.last_contact_date ?? ""}
                  onChange={(e) => set("last_contact_date", e.target.value || null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hp-active">Statut</Label>
                <Select
                  value={form.is_active ? "actif" : "inactif"}
                  onValueChange={(v) => set("is_active", v === "actif")}
                >
                  <SelectTrigger id="hp-active">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actif">Actif</SelectItem>
                    <SelectItem value="inactif">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.organisation.trim()}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
