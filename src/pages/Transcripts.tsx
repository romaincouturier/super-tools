import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Mic } from "lucide-react";

export default function Transcripts() {
  return (
    <ModuleLayout>
      <PageHeader title="Transcripts" />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <Mic className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-medium">Module en cours de développement</p>
            <p className="text-sm text-muted-foreground mt-1">
              Les transcripts vidéo (Google Drive) et les transcripts de réunions (Fireflies) apparaîtront ici automatiquement.
            </p>
          </div>
        </CardContent>
      </Card>
    </ModuleLayout>
  );
}
