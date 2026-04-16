import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";
import { ChatbotProvider } from "@/components/chatbot/ChatbotProvider";
import { PageViewTracker } from "@/components/PageViewTracker";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import AgentCommandDialog from "@/components/AgentCommandDialog";
import "@/i18n";
import { registerToast } from "@/lib/offlineMutationGuard";
import { toast } from "@/hooks/use-toast";

// Wire toast into offlineGuard (avoids lib → hooks circular dependency)
registerToast(toast);
import { createIDBPersister } from "@/lib/queryPersister";
import OfflineBanner from "@/components/OfflineBanner";

// Lazy load all pages with retry for chunk-load resilience
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
const FormulaireRedirect = lazy(() => import("./pages/FormulaireRedirect"));
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
const TrainingSupportPage = lazy(() => import("./pages/TrainingSupportPage"));
const ChatbotAdmin = lazy(() => import("./pages/ChatbotAdmin"));
const InboundEmails = lazy(() => import("./pages/InboundEmails"));
const EmailsAValider = lazy(() => import("./pages/EmailsAValider"));
const Statistiques = lazy(() => import("./pages/Statistiques"));
const Crm = lazy(() => import("./pages/Crm"));
const CrmReports = lazy(() => import("./pages/CrmReports"));
const Missions = lazy(() => import("./pages/Missions"));
const MissionSummary = lazy(() => import("./pages/MissionSummary"));
const OKR = lazy(() => import("./pages/OKR"));
const MediaLibrary = lazy(() => import("./pages/MediaLibrary"));
const Events = lazy(() => import("./pages/Events"));
const EventCreate = lazy(() => import("./pages/EventCreate"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const EventEdit = lazy(() => import("./pages/EventEdit"));
const Monitoring = lazy(() => import("./pages/Monitoring"));
const Screenshots = lazy(() => import("./pages/Screenshots"));
const FailedEmails = lazy(() => import("./pages/FailedEmails"));
const ArenaSetup = lazy(() => import("./pages/ArenaSetup"));
const ArenaDiscussion = lazy(() => import("./pages/ArenaDiscussion"));
const ArenaResults = lazy(() => import("./pages/ArenaResults"));
const Catalogue = lazy(() => import("./pages/Catalogue"));
const ReclamationPublic = lazy(() => import("./pages/ReclamationPublic"));
const TrainerEvaluation = lazy(() => import("./pages/TrainerEvaluation"));
const Reclamations = lazy(() => import("./pages/Reclamations"));
const Support = lazy(() => import("./pages/Support"));
const QuoteWorkflowPage = lazy(() => import("./pages/QuoteWorkflow"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Admin = lazy(() => import("./pages/Admin"));
const Landing = lazy(() => import("./pages/Landing"));
const Signup = lazy(() => import("./pages/Signup"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const LearnerAccess = lazy(() => import("./pages/LearnerAccess"));
const LearnerPortal = lazy(() => import("./pages/LearnerPortal"));
const AiTools = lazy(() => import("./pages/AiTools"));
const LmsCourses = lazy(() => import("./pages/LmsCourses"));
const LmsCourseBuilder = lazy(() => import("./pages/LmsCourseBuilder"));
const LmsCoursePlayer = lazy(() => import("./pages/LmsCoursePlayer"));
const Reseau = lazy(() => import("./pages/Reseau"));
const Watch = lazy(() => import("./pages/Watch"));
const AgentChat = lazy(() => import("./pages/AgentChat"));
const SuperTilt = lazy(() => import("./pages/SuperTilt"));
const WebAnalytics = lazy(() => import("./pages/WebAnalytics"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours — kept longer for offline support
      refetchOnWindowFocus: false,
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
    <Spinner size="lg" className="text-primary" />
  </div>
);

const App = () => (
  <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineBanner />
      <BrowserRouter>
        <PageViewTracker />
        <AgentCommandDialog />
        <Suspense fallback={<PageLoader />}>
          <RouteErrorBoundary>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<Navigate to="/agent" replace />} />
              <Route path="/agent" element={<AgentChat />} />
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
              <Route path="/emails-a-valider" element={<EmailsAValider />} />
              {/* Statistics dashboard */}
              <Route path="/statistiques" element={<Statistiques />} />
              {/* Web analytics (WP-Statistics) */}
              <Route path="/web-analytics" element={<WebAnalytics />} />
              {/* CRM Kanban */}
              <Route path="/crm" element={<Crm />} />
              <Route path="/crm/card/:cardId" element={<Crm />} />
              <Route path="/crm/reports" element={<CrmReports />} />
              {/* Missions Kanban */}
              <Route path="/missions" element={<Missions />} />
              <Route path="/missions/:missionId" element={<Missions />} />
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
              <Route path="/screenshots" element={<Screenshots />} />
              {/* Training catalog */}
              <Route path="/catalogue" element={<Catalogue />} />
              {/* AI Tools (M4) */}
              <Route path="/ia" element={<AiTools />} />
              {/* LMS (M7) */}
              <Route path="/lms" element={<LmsCourses />} />
              <Route path="/lms/:courseId" element={<LmsCourseBuilder />} />
              <Route path="/lms/:courseId/player" element={<LmsCoursePlayer />} />
              {/* Failed emails */}
              <Route path="/emails-erreur" element={<FailedEmails />} />
              {/* Public needs survey */}
              <Route path="/questionnaire/:token" element={<Questionnaire />} />
              {/* Public evaluation form */}
              <Route path="/evaluation/:token" element={<Evaluation />} />
              {/* Public e-learning redirects (resolve participant by email + WooCommerce product ID) */}
              <Route path="/formulaire/besoins" element={<FormulaireRedirect />} />
              <Route path="/formulaire/evaluation" element={<FormulaireRedirect />} />
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
              <Route path="/formation-support/:trainingId" element={<TrainingSupportPage />} />
              <Route path="/mission-info/:missionId" element={<MissionSummary />} />
              {/* Privacy policy */}
              <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/onboarding" element={<Onboarding />} />
              {/* Learner portal (M3) */}
              <Route path="/apprenant" element={<LearnerAccess />} />
              <Route path="/espace-apprenant" element={<LearnerPortal />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/force-password-change" element={<ForcePasswordChange />} />
              {/* AI Arena */}
              <Route path="/arena" element={<ArenaSetup />} />
              <Route path="/arena/discussion" element={<ArenaDiscussion />} />
              <Route path="/arena/results" element={<ArenaResults />} />
              {/* Super Admin */}
              <Route path="/admin" element={<Admin />} />
              {/* Reclamations */}
              <Route path="/reclamation/:token" element={<ReclamationPublic />} />
              <Route path="/reclamations" element={<Reclamations />} />
              {/* Trainer evaluation public form */}
              <Route path="/evaluation-formateur/:token" element={<TrainerEvaluation />} />
              {/* Quote workflow */}
              <Route path="/devis/:cardId" element={<QuoteWorkflowPage />} />
              {/* Support tickets Kanban */}
              <Route path="/support" element={<Support />} />
              {/* Network module */}
              <Route path="/reseau" element={<Reseau />} />
              {/* Watch module (veille) */}
              <Route path="/veille" element={<Watch />} />
              {/* SuperTilt (plan d'action) */}
              <Route path="/supertilt" element={<SuperTilt />} />
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
