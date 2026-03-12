import { useState } from "react";
import { Users, Loader2 } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import ReseauOnboarding from "@/components/reseau/ReseauOnboarding";
import ReseauCartography from "@/components/reseau/ReseauCartography";
import ReseauDashboard from "@/components/reseau/ReseauDashboard";
import {
  usePositioning,
  useNetworkContacts,
  useUpsertPositioning,
  useCreateContact,
  useDeleteContact,
} from "@/hooks/useReseau";

type View = "auto" | "cartography";

const Reseau = () => {
  const { data: positioning, isLoading: posLoading } = usePositioning();
  const { data: contacts = [], isLoading: contactsLoading } = useNetworkContacts();
  const upsertPositioning = useUpsertPositioning();
  const createContact = useCreateContact();
  const deleteContact = useDeleteContact();
  const [forceView, setForceView] = useState<View>("auto");

  const isLoading = posLoading || contactsLoading;
  const hasOnboarding = positioning?.onboarding_completed_at != null;
  const hasContacts = contacts.length > 0;

  const currentView = forceView === "cartography"
    ? "cartography"
    : !hasOnboarding
      ? "onboarding"
      : hasContacts
        ? "dashboard"
        : "cartography";

  return (
    <ModuleLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <PageHeader
          icon={Users}
          title="Réseau"
          subtitle="Positionnement & cartographie de votre réseau professionnel"
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : currentView === "onboarding" ? (
          <ReseauOnboarding
            onComplete={() => setForceView("auto")}
          />
        ) : currentView === "cartography" ? (
          <ReseauCartography
            onComplete={() => setForceView("auto")}
          />
        ) : positioning ? (
          <ReseauDashboard
            positioning={positioning}
            contacts={contacts}
            onSavePositioning={(data) => upsertPositioning.mutate(data)}
            onCreateContact={(input) => createContact.mutate(input)}
            onDeleteContact={(id) => deleteContact.mutate(id)}
            onStartCartography={() => setForceView("cartography")}
          />
        ) : null}
      </div>
    </ModuleLayout>
  );
};

export default Reseau;
