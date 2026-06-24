import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddParticipantDialog from "./AddParticipantDialog";
import type { FormationFormula } from "@/types/training";
import type { Participant } from "@/hooks/useEditParticipant";

interface Props {
  participant: Participant;
  trainingId: string;
  trainingStartDate?: string | null;
  trainingEndDate?: string | null;
  formatFormation?: string | null;
  isInterEntreprise?: boolean;
  availableFormulas?: FormationFormula[];
  onDuplicated: () => void;
  trigger?: React.ReactNode;
}

/**
 * Rouvre la modale d'ajout de participant pré-remplie avec toutes les
 * informations du participant source (société, BPF, montant, commanditaire,
 * financeur, mode de paiement, formule), sauf nom/prénom/email qui restent
 * à compléter pour la nouvelle personne.
 */
const DuplicateParticipantDialog = ({
  participant,
  trainingId,
  trainingStartDate,
  trainingEndDate,
  formatFormation,
  isInterEntreprise,
  availableFormulas = [],
  onDuplicated,
  trigger,
}: Props) => {
  return (
    <AddParticipantDialog
      trainingId={trainingId}
      trainingStartDate={trainingStartDate ?? undefined}
      trainingEndDate={trainingEndDate ?? undefined}
      formatFormation={formatFormation}
      isInterEntreprise={isInterEntreprise}
      availableFormulas={availableFormulas}
      onParticipantAdded={onDuplicated}
      title="Dupliquer le participant"
      description="Le prénom, le nom et l'email sont à compléter. Toutes les autres informations sont copiées."
      trigger={
        trigger ?? (
          <Button variant="outline" size="sm">
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Dupliquer
          </Button>
        )
      }
      initialCompany={participant.company ?? undefined}
      initialCompanyAddress={participant.company_address ?? undefined}
      initialCompanyZip={participant.company_zip ?? undefined}
      initialCompanyCity={participant.company_city ?? undefined}
      initialSoldPriceHt={
        participant.sold_price_ht != null ? String(participant.sold_price_ht) : undefined
      }
      initialFormulaId={participant.formula_id ?? undefined}
      initialPaymentMode={participant.payment_mode === "online" ? "online" : "invoice"}
      initialFinanceurSameAsSponsor={participant.financeur_same_as_sponsor}
      initialFinanceurName={participant.financeur_name ?? undefined}
      initialFinanceurUrl={participant.financeur_url ?? undefined}
      initialTypeStagiaireBpf={participant.type_stagiaire_bpf ?? undefined}
      initialSourceFinancementBpf={participant.source_financement_bpf ?? undefined}
      initialSponsorFirstName={participant.sponsor_first_name ?? undefined}
      initialSponsorLastName={participant.sponsor_last_name ?? undefined}
      initialSponsorEmail={participant.sponsor_email ?? undefined}
    />
  );
};

export default DuplicateParticipantDialog;
