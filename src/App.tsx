import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";

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
const Evaluations = lazy(() => import("./pages/Evaluations"));
const Ameliorations = lazy(() => import("./pages/Ameliorations"));
const PolitiqueConfidentialite = lazy(() => import("./pages/PolitiqueConfidentialite"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForcePasswordChange = lazy(() => import("./pages/ForcePasswordChange"));
const Emargement = lazy(() => import("./pages/Emargement"));
const ContentBoard = lazy(() => import("./pages/ContentBoard"));
const BesoinsParticipants = lazy(() => import("./pages/BesoinsParticipants"));
const TrainingSummary = lazy(() => import("./pages/TrainingSummary"));
const RgpdCleanup = lazy(() => import("./pages/RgpdCleanup"));
const SponsorFeedback = lazy(() => import("./pages/SponsorFeedback"));
const BilanPedagogique = lazy(() => import("./pages/BilanPedagogique"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
// CRM Module
const CRMDashboard = lazy(() => import("./pages/crm/CRMDashboard"));
const Pipeline = lazy(() => import("./pages/crm/Pipeline"));
const LeadsList = lazy(() => import("./pages/crm/LeadsList"));
const LeadDetail = lazy(() => import("./pages/crm/LeadDetail"));
const Activities = lazy(() => import("./pages/crm/Activities"));
const Quotes = lazy(() => import("./pages/crm/Quotes"));
const Invoices = lazy(() => import("./pages/crm/Invoices"));
const Objectives = lazy(() => import("./pages/crm/Objectives"));
// Qualiopi Module
const QualiopiDashboard = lazy(() => import("./pages/qualiopi/QualiopiDashboard"));
const QualiopiCriteria = lazy(() => import("./pages/qualiopi/QualiopiCriteria"));
const QualiopiIndicators = lazy(() => import("./pages/qualiopi/QualiopiIndicators"));
const QualiopiEvidence = lazy(() => import("./pages/qualiopi/QualiopiEvidence"));
// Admin Module
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const UsersManagement = lazy(() => import("./pages/admin/UsersManagement"));
const TrainersManagement = lazy(() => import("./pages/admin/TrainersManagement"));
const EmailTemplatesManagement = lazy(() => import("./pages/admin/EmailTemplatesManagement"));
const SubscriptionManagement = lazy(() => import("./pages/admin/SubscriptionManagement"));
const OrganizationSettings = lazy(() => import("./pages/admin/OrganizationSettings"));
const IntegrationsManagement = lazy(() => import("./pages/admin/IntegrationsManagement"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
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
            {/* Public needs survey */}
            <Route path="/questionnaire/:token" element={<Questionnaire />} />
            {/* Public evaluation form */}
            <Route path="/evaluation/:token" element={<Evaluation />} />
            {/* Public attendance signature */}
            <Route path="/emargement/:token" element={<Emargement />} />
            {/* Public training summary for participants */}
            <Route path="/formation-info/:trainingId" element={<TrainingSummary />} />
            {/* Privacy policy */}
            <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
            {/* RGPD data cleanup */}
            <Route path="/rgpd" element={<RgpdCleanup />} />
            {/* Public sponsor feedback form */}
            <Route path="/sponsor-feedback/:trainingId" element={<SponsorFeedback />} />
            {/* Bilan Pedagogique et Financier */}
            <Route path="/bpf" element={<BilanPedagogique />} />
            {/* Onboarding for new users */}
            <Route path="/onboarding" element={<Onboarding />} />
            {/* CRM Module */}
            <Route path="/crm" element={<CRMDashboard />} />
            <Route path="/crm/pipeline" element={<Pipeline />} />
            <Route path="/crm/leads" element={<LeadsList />} />
            <Route path="/crm/leads/:id" element={<LeadDetail />} />
            <Route path="/crm/activities" element={<Activities />} />
            <Route path="/crm/quotes" element={<Quotes />} />
            <Route path="/crm/invoices" element={<Invoices />} />
            <Route path="/crm/objectives" element={<Objectives />} />
            {/* Qualiopi Module */}
            <Route path="/qualiopi" element={<QualiopiDashboard />} />
            <Route path="/qualiopi/criteria" element={<QualiopiCriteria />} />
            <Route path="/qualiopi/indicators" element={<QualiopiIndicators />} />
            <Route path="/qualiopi/evidence" element={<QualiopiEvidence />} />
            {/* Admin Panel */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/organization" element={<OrganizationSettings />} />
            <Route path="/admin/users" element={<UsersManagement />} />
            <Route path="/admin/trainers" element={<TrainersManagement />} />
            <Route path="/admin/email-templates" element={<EmailTemplatesManagement />} />
            <Route path="/admin/integrations" element={<IntegrationsManagement />} />
            <Route path="/admin/subscription" element={<SubscriptionManagement />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/force-password-change" element={<ForcePasswordChange />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
