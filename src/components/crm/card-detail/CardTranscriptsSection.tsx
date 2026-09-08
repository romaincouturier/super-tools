import EntityTranscriptsSection from "@/components/shared/EntityTranscriptsSection";

interface Props {
  cardId: string;
}

const CardTranscriptsSection = ({ cardId }: Props) => (
  <EntityTranscriptsSection entity="crm_card" entityId={cardId} />
);

export default CardTranscriptsSection;
