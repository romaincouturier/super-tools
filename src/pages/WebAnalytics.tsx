import { Globe, Search, Mail } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WpStatisticsDashboard from "@/components/statistics/WpStatisticsDashboard";
import SearchConsoleDashboard from "@/components/statistics/SearchConsoleDashboard";
import BrevoDashboard from "@/components/statistics/BrevoDashboard";

const WebAnalytics = () => {
  return (
    <ModuleLayout>
      <main className="max-w-[1600px] mx-auto p-6 space-y-6">
        <PageHeader icon={Globe} title="Statistiques du site" />
        <Tabs defaultValue="site" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="site" className="gap-1.5"><Globe className="h-3.5 w-3.5" />Site web</TabsTrigger>
            <TabsTrigger value="search-console" className="gap-1.5"><Search className="h-3.5 w-3.5" />Search Console</TabsTrigger>
            <TabsTrigger value="emailing" className="gap-1.5"><Mail className="h-3.5 w-3.5" />Emailing (Brevo)</TabsTrigger>
          </TabsList>
          <TabsContent value="site">
            <WpStatisticsDashboard />
          </TabsContent>
          <TabsContent value="search-console">
            <SearchConsoleDashboard />
          </TabsContent>
          <TabsContent value="emailing">
            <BrevoDashboard />
          </TabsContent>
        </Tabs>
      </main>
    </ModuleLayout>
  );
};

export default WebAnalytics;
