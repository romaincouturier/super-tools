import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";
import { ChatbotProvider } from "@/components/chatbot/ChatbotProvider";
import { PageViewTracker } from "@/components/PageViewTracker";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import AgentCommandDialog from "@/components/AgentCommandDialog";
import { RequireStaff } from "@/components/RequireStaff";
import "@/i18n";
import { registerToast } from "@/lib/offlineMutationGuard";
import { toast } from "@/hooks/use-toast";

// Wire toast into offlineGuard (avoids lib → hooks circular dependency)
registerToast(toast);
import OfflineBanner from "@/components/OfflineBanner";

// Lazy load all pages with retry for chunk-load resilience
const CertificateGenerator = lazy(() => import("./pages/CertificateGenerator"));
const MicroDevis = lazy(() => import("./pages/MicroDevis"));
const Historique = lazy(() => import("./pages/Historique"));
const Parametres = lazy(() => import("./pages/Parametres"));
const Formations = lazy(() => import("./pages/Formations"));
const BPFReport = lazy(() => import("./pages/BPFReport"));
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
const SignatureLocation = lazy(() => import("./pages/SignatureLocation"));
const ContentBoard = lazy(() => import("./pages/ContentBoard"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const BesoinsParticipants = lazy(() => import("./pages/BesoinsParticipants"));
const TrainingSummary = lazy(() => import("./pages/TrainingSummary"));
const TrainingSupportPage = lazy(() => import("./pages/TrainingSupportPage"));
const ChatbotAdmin = lazy(() => import("./pages/ChatbotAdmin"));
const InboundEmails = lazy(() => import("./pages/InboundEmails"));
const EmailsAValider = lazy(() => import("./pages/EmailsAValider"));
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
const LearnerOnboarding = lazy(() => import("./pages/LearnerOnboarding"));
const LearnerResetPassword = lazy(() => import("./pages/LearnerResetPassword"));
const AiTools = lazy(() => import("./pages/AiTools"));
const LmsCourses = lazy(() => import("./pages/LmsCourses"));
const LmsCourseBuilder = lazy(() => import("./pages/LmsCourseBuilder"));
const LmsCourseEntry = lazy(() => import("./pages/LmsCourseEntry"));
const LmsMessages = lazy(() => import("./pages/LmsMessages"));
const LmsCoursePlayer = lazy(() => import("./pages/LmsCoursePlayer"));
const LmsCourseHomePage = lazy(() => import("./pages/LmsCourseHomePage"));
const LmsDeposits = lazy(() => import("./pages/LmsDeposits"));
const LmsLearners = lazy(() => import("./pages/LmsLearners"));
const LmsFaq = lazy(() => import("./pages/LmsFaq"));
const LessonBuilderPage = lazy(() => import("./pages/LessonBuilderPage"));
const Reseau = lazy(() => import("./pages/Reseau"));
const Watch = lazy(() => import("./pages/Watch"));
const AgentChat = lazy(() => import("./pages/AgentChat"));
const SuperTilt = lazy(() => import("./pages/SuperTilt"));
const WebAnalytics = lazy(() => import("./pages/WebAnalytics"));
const Finances = lazy(() => import("./pages/Finances"));
const AdminArchives = lazy(() => import("./pages/AdminArchives"));
const Transcripts = lazy(() => import("./pages/Transcripts"));
const Temoignages = lazy(() => import("./pages/Temoignages"));
const Dropshipping = lazy(() => import("./pages/Dropshipping"));
const PictoDico = lazy(() => import("./pages/PictoDico"));
const TimeTracker = lazy(() => import("./pages/TimeTracker"));
const SupertiltOrders = lazy(() => import("./pages/SupertiltOrders"));
const WoocommerceInbox = lazy(() => import("./pages/WoocommerceInbox"));
const PartnerPortal = lazy(() => import("./pages/PartnerPortal"));
const GoogleDriveCallback = lazy(() => import("./pages/GoogleDriveCallback"));

// In-memory query client only — no IndexedDB persistence.
// Persisting the cache caused stale UIs ("vieille interface") on returning visits.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Spinner size="lg" className="text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
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
              {/* Public routes — no auth required */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/force-password-change" element={<ForcePasswordChange />} />
              <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
              {/* Learner portal */}
              <Route path="/apprenant" element={<LearnerAccess />} />
              <Route path="/apprenant/connexion" element={<LearnerOnboarding />} />
              <Route path="/apprenant/reset-password" element={<LearnerResetPassword />} />
              <Route path="/espace-apprenant" element={<Navigate to="/espace-apprenant/tableau-de-bord" replace />} />
              <Route path="/espace-apprenant/:section" element={<LearnerPortal />} />
              {/* LMS course player — accessible by learners and staff */}
              <Route path="/lms/:courseId/player" element={<LmsCoursePlayer />} />
              <Route path="/lms/:courseId/home" element={<LmsCourseHomePage />} />
              {/* Public token-based forms */}
              <Route path="/questionnaire/:token" element={<Questionnaire />} />
              <Route path="/evaluation/:token" element={<Evaluation />} />
              <Route path="/evaluation-commanditaire/:token" element={<SponsorEvaluation />} />
              <Route path="/evaluation-formateur/:token" element={<TrainerEvaluation />} />
              <Route path="/formulaire/besoins" element={<FormulaireRedirect />} />
              <Route path="/formulaire/evaluation" element={<FormulaireRedirect />} />
              <Route path="/emargement/:token" element={<Emargement />} />
              <Route path="/signature-devis/:token" element={<SignatureDevis />} />
              <Route path="/signature-convention/:token" element={<SignatureConvention />} />
              <Route path="/signature-location/:token" element={<SignatureLocation />} />
              <Route path="/reclamation/:token" element={<ReclamationPublic />} />
              <Route path="/partenaire/:token" element={<PartnerPortal />} />
              {/* Public participant pages */}
              <Route path="/formation-info/:trainingId" element={<TrainingSummary />} />
              <Route path="/formation-support/:trainingId" element={<TrainingSupportPage />} />
              <Route path="/formation-support/:trainingId/lms/:courseId" element={<LmsCoursePlayer />} />
              <Route path="/mission-info/:missionId" element={<MissionSummary />} />
              {/* OAuth callbacks */}
              <Route path="/google-drive/callback" element={<GoogleDriveCallback />} />

              {/* Back-office routes — staff only, learners redirected to /espace-apprenant */}
              <Route element={<RequireStaff />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/agent" element={<AgentChat />} />
                <Route path="/certificates" element={<CertificateGenerator />} />
                <Route path="/micro-devis" element={<MicroDevis />} />
                <Route path="/historique" element={<Historique />} />
                <Route path="/parametres" element={<Parametres />} />
                <Route path="/formations" element={<Formations />} />
                <Route path="/formations/new" element={<FormationCreate />} />
                <Route path="/formations/bpf" element={<BPFReport />} />
                <Route path="/formations/:id" element={<FormationDetail />} />
                <Route path="/formations/:id/edit" element={<FormationEdit />} />
                <Route path="/besoins" element={<BesoinsParticipants />} />
                <Route path="/evaluations" element={<Evaluations />} />
                <Route path="/ameliorations" element={<Ameliorations />} />
                <Route path="/contenu" element={<ContentBoard />} />
                <Route path="/chatbot-admin" element={<ChatbotAdmin />} />
                <Route path="/emails" element={<InboundEmails />} />
                <Route path="/emails-a-valider" element={<EmailsAValider />} />
                <Route path="/emails-erreur" element={<FailedEmails />} />
                <Route path="/web-analytics" element={<WebAnalytics />} />
                <Route path="/crm" element={<Crm />} />
                <Route path="/crm/card/:cardId" element={<Crm />} />
                <Route path="/crm/reports" element={<CrmReports />} />
                <Route path="/missions" element={<Missions />} />
                <Route path="/missions/:missionId" element={<Missions />} />
                <Route path="/okr" element={<OKR />} />
                <Route path="/medias" element={<MediaLibrary />} />
                <Route path="/events" element={<Events />} />
                <Route path="/events/new" element={<EventCreate />} />
                <Route path="/events/:id" element={<EventDetail />} />
                <Route path="/events/:id/edit" element={<EventEdit />} />
                <Route path="/monitoring" element={<Monitoring />} />
                <Route path="/screenshots" element={<Screenshots />} />
                <Route path="/catalogue" element={<Catalogue />} />
                <Route path="/ia" element={<AiTools />} />
                <Route path="/lms" element={<LmsCourses />} />
                <Route path="/lms/deposits" element={<LmsDeposits />} />
                <Route path="/lms/apprenants" element={<LmsLearners />} />
                <Route path="/lms/messages" element={<LmsMessages />} />
                <Route path="/lms/faq" element={<LmsFaq />} />
                <Route path="/lms/:courseId" element={<LmsCourseEntry />} />
                <Route path="/lms/:courseId/edit" element={<LmsCourseBuilder />} />
                <Route path="/lms/:courseId/lesson/:lessonId/builder" element={<LessonBuilderPage />} />
                <Route path="/arena" element={<ArenaSetup />} />
                <Route path="/arena/discussion" element={<ArenaDiscussion />} />
                <Route path="/arena/results" element={<ArenaResults />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/reclamations" element={<Reclamations />} />
                <Route path="/devis/:cardId" element={<QuoteWorkflowPage />} />
                <Route path="/support" element={<Support />} />
                <Route path="/reseau" element={<Reseau />} />
                <Route path="/veille" element={<Watch />} />
                <Route path="/supertilt" element={<SuperTilt />} />
                <Route path="/finances" element={<Finances />} />
                <Route path="/archives" element={<AdminArchives />} />
                <Route path="/transcripts" element={<Transcripts />} />
                <Route path="/temoignages" element={<Temoignages />} />
                <Route path="/dropshipping" element={<Navigate to="/commandes-jeux" replace />} />
                <Route path="/commandes-jeux" element={<SupertiltOrders />} />
                <Route path="/commandes/inbox" element={<WoocommerceInbox />} />
                <Route path="/pictodico" element={<PictoDico />} />
                <Route path="/time-tracker" element={<TimeTracker />} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </RouteErrorBoundary>
        </Suspense>
        <ChatbotProvider />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
