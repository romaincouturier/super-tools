import { useState, useMemo } from "react";
import { Users, MessageSquare, BarChart3, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PositioningCard from "./PositioningCard";
import ContactsList from "./ContactsList";
import WeeklyActions from "./WeeklyActions";
import CoolingAlerts from "./CoolingAlerts";
import NetworkStatsPanel from "./NetworkStatsPanel";
import {
  useCoolingContacts,
  useNetworkActions,
  useNetworkInteractions,
  useNetworkStats,
} from "@/hooks/useReseau";
import type { NetworkContact, UserPositioning } from "@/types/reseau";
import type { WarmthLevel } from "@/types/reseau";

type DashboardTab = "overview" | "stats";

interface ReseauDashboardProps {
  positioning: UserPositioning;
  contacts: NetworkContact[];
  onSavePositioning: (data: { pitch_one_liner: string; key_skills: string[]; target_client: string }) => void;
  onCreateContact: (input: { name: string; context?: string; warmth: WarmthLevel }) => void;
  onDeleteContact: (id: string) => void;
  onStartCartography: () => void;
}

const ReseauDashboard = ({
  positioning,
  contacts,
  onSavePositioning,
  onCreateContact,
  onDeleteContact,
  onStartCartography,
}: ReseauDashboardProps) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const coolingContacts = useCoolingContacts(contacts, positioning);
  const { data: actions = [] } = useNetworkActions();
  const { data: interactions = [] } = useNetworkInteractions();
  const stats = useNetworkStats(contacts, actions, interactions);

  const { hotCount, warmCount, coldCount } = useMemo(() => ({
    hotCount: contacts.filter((c) => c.warmth === "hot").length,
    warmCount: contacts.filter((c) => c.warmth === "warm").length,
    coldCount: contacts.filter((c) => c.warmth === "cold").length,
  }), [contacts]);

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "overview" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("overview")}
        >
          <LayoutDashboard className="h-4 w-4 mr-1.5" />
          Vue d'ensemble
        </Button>
        <Button
          variant={activeTab === "stats" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("stats")}
        >
          <BarChart3 className="h-4 w-4 mr-1.5" />
          Statistiques
        </Button>
      </div>

      {activeTab === "stats" ? (
        <NetworkStatsPanel stats={stats} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <PositioningCard positioning={positioning} onSave={onSavePositioning} />
            </div>
            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Réseau</h3>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-danger-surface">
                    <p className="text-xl font-bold text-danger-ink">{hotCount}</p>
                    <p className="text-xs text-danger-ink">Chauds</p>
                  </div>
                  <div className="p-2 rounded-lg bg-caution-surface">
                    <p className="text-xl font-bold text-caution-ink">{warmCount}</p>
                    <p className="text-xs text-caution-ink">Tièdes</p>
                  </div>
                  <div className="p-2 rounded-lg bg-info-surface">
                    <p className="text-xl font-bold text-info-ink">{coldCount}</p>
                    <p className="text-xs text-info-ink">Froids</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={onStartCartography}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Enrichir mon réseau
                </Button>
              </CardContent>
            </Card>
          </div>

          <CoolingAlerts coolingContacts={coolingContacts} />

          <WeeklyActions positioning={positioning} contacts={contacts} />

          <ContactsList
            contacts={contacts}
            onCreate={onCreateContact}
            onDelete={onDeleteContact}
          />
        </>
      )}
    </div>
  );
};

export default ReseauDashboard;
