import { AlertTriangle, Thermometer, Clock, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLogInteraction } from "@/hooks/useReseau";
import { WARMTH_LABELS, type CoolingContact } from "@/types/reseau";

interface CoolingAlertsProps {
  coolingContacts: CoolingContact[];
}

const CoolingAlerts = ({ coolingContacts }: CoolingAlertsProps) => {
  const { toast } = useToast();
  const logInteraction = useLogInteraction();

  if (coolingContacts.length === 0) return null;

  const overdueCount = coolingContacts.filter((c) => c.isOverdue).length;

  const handleLogInteraction = async (contactId: string, contactName: string) => {
    try {
      await logInteraction.mutateAsync({
        contact_id: contactId,
        interaction_type: "manual_log",
        notes: "Interaction manuelle enregistrée",
      });
      toast({ title: `Interaction avec ${contactName} enregistrée` });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  return (
    <Card className={overdueCount > 0 ? "border-orange-300" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Thermometer className="h-5 w-5 text-orange-500" />
          Contacts qui refroidissent
          {overdueCount > 0 && (
            <span className="text-xs font-normal bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
              {overdueCount} en retard
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {coolingContacts.map(({ contact, daysSinceLastContact, threshold, isOverdue }) => (
            <div
              key={contact.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                isOverdue ? "border-orange-200 bg-orange-50/50" : "border-yellow-100 bg-yellow-50/30"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />}
                  <span className="text-sm font-medium truncate">{contact.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {WARMTH_LABELS[contact.warmth]}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {daysSinceLastContact}j sans contact
                    {isOverdue ? ` (seuil: ${threshold}j)` : ` (seuil dans ${threshold - daysSinceLastContact}j)`}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0"
                onClick={() => handleLogInteraction(contact.id, contact.name)}
                disabled={logInteraction.isPending}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                J'ai contacté
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CoolingAlerts;
