import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ChatbotProvider } from "@/components/chatbot/ChatbotProvider";
import { GlobalChunkErrorHandler } from "@/components/GlobalChunkErrorHandler";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { createIDBPersister } from "@/lib/queryPersister";
import OfflineBanner from "@/components/OfflineBanner";

// Lazy load all pages for better code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CertificateGenerator = lazy(() => import("./pages/CertificateGenerator"));
const MicroDevis = lazy(() => import("./pages/MicroDevis"));
const Historique = lazy(() => import("./pages/Historique"));
const Parametres = lazy(() => import("./pages/Parametres"));
const Formations = lazy(() => import("./pages/Formations"));
const FormationCreate = lazy(() => import("./pages/FormationCreate"));
const FormationEdit = lazy(() => import("./pages/FormationEdit"));
const FormationDetail = lazy(() => import("./pages/FormationDetail"));
const Questionnaire = lazy(() => import("./pages/Questionnaire"));
const Evaluation = lazy(() => import("./pages/Evaluation"));
const SponsorEvaluation = lazy(() => import("./pages/SponsorEvaluation"));
const Evaluations = lazy(() => import("./pages/Evaluations"));
const Ameliorations = lazy(() => import("./pages/Ameliorations"));
const PolitiqueConfidentialite = lazy(() => import("./pages/PolitiqueConfidentialite"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForcePasswordChange = lazy(() => import("./pages/ForcePasswordChange"));
const Emargement = lazy(() => import("./pages/Emargement"));
const SignatureDevis = lazy(() => import("./pages/SignatureDevis"));
const SignatureConvention = lazy(() => import("./pages/SignatureConvention"));
const ContentBoard = lazy(() => import("./pages/ContentBoard"));
const BesoinsParticipants = lazy(() => import("./pages/BesoinsParticipants"));
const TrainingSummary = lazy(() => import("./pages/TrainingSummary"));
const ChatbotAdmin = lazy(() => import("./pages/ChatbotAdmin"));
const InboundEmails = lazy(() => import("./pages/InboundEmails"));
const Statistiques = lazy(() => import("./pages/Statistiques"));
// These routes are often visited in long-running tabs; add retry for chunk-load resilience.
const Crm = lazyWithRetry(() => import("./pages/Crm"));
const CrmReports = lazyWithRetry(() => import("./pages/CrmReports"));
const Missions = lazy(() => import("./pages/Missions"));
const MissionSummary = lazy(() => import("./pages/MissionSummary"));
const OKR = lazy(() => import("./pages/OKR"));
const MediaLibrary = lazy(() => import("./pages/MediaLibrary"));
const Events = lazy(() => import("./pages/Events"));
const EventCreate = lazy(() => import("./pages/EventCreate"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const EventEdit = lazy(() => import("./pages/EventEdit"));
const Monitoring = lazy(() => import("./pages/Monitoring"));
const FailedEmails = lazy(() => import("./pages/FailedEmails"));
// AI Arena
const ArenaSetup = lazy(() => import("./pages/ArenaSetup"));
const ArenaDiscussion = lazy(() => import("./pages/ArenaDiscussion"));
const ArenaResults = lazy(() => import("./pages/ArenaResults"));
const Catalogue = lazy(() => import("./pages/Catalogue"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours — kept longer for offline support
    },
  },
});

const persister = createIDBPersister();
const persistOptions = {
  persister,
  maxAge: 1000 * 60 * 60 * 24, // 24 hours
};

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <GlobalChunkErrorHandler />
      <OfflineBanner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <RouteErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/certificates" element={<CertificateGenerator />} />
              <Route path="/micro-devis" element={<MicroDevis />} />
              <Route path="/historique" element={<Historique />} />
              <Route path="/parametres" element={<Parametres />} />
              <Route path="/formations" element={<Formations />} />
              <Route path="/formations/new" element={<FormationCreate />} />
              <Route path="/formations/:id" element={<FormationDetail />} />
              <Route path="/formations/:id/edit" element={<FormationEdit />} />
              {/* Needs summary across all trainings */}
              <Route path="/besoins" element={<BesoinsParticipants />} />
              {/* Evaluations dashboard */}
              <Route path="/evaluations" element={<Evaluations />} />
              {/* Improvements tracking */}
              <Route path="/ameliorations" element={<Ameliorations />} />
              {/* Content marketing board */}
              <Route path="/contenu" element={<ContentBoard />} />
              {/* Chatbot knowledge base admin */}
              <Route path="/chatbot-admin" element={<ChatbotAdmin />} />
              {/* Inbound emails */}
              <Route path="/emails" element={<InboundEmails />} />
              {/* Statistics dashboard */}
              <Route path="/statistiques" element={<Statistiques />} />
              {/* CRM Kanban */}
              <Route path="/crm" element={<Crm />} />
              <Route path="/crm/reports" element={<CrmReports />} />
              {/* Missions Kanban */}
              <Route path="/missions" element={<Missions />} />
              {/* OKR Management */}
              <Route path="/okr" element={<OKR />} />
              {/* Media library */}
              <Route path="/medias" element={<MediaLibrary />} />
              {/* Events */}
              <Route path="/events" element={<Events />} />
              <Route path="/events/new" element={<EventCreate />} />
              <Route path="/events/:id" element={<EventDetail />} />
              <Route path="/events/:id/edit" element={<EventEdit />} />
              {/* Admin monitoring */}
              <Route path="/monitoring" element={<Monitoring />} />
              {/* Training catalog */}
              <Route path="/catalogue" element={<Catalogue />} />
              {/* Failed emails */}
              <Route path="/emails-erreur" element={<FailedEmails />} />
              {/* Public needs survey */}
              <Route path="/questionnaire/:token" element={<Questionnaire />} />
              {/* Public evaluation form */}
              <Route path="/evaluation/:token" element={<Evaluation />} />
              {/* Public sponsor cold evaluation form */}
              <Route path="/evaluation-commanditaire/:token" element={<SponsorEvaluation />} />
              {/* Public attendance signature */}
              <Route path="/emargement/:token" element={<Emargement />} />
              {/* Public devis signature */}
              <Route path="/signature-devis/:token" element={<SignatureDevis />} />
              {/* Public convention signature */}
              <Route path="/signature-convention/:token" element={<SignatureConvention />} />
              {/* Public training summary for participants */}
              <Route path="/formation-info/:trainingId" element={<TrainingSummary />} />
              <Route path="/mission-info/:missionId" element={<MissionSummary />} />
              {/* Privacy policy */}
              <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/force-password-change" element={<ForcePasswordChange />} />
              {/* AI Arena */}
              <Route path="/arena" element={<ArenaSetup />} />
              <Route path="/arena/discussion" element={<ArenaDiscussion />} />
              <Route path="/arena/results" element={<ArenaResults />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </RouteErrorBoundary>
        </Suspense>
        <ChatbotProvider />
      </BrowserRouter>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
