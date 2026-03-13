import { useState } from "react";
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

  const hotCount = contacts.filter((c) => c.warmth === "hot").length;
  const warmCount = contacts.filter((c) => c.warmth === "warm").length;
  const coldCount = contacts.filter((c) => c.warmth === "cold").length;

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
                  <div className="p-2 rounded-lg bg-red-50">
                    <p className="text-xl font-bold text-red-700">{hotCount}</p>
                    <p className="text-xs text-red-600">Chauds</p>
                  </div>
                  <div className="p-2 rounded-lg bg-orange-50">
                    <p className="text-xl font-bold text-orange-700">{warmCount}</p>
                    <p className="text-xs text-orange-600">Tièdes</p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50">
                    <p className="text-xl font-bold text-blue-700">{coldCount}</p>
                    <p className="text-xs text-blue-600">Froids</p>
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
