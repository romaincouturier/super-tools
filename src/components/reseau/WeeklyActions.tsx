import { useState } from "react";
import { Sparkles, Check, SkipForward, Linkedin, Mail, Phone, Coffee, Share2, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import {
  useNetworkActions,
  useGenerateWeeklyActions,
  useUpdateActionStatus,
} from "@/hooks/useReseau";
import type { NetworkContact, UserPositioning, NetworkAction, ActionType } from "@/types/reseau";

const ACTION_CONFIG: Record<ActionType, { icon: typeof Linkedin; label: string; color: string }> = {
  linkedin_message: { icon: Linkedin, label: "LinkedIn", color: "bg-blue-100 text-blue-800" },
  email: { icon: Mail, label: "Email", color: "bg-purple-100 text-purple-800" },
  phone_call: { icon: Phone, label: "Appel", color: "bg-green-100 text-green-800" },
  coffee_invite: { icon: Coffee, label: "Café", color: "bg-amber-100 text-amber-800" },
  share_content: { icon: Share2, label: "Partage", color: "bg-pink-100 text-pink-800" },
};

interface WeeklyActionsProps {
  positioning: UserPositioning;
  contacts: NetworkContact[];
}

const WeeklyActions = ({ positioning, contacts }: WeeklyActionsProps) => {
  const { toast } = useToast();
  const { copy } = useCopyToClipboard({ defaultToastTitle: "Copié !" });
  const { data: actions = [], isLoading: actionsLoading } = useNetworkActions();
  const generateActions = useGenerateWeeklyActions();
  const updateStatus = useUpdateActionStatus();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pendingActions = actions.filter((a) => a.status === "pending");
  const doneActions = actions.filter((a) => a.status !== "pending");

  const handleGenerate = async () => {
    try {
      const result = await generateActions.mutateAsync({ positioning, contacts });
      toast({
        title: `${result.length} actions générées`,
        description: "Votre plan d'actions hebdomadaire est prêt !",
      });
    } catch {
      toastError(toast, "Impossible de générer les actions.");
    }
  };

  const handleCopy = (text: string) => { copy(text); };

  const handleStatusUpdate = async (action: NetworkAction & { contact: NetworkContact | null }, status: "done" | "skipped") => {
    try {
      await updateStatus.mutateAsync({
        id: action.id,
        status,
        contactId: action.contact_id,
        actionType: action.action_type,
      });
    } catch {
      toastError(toast, "Impossible de mettre à jour l'action.");
    }
  };

  if (actionsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Spinner size="md" className="text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Actions de la semaine</CardTitle>
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={generateActions.isPending || contacts.length === 0}
        >
          {generateActions.isPending ? (
            <Spinner className="mr-1" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1" />
          )}
          Générer un plan
        </Button>
      </CardHeader>
      <CardContent>
        {pendingActions.length === 0 && doneActions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucune action cette semaine. Cliquez sur "Générer un plan" pour obtenir des suggestions d'actions personnalisées.
          </p>
        ) : (
          <div className="space-y-2">
            {pendingActions.map((action) => (
              <ActionItem
                key={action.id}
                action={action}
                contactName={action.contact?.name || "Contact inconnu"}
                isExpanded={expandedId === action.id}
                onToggle={() => setExpandedId(expandedId === action.id ? null : action.id)}
                onCopy={handleCopy}
                onDone={() => handleStatusUpdate(action, "done")}
                onSkip={() => handleStatusUpdate(action, "skipped")}
                isPending={updateStatus.isPending}
              />
            ))}

            {doneActions.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground pt-3 pb-1">
                  Terminées ({doneActions.length})
                </p>
                {doneActions.map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center gap-2 p-2 rounded border opacity-60"
                  >
                    <Badge variant="outline" className="text-xs">
                      {action.status === "done" ? "Fait" : "Passé"}
                    </Badge>
                    <span className="text-sm truncate">
                      {action.contact?.name || "Contact"} — {ACTION_CONFIG[action.action_type as ActionType]?.label || action.action_type}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

function ActionItem({
  action,
  contactName,
  isExpanded,
  onToggle,
  onCopy,
  onDone,
  onSkip,
  isPending,
}: {
  action: NetworkAction & { contact: NetworkContact | null };
  contactName: string;
  isExpanded: boolean;
  onToggle: () => void;
  onCopy: (text: string) => void;
  onDone: () => void;
  onSkip: () => void;
  isPending: boolean;
}) {
  const config = ACTION_CONFIG[action.action_type as ActionType] || ACTION_CONFIG.email;
  const Icon = config.icon;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <span className={`text-xs px-2 py-0.5 rounded-full ${config.color}`}>
          <Icon className="h-3 w-3 inline mr-1" />
          {config.label}
        </span>
        <span className="text-sm font-medium flex-1 truncate">{contactName}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onDone(); }}
            disabled={isPending}
            title="Marquer comme fait"
          >
            <Check className="h-3.5 w-3.5 text-green-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onSkip(); }}
            disabled={isPending}
            title="Passer"
          >
            <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {isExpanded && action.message_draft && (
        <div className="px-3 pb-3 border-t bg-muted/30">
          <div className="flex items-start justify-between gap-2 pt-3">
            <p className="text-sm whitespace-pre-wrap flex-1">{action.message_draft}</p>
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0"
              onClick={() => onCopy(action.message_draft!)}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copier
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WeeklyActions;
