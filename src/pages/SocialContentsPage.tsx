import { useState } from "react";
import { Plus, Share2 } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import SocialComposerDialog from "@/components/social/SocialComposerDialog";
import { Button } from "@/components/ui/button";

export default function SocialContentsPage() {
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <ModuleLayout>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
        <PageHeader
          icon={Share2}
          title="Contenus sociaux"
          subtitle="Rédigez un contenu une fois et déclinez-le sur plusieurs canaux."
          actions={<Button onClick={() => setComposerOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nouveau contenu</Button>}
        />
      </div>
      <SocialComposerDialog open={composerOpen} onOpenChange={setComposerOpen} groupId={null} />
    </ModuleLayout>
  );
}
