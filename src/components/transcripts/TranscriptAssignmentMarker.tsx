import { Check, Link2, CircleDashed } from "lucide-react";
import {
  ASSIGNMENT_KIND_LABELS,
  describeAssignments,
  type TranscriptAssignment,
} from "@/hooks/useTranscriptAssignments";

interface Props {
  assignments: TranscriptAssignment[] | undefined;
  /** Entity currently being edited: its own link is shown as "déjà ajouté". */
  currentEntityId?: string;
  /** Show a marker when the transcript is not assigned anywhere. */
  showUnassigned?: boolean;
}

const TranscriptAssignmentMarker = ({ assignments, currentEntityId, showUnassigned }: Props) => {
  const list = assignments ?? [];
  const here = currentEntityId ? list.some((a) => a.entity_id === currentEntityId) : false;
  const elsewhere = list.filter((a) => a.entity_id !== currentEntityId);

  if (!here && elsewhere.length === 0) {
    if (!showUnassigned) return null;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0" title="Affecté à rien dans SuperTools">
        <CircleDashed className="h-3.5 w-3.5" />
        Non affecté
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 shrink-0">
      {here && (
        <span className="inline-flex items-center gap-1 text-xs text-primary">
          <Check className="h-3.5 w-3.5" />
          déjà ajouté
        </span>
      )}
      {elsewhere.length > 0 && (
        <span
          className="inline-flex items-center gap-1 text-xs text-accent-foreground bg-accent rounded px-1.5 py-0.5 max-w-[220px]"
          title={describeAssignments(elsewhere)}
        >
          <Link2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {elsewhere.length === 1
              ? `${ASSIGNMENT_KIND_LABELS[elsewhere[0].kind]} : ${elsewhere[0].label}`
              : `${elsewhere.length} affectations`}
          </span>
        </span>
      )}
    </span>
  );
};

export default TranscriptAssignmentMarker;
