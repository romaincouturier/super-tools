import { Database, Clock, Zap, MousePointerClick } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDot } from "@/components/ui/alert-dot";
import DbSizeTab from "@/components/monitoring/DbSizeTab";
import CronJobsTab from "@/components/monitoring/CronJobsTab";
import EdgeFunctionsTab from "@/components/monitoring/EdgeFunctionsTab";
import FeatureUsageTab from "@/components/monitoring/FeatureUsageTab";
import { useEdgeFunctionsAlert } from "@/hooks/useEdgeFunctionsAlert";

const Monitoring = () => {
  const edgeFunctionsAlert = useEdgeFunctionsAlert();

  return (
    <ModuleLayout>
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <PageHeader icon={Database} title="Monitoring" />

        {/* Tabs */}
        <Tabs defaultValue="database">
          <TabsList>
            <TabsTrigger value="database" className="gap-2">
              <Database className="h-4 w-4" />
              Base de données
            </TabsTrigger>
            <TabsTrigger value="crons" className="gap-2">
              <Clock className="h-4 w-4" />
              Cron Jobs
            </TabsTrigger>
            <TabsTrigger value="functions" className="gap-2 relative">
              <Zap className="h-4 w-4" />
              Edge Functions
              {edgeFunctionsAlert && (
                <AlertDot active className="relative top-0 right-0 ml-1" />
              )}
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-2">
              <MousePointerClick className="h-4 w-4" />
              Usage
            </TabsTrigger>
          </TabsList>

          <TabsContent value="database">
            <DbSizeTab />
          </TabsContent>

          <TabsContent value="crons">
            <CronJobsTab />
          </TabsContent>

          <TabsContent value="functions">
            <EdgeFunctionsTab />
          </TabsContent>

          <TabsContent value="usage">
            <FeatureUsageTab />
          </TabsContent>
        </Tabs>
      </main>
    </ModuleLayout>
  );
};

export default Monitoring;
