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
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
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
              <Route path="/" element={<PageErrorBoundary pageName="Dashboard"><Dashboard /></PageErrorBoundary>} />
              <Route path="/certificates" element={<PageErrorBoundary pageName="Certificats"><CertificateGenerator /></PageErrorBoundary>} />
              <Route path="/micro-devis" element={<PageErrorBoundary pageName="Micro-devis"><MicroDevis /></PageErrorBoundary>} />
              <Route path="/historique" element={<PageErrorBoundary pageName="Historique"><Historique /></PageErrorBoundary>} />
              <Route path="/parametres" element={<PageErrorBoundary pageName="Paramètres"><Parametres /></PageErrorBoundary>} />
              <Route path="/formations" element={<PageErrorBoundary pageName="Formations"><Formations /></PageErrorBoundary>} />
              <Route path="/formations/new" element={<PageErrorBoundary pageName="Nouvelle formation"><FormationCreate /></PageErrorBoundary>} />
              <Route path="/formations/:id" element={<PageErrorBoundary pageName="Détail formation"><FormationDetail /></PageErrorBoundary>} />
              <Route path="/formations/:id/edit" element={<PageErrorBoundary pageName="Édition formation"><FormationEdit /></PageErrorBoundary>} />
              {/* Needs summary across all trainings */}
              <Route path="/besoins" element={<PageErrorBoundary pageName="Besoins"><BesoinsParticipants /></PageErrorBoundary>} />
              {/* Evaluations dashboard */}
              <Route path="/evaluations" element={<PageErrorBoundary pageName="Évaluations"><Evaluations /></PageErrorBoundary>} />
              {/* Improvements tracking */}
              <Route path="/ameliorations" element={<PageErrorBoundary pageName="Améliorations"><Ameliorations /></PageErrorBoundary>} />
              {/* Content marketing board */}
              <Route path="/contenu" element={<PageErrorBoundary pageName="Contenu"><ContentBoard /></PageErrorBoundary>} />
              {/* Chatbot knowledge base admin */}
              <Route path="/chatbot-admin" element={<PageErrorBoundary pageName="Chatbot Admin"><ChatbotAdmin /></PageErrorBoundary>} />
              {/* Inbound emails */}
              <Route path="/emails" element={<PageErrorBoundary pageName="Emails"><InboundEmails /></PageErrorBoundary>} />
              {/* Statistics dashboard */}
              <Route path="/statistiques" element={<PageErrorBoundary pageName="Statistiques"><Statistiques /></PageErrorBoundary>} />
              {/* CRM Kanban */}
              <Route path="/crm" element={<PageErrorBoundary pageName="CRM"><Crm /></PageErrorBoundary>} />
              <Route path="/crm/reports" element={<PageErrorBoundary pageName="CRM Reports"><CrmReports /></PageErrorBoundary>} />
              {/* Missions Kanban */}
              <Route path="/missions" element={<PageErrorBoundary pageName="Missions"><Missions /></PageErrorBoundary>} />
              {/* OKR Management */}
              <Route path="/okr" element={<PageErrorBoundary pageName="OKR"><OKR /></PageErrorBoundary>} />
              {/* Media library */}
              <Route path="/medias" element={<PageErrorBoundary pageName="Médiathèque"><MediaLibrary /></PageErrorBoundary>} />
              {/* Events */}
              <Route path="/events" element={<PageErrorBoundary pageName="Événements"><Events /></PageErrorBoundary>} />
              <Route path="/events/new" element={<PageErrorBoundary pageName="Nouvel événement"><EventCreate /></PageErrorBoundary>} />
              <Route path="/events/:id" element={<PageErrorBoundary pageName="Détail événement"><EventDetail /></PageErrorBoundary>} />
              <Route path="/events/:id/edit" element={<PageErrorBoundary pageName="Édition événement"><EventEdit /></PageErrorBoundary>} />
              {/* Admin monitoring */}
              <Route path="/monitoring" element={<PageErrorBoundary pageName="Monitoring"><Monitoring /></PageErrorBoundary>} />
              {/* Training catalog */}
              <Route path="/catalogue" element={<PageErrorBoundary pageName="Catalogue"><Catalogue /></PageErrorBoundary>} />
              {/* Failed emails */}
              <Route path="/emails-erreur" element={<PageErrorBoundary pageName="Emails en erreur"><FailedEmails /></PageErrorBoundary>} />
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
              <Route path="/arena" element={<PageErrorBoundary pageName="Arena"><ArenaSetup /></PageErrorBoundary>} />
              <Route path="/arena/discussion" element={<PageErrorBoundary pageName="Arena Discussion"><ArenaDiscussion /></PageErrorBoundary>} />
              <Route path="/arena/results" element={<PageErrorBoundary pageName="Arena Résultats"><ArenaResults /></PageErrorBoundary>} />
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
