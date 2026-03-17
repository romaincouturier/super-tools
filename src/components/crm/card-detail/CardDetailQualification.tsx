import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Check,
  Briefcase,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSearchMissions } from "@/hooks/useMissions";
import { useUpdateCard } from "@/hooks/useCrmBoard";
import { missionStatusConfig } from "@/types/missions";
import { acquisitionSourceConfig, type AcquisitionSource, type BriefQuestion } from "@/types/crm";
import CrmDescriptionEditor from "../CrmDescriptionEditor";
import AssignedUserSelector from "@/components/formations/AssignedUserSelector";
import type { CardDetailState, CardDetailHandlers } from "./types";

interface Props {
  state: CardDetailState;
  handlers: CardDetailHandlers;
}

const CardDetailQualification = ({ state, handlers }: Props) => {
  const { user } = useAuth();
  const updateCard = useUpdateCard();
  const {
    card, serviceType, setServiceType, acquisitionSource, setAcquisitionSource,
    assignedTo, setAssignedTo,
    localBriefQuestions, setLocalBriefQuestions, briefExpanded, setBriefExpanded,
    descriptionHtml, descriptionSaving, descriptionSaved,
    linkedMissionId, setLinkedMissionId,
    missionSearchQuery, setMissionSearchQuery,
    showMissionSearch, setShowMissionSearch,
  } = state;

  const { data: missionSearchResults, isLoading: searchingMissions } = useSearchMissions(missionSearchQuery);

  return (
    <>
      {/* Type & Source */}
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={serviceType || ""}
            onValueChange={(v) => setServiceType(v as "formation" | "mission" | null)}
          >
            <SelectTrigger className="h-7 w-auto text-xs gap-1">
              <SelectValue placeholder="Type de prestation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="formation">Formation</SelectItem>
              <SelectItem value="mission">Mission</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={acquisitionSource || ""}
            onValueChange={(v) => setAcquisitionSource(v as AcquisitionSource)}
          >
            <SelectTrigger className="h-7 w-auto text-xs gap-1">
              <SelectValue placeholder="Source d'acquisition" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(acquisitionSourceConfig) as [AcquisitionSource, string][]).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Assigned user */}
        <div className="mt-2">
          <Label className="text-xs text-muted-foreground mb-1 block">Assigné à</Label>
          <AssignedUserSelector value={assignedTo} onChange={setAssignedTo} />
        </div>
      </div>

      <div className="space-y-4 mt-6">
        <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
          Qualification
        </h4>

        {/* Brief questions */}
        {localBriefQuestions && localBriefQuestions.length > 0 && (
          <div className="p-4 bg-amber-50 rounded-lg space-y-2">
            <button
              onClick={() => setBriefExpanded(!briefExpanded)}
              className="flex items-center justify-between w-full"
            >
              <h4 className="font-medium text-sm flex items-center gap-2">
                📋 Questions pour le brief
                <span className="text-xs text-muted-foreground font-normal">
                  ({localBriefQuestions.filter((q: BriefQuestion) => q.answered).length}/{localBriefQuestions.length})
                </span>
              </h4>
              {briefExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {briefExpanded && (
              <ul className="space-y-1.5">
                {localBriefQuestions.map((q: BriefQuestion) => {
                  const toggleQuestion = () => {
                    if (!user?.email) return;
                    const updatedQuestions = localBriefQuestions.map((bq: BriefQuestion) =>
                      bq.id === q.id ? { ...bq, answered: !bq.answered } : bq
                    );
                    setLocalBriefQuestions(updatedQuestions);
                    updateCard.mutate({
                      id: card.id,
                      updates: { brief_questions: updatedQuestions },
                      actorEmail: user.email,
                      oldCard: card,
                    });
                  };
                  return (
                    <li
                      key={q.id}
                      className="flex items-start gap-2.5 text-sm cursor-pointer select-none"
                      onClick={toggleQuestion}
                    >
                      <Checkbox
                        checked={q.answered}
                        onCheckedChange={toggleQuestion}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5"
                      />
                      <span className={cn("flex-1", q.answered && "text-muted-foreground line-through")}>
                        {q.question}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* Description / Notes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              Description / Notes
              {descriptionSaving && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Enregistrement...
                </span>
              )}
              {descriptionSaved && !descriptionSaving && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Enregistré
                </span>
              )}
            </Label>
          </div>
          <CrmDescriptionEditor
            content={descriptionHtml}
            onChange={handlers.handleDescriptionChange}
            cardId={card?.id}
          />
        </div>

        {/* Linked Mission */}
        {serviceType === "mission" && (
          <div className="p-4 bg-purple-50 rounded-lg space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Mission liée
            </h4>
            {linkedMissionId ? (
              <div className="flex items-center justify-between p-2 bg-white rounded border">
                <span className="text-sm">Mission #{linkedMissionId.slice(0, 8)}</span>
                <Button variant="ghost" size="sm" onClick={() => setLinkedMissionId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={missionSearchQuery}
                    onChange={(e) => {
                      setMissionSearchQuery(e.target.value);
                      setShowMissionSearch(true);
                    }}
                    placeholder="Rechercher une mission..."
                    className="h-8"
                  />
                  {searchingMissions && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                {showMissionSearch && missionSearchResults && missionSearchResults.length > 0 && (
                  <div className="border rounded bg-white max-h-40 overflow-y-auto">
                    {missionSearchResults.map((mission) => (
                      <button
                        key={mission.id}
                        className="w-full text-left p-2 hover:bg-muted text-sm border-b last:border-b-0"
                        onClick={() => {
                          setLinkedMissionId(mission.id);
                          setMissionSearchQuery("");
                          setShowMissionSearch(false);
                        }}
                      >
                        <div className="font-medium">{mission.title}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {mission.client_name && <span>{mission.client_name}</span>}
                          {mission.client_contact && <span>· {mission.client_contact}</span>}
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px]"
                            style={{
                              backgroundColor: missionStatusConfig[mission.status].color + "20",
                              color: missionStatusConfig[mission.status].color,
                            }}
                          >
                            {missionStatusConfig[mission.status].label}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showMissionSearch && missionSearchQuery.length >= 2 && missionSearchResults?.length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucune mission trouvée</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default CardDetailQualification;
