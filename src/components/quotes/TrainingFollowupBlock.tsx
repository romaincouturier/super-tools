import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { followupAmount, totalHours, type TrainingFollowup } from "@/lib/quoteFollowup";

interface Formation { id: string; formation_name: string }
interface Formula { id: string; name: string; prix: number | null; duree_heures: number | null; coaching_sessions_count: number | null }

interface Props {
  value: TrainingFollowup | null;
  defaultRate: number;
  initialTitle?: string;
  averageHourly: number | null;
  alertThreshold: number;
  onChange: (f: TrainingFollowup | null) => void;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export default function TrainingFollowupBlock({ value, defaultRate, initialTitle, averageHourly, alertThreshold, onChange }: Props) {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [formationId, setFormationId] = useState(value?.formation_config_id || "");
  const [formulas, setFormulas] = useState<Formula[]>([]);

  useEffect(() => {
    supabase.from("formation_configs").select("id, formation_name").eq("is_active", true).order("formation_name")
      .then(({ data }) => {
        const list = (data || []) as Formation[];
        setFormations(list);
        if (!formationId && initialTitle) {
          const t = initialTitle.toLowerCase();
          const m = list.find((f) => t.includes(f.formation_name.toLowerCase()) || f.formation_name.toLowerCase().includes(t));
          if (m) setFormationId(m.id);
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!formationId) { setFormulas([]); return; }
    supabase.from("formation_formulas").select("id, name, prix, duree_heures, coaching_sessions_count")
      .eq("formation_config_id", formationId).order("display_order")
      .then(({ data }) => setFormulas((data || []) as Formula[]));
  }, [formationId]);

  const pickFormula = (id: string) => {
    const f = formulas.find((x) => x.id === id);
    const formation = formations.find((x) => x.id === formationId);
    if (!f || !formation) return;
    onChange({
      formation_config_id: formation.id, formation_name: formation.formation_name,
      formula_id: f.id, formula_name: f.name, formula_price: Number(f.prix) || 0,
      formula_hours: Number(f.duree_heures) || 0, included_sessions: f.coaching_sessions_count || 0,
      added_sessions: value?.added_sessions ?? 0, hourly_rate: value?.hourly_rate ?? defaultRate,
      single_line: value?.single_line ?? true,
    });
  };

  const set = (patch: Partial<TrainingFollowup>) => value && onChange({ ...value, ...patch });

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      <p className="font-medium">Formation du catalogue</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Formation</Label>
          <Select value={formationId} onValueChange={(v) => { setFormationId(v); onChange(null); }}>
            <SelectTrigger><SelectValue placeholder="Choisir une formation" /></SelectTrigger>
            <SelectContent>{formations.map((f) => <SelectItem key={f.id} value={f.id}>{f.formation_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Formule</Label>
          <Select value={value?.formula_id || ""} onValueChange={pickFormula} disabled={!formulas.length}>
            <SelectTrigger><SelectValue placeholder="Choisir une formule" /></SelectTrigger>
            <SelectContent>{formulas.map((f) => <SelectItem key={f.id} value={f.id}>{f.name} ({fmt(Number(f.prix) || 0)}, {f.duree_heures} h)</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {value && (
        <div className="space-y-3 border-t pt-3">
          <p className="font-medium">Suivi pédagogique individuel</p>
          <p className="text-sm text-muted-foreground">
            Compris dans la formule : {value.included_sessions > 0 ? `${value.included_sessions} séance(s) × 1 h = ${value.included_sessions} h` : "aucune séance"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Séances ajoutées (1 h)</Label>
              <Input type="number" min={0} step={1} value={value.added_sessions}
                onChange={(e) => set({ added_sessions: Math.max(0, parseInt(e.target.value) || 0) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tarif horaire HT</Label>
              <Input type="number" min={0} step={1} value={value.hourly_rate}
                onChange={(e) => set({ hourly_rate: Math.max(0, parseFloat(e.target.value) || 0) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Montant ajouté</Label>
              <div className="h-9 flex items-center px-3 bg-muted rounded-md font-semibold text-sm">{fmt(followupAmount(value))}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Durée du devis</Label>
              <div className="h-9 flex items-center px-3 bg-muted rounded-md font-semibold text-sm">
                {String(totalHours(value)).replace(".", ",")} h
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" className="rounded" checked={value.single_line}
              onChange={(e) => set({ single_line: e.target.checked })} />
            Afficher sur une seule ligne
          </label>
          {averageHourly !== null && (
            <p className="text-sm">Prix moyen par heure : <span className="font-semibold">{fmt(averageHourly)} / h</span>
              <span className="text-muted-foreground"> (non affiché sur le devis)</span></p>
          )}
          {averageHourly !== null && averageHourly > alertThreshold && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>Prix moyen supérieur au seuil de {fmt(alertThreshold)} / h : risque de refus OPCO.</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
