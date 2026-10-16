import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Mission, UpdateMissionInput } from "@/types/missions";

interface Props {
  mission: Mission;
  onSave: (updates: UpdateMissionInput) => Promise<unknown>;
}

/** Indicateur « Facture à émettre » : désactivé automatiquement dès qu'une facture est saisie. */
export default function InvoiceToIssueFlag({ mission, onSave }: Props) {
  const [note, setNote] = useState(mission.invoice_to_issue_note ?? "");
  const [amount, setAmount] = useState(mission.invoice_to_issue_amount?.toString() ?? "");

  useEffect(() => {
    setNote(mission.invoice_to_issue_note ?? "");
    setAmount(mission.invoice_to_issue_amount?.toString() ?? "");
  }, [mission.id, mission.invoice_to_issue_note, mission.invoice_to_issue_amount]);

  const active = !!mission.invoice_to_issue;
  const parsedAmount = amount.trim() ? parseFloat(amount.replace(",", ".")) : null;
  const dirty =
    (note.trim() || null) !== (mission.invoice_to_issue_note ?? null) ||
    (parsedAmount ?? null) !== (mission.invoice_to_issue_amount ?? null);

  const toggle = (on: boolean) =>
    onSave(
      on
        ? { invoice_to_issue: true, invoice_to_issue_set_at: new Date().toISOString() }
        : { invoice_to_issue: false, invoice_to_issue_note: null, invoice_to_issue_amount: null, invoice_to_issue_set_at: null },
    );

  return (
    <div className="mt-3 rounded-lg border p-3 space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
        <Switch checked={active} onCheckedChange={toggle} />
        <Receipt className="h-4 w-4" />
        Facture à émettre
      </label>
      {active && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="flex-1 min-w-[200px]"
            placeholder="Précision (ex. acompte 50 %)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Input
            className="w-32"
            type="number"
            min="0"
            step="0.01"
            placeholder="Montant €"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {dirty && (
            <Button
              size="sm"
              onClick={() =>
                onSave({
                  invoice_to_issue_note: note.trim() || null,
                  invoice_to_issue_amount: parsedAmount !== null && isFinite(parsedAmount) ? parsedAmount : null,
                })
              }
            >
              Enregistrer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
