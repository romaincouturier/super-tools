import { useParams } from "react-router-dom";
import SupportViewer from "@/components/formations/support/SupportViewer";

const TrainingSupportPage = () => {
  const { trainingId } = useParams<{ trainingId: string }>();

  if (!trainingId) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-4xl mx-auto">
      <SupportViewer trainingId={trainingId} />
    </div>
  );
};

export default TrainingSupportPage;
