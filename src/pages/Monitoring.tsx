import { Database, Clock, Zap, MousePointerClick } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DbSizeTab from "@/components/monitoring/DbSizeTab";
import CronJobsTab from "@/components/monitoring/CronJobsTab";
import EdgeFunctionsTab from "@/components/monitoring/EdgeFunctionsTab";
import FeatureUsageTab from "@/components/monitoring/FeatureUsageTab";

const Monitoring = () => {
  return (
    <ModuleLayout>
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Monitoring</h1>
          </div>
        </div>

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
            <TabsTrigger value="functions" className="gap-2">
              <Zap className="h-4 w-4" />
              Edge Functions
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
