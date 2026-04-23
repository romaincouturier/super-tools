import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SupportViewer from "@/components/formations/support/SupportViewer";
import { Spinner } from "@/components/ui/spinner";
import { lazy, Suspense } from "react";

const LmsCoursePlayer = lazy(() => import("./LmsCoursePlayer"));

const TrainingSupportPage = () => {
  const { trainingId } = useParams<{ trainingId: string }>();
  const [searchParams] = useSearchParams();

  const { data: training, isLoading } = useQuery({
    queryKey: ["training-support-type", trainingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("trainings")
        .select("supports_type, supports_lms_course_id")
        .eq("id", trainingId!)
        .single();
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

  // If training uses LMS course as support, render the LMS player
  if (training?.supports_type === "lms" && training?.supports_lms_course_id) {
    // Build URL params for the LMS player - it reads courseId from route params
    // We need to redirect or render inline with the course ID
    const email = searchParams.get("email") || "";
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>}>
        <LmsCoursePlayerWrapper courseId={training.supports_lms_course_id} email={email} />
      </Suspense>
    );
  }

  // Default: editor-based support
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-4xl mx-auto">
      <SupportViewer trainingId={trainingId} allowUnpublished showUnavailableState />
    </div>
  );
};

/** Wrapper that renders LmsCoursePlayer with the correct courseId via route override */
const LmsCoursePlayerWrapper = ({ courseId, email }: { courseId: string; email: string }) => {
  // LmsCoursePlayer uses useParams to get courseId, but we're on a different route
  // So we import the hooks directly and render the player content
  return (
    <div className="min-h-screen">
      <LmsCoursePlayerDirect courseId={courseId} email={email} />
    </div>
  );
};

export default TrainingSupportPage;

// Direct LMS player that accepts courseId as prop instead of route param
import { useCourse, useCourseModules, useCourseLessons, useLearnerProgress, useLearnerBadges, useMarkLessonComplete, useTrackPageView } from "@/hooks/useLms";
import { useState, useEffect, useCallback } from "react";

const LmsCoursePlayerDirect = ({ courseId, email }: { courseId: string; email: string }) => {
  // Redirect to the actual LMS player route
  window.location.href = `/lms/course/${courseId}${email ? `?email=${encodeURIComponent(email)}` : "?preview=admin"}`;
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
};
