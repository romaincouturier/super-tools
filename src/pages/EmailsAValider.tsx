import { Mail } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import EmailDraftsList from "@/components/emails/EmailDraftsList";

const EmailsAValider = () => {
  return (
    <ModuleLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-10 space-y-4">
        <PageHeader
          icon={Mail}
          title="Emails à valider"
          subtitle="Brouillons de relances (avis Google, témoignages vidéo) en attente de validation par la chargée de communication"
        />
        <EmailDraftsList showMissionLabel />
      </div>
    </ModuleLayout>
  );
};

export default EmailsAValider;
