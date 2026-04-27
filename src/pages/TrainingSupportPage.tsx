import { useParams, useSearchParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { rpc } from "@/lib/supabase-rpc";
import SupportViewer from "@/components/formations/support/SupportViewer";
import { Spinner } from "@/components/ui/spinner";

const TrainingSupportPage = () => {
  const { trainingId } = useParams<{ trainingId: string }>();
  const [searchParams] = useSearchParams();

  const { data: training, isLoading } = useQuery({
    queryKey: ["training-support-type", trainingId],
    queryFn: async () => {
      const { data, error } = await rpc.getTrainingSummaryInfo(trainingId!);
      if (error) throw error;
      return data;
    },
    enabled: !!trainingId,
  });

  if (!trainingId) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // If an LMS course is linked as support, redirect to the public LMS player.
  // The admin only has to pick a course — no need to also toggle a radio.
  if (training?.supports_lms_course_id) {
    const email = searchParams.get("email") || "";
    const params = email ? `?email=${encodeURIComponent(email)}` : "?preview=admin";
    return <Navigate to={`/formation-support/${trainingId}/lms/${training.supports_lms_course_id}${params}`} replace />;
  }

  // Default: editor-based support
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-4xl mx-auto">
      <SupportViewer trainingId={trainingId} allowUnpublished showUnavailableState />
    </div>
  );
};

export default TrainingSupportPage;
