import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

export default function Temoignages() {
  return (
    <ModuleLayout>
      <PageHeader title="Témoignages" />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <Star className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-medium">Module en cours de développement</p>
            <p className="text-sm text-muted-foreground mt-1">
              Les témoignages vidéo déposés sur Google Drive seront automatiquement transcrits et indexés ici avec le nom du client et de son entreprise.
            </p>
          </div>
        </CardContent>
      </Card>
    </ModuleLayout>
  );
}
