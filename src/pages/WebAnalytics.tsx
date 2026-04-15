import { lazy, Suspense } from "react";
import { Globe } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";

const WpStatisticsDashboard = lazy(() => import("@/components/statistics/WpStatisticsDashboard"));

const WebAnalytics = () => {
  return (
    <ModuleLayout>
      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        <PageHeader icon={Globe} title="Statistiques du site" />
        <Suspense fallback={<div className="flex justify-center py-12"><Spinner size="lg" className="text-primary" /></div>}>
          <WpStatisticsDashboard />
        </Suspense>
      </main>
    </ModuleLayout>
  );
};

export default WebAnalytics;
