import { Suspense } from "react";
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
import "@/i18n";
import { createIDBPersister } from "@/lib/queryPersister";
import OfflineBanner from "@/components/OfflineBanner";

// Lazy load all pages with retry for chunk-load resilience
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const CertificateGenerator = lazyWithRetry(() => import("./pages/CertificateGenerator"));
const MicroDevis = lazyWithRetry(() => import("./pages/MicroDevis"));
const Historique = lazyWithRetry(() => import("./pages/Historique"));
const Parametres = lazyWithRetry(() => import("./pages/Parametres"));
const Formations = lazyWithRetry(() => import("./pages/Formations"));
const FormationCreate = lazyWithRetry(() => import("./pages/FormationCreate"));
const FormationEdit = lazyWithRetry(() => import("./pages/FormationEdit"));
const FormationDetail = lazyWithRetry(() => import("./pages/FormationDetail"));
const Questionnaire = lazyWithRetry(() => import("./pages/Questionnaire"));
const Evaluation = lazyWithRetry(() => import("./pages/Evaluation"));
const SponsorEvaluation = lazyWithRetry(() => import("./pages/SponsorEvaluation"));
const Evaluations = lazyWithRetry(() => import("./pages/Evaluations"));
const FormulaireRedirect = lazyWithRetry(() => import("./pages/FormulaireRedirect"));
const Ameliorations = lazyWithRetry(() => import("./pages/Ameliorations"));
const PolitiqueConfidentialite = lazyWithRetry(() => import("./pages/PolitiqueConfidentialite"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const ForcePasswordChange = lazyWithRetry(() => import("./pages/ForcePasswordChange"));
const Emargement = lazyWithRetry(() => import("./pages/Emargement"));
const SignatureDevis = lazyWithRetry(() => import("./pages/SignatureDevis"));
const SignatureConvention = lazyWithRetry(() => import("./pages/SignatureConvention"));
const ContentBoard = lazyWithRetry(() => import("./pages/ContentBoard"));
const BesoinsParticipants = lazyWithRetry(() => import("./pages/BesoinsParticipants"));
const TrainingSummary = lazyWithRetry(() => import("./pages/TrainingSummary"));
const ChatbotAdmin = lazyWithRetry(() => import("./pages/ChatbotAdmin"));
const InboundEmails = lazyWithRetry(() => import("./pages/InboundEmails"));
const Statistiques = lazyWithRetry(() => import("./pages/Statistiques"));
const Crm = lazyWithRetry(() => import("./pages/Crm"));
const CrmReports = lazyWithRetry(() => import("./pages/CrmReports"));
const Missions = lazyWithRetry(() => import("./pages/Missions"));
const MissionSummary = lazyWithRetry(() => import("./pages/MissionSummary"));
const OKR = lazyWithRetry(() => import("./pages/OKR"));
const MediaLibrary = lazyWithRetry(() => import("./pages/MediaLibrary"));
const Events = lazyWithRetry(() => import("./pages/Events"));
const EventCreate = lazyWithRetry(() => import("./pages/EventCreate"));
const EventDetail = lazyWithRetry(() => import("./pages/EventDetail"));
const EventEdit = lazyWithRetry(() => import("./pages/EventEdit"));
const Monitoring = lazyWithRetry(() => import("./pages/Monitoring"));
const FailedEmails = lazyWithRetry(() => import("./pages/FailedEmails"));
const ArenaSetup = lazyWithRetry(() => import("./pages/ArenaSetup"));
const ArenaDiscussion = lazyWithRetry(() => import("./pages/ArenaDiscussion"));
const ArenaResults = lazyWithRetry(() => import("./pages/ArenaResults"));
const Catalogue = lazyWithRetry(() => import("./pages/Catalogue"));
const ReclamationPublic = lazyWithRetry(() => import("./pages/ReclamationPublic"));
const TrainerEvaluation = lazyWithRetry(() => import("./pages/TrainerEvaluation"));
const Reclamations = lazyWithRetry(() => import("./pages/Reclamations"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const Landing = lazyWithRetry(() => import("./pages/Landing"));
const Signup = lazyWithRetry(() => import("./pages/Signup"));
const Onboarding = lazyWithRetry(() => import("./pages/Onboarding"));
const LearnerAccess = lazyWithRetry(() => import("./pages/LearnerAccess"));
const LearnerPortal = lazyWithRetry(() => import("./pages/LearnerPortal"));
const AiTools = lazyWithRetry(() => import("./pages/AiTools"));
const LmsCourses = lazyWithRetry(() => import("./pages/LmsCourses"));
const LmsCourseBuilder = lazyWithRetry(() => import("./pages/LmsCourseBuilder"));
const LmsCoursePlayer = lazyWithRetry(() => import("./pages/LmsCoursePlayer"));

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
              <Route path="/" element={<Landing />} />
              <Route path="/dashboard" element={<Dashboard />} />
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
