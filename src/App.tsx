import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ChatbotProvider } from "@/components/chatbot/ChatbotProvider";

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
const SignatureDevis = lazy(() => import("./pages/SignatureDevis"));
const ContentBoard = lazy(() => import("./pages/ContentBoard"));
const BesoinsParticipants = lazy(() => import("./pages/BesoinsParticipants"));
const TrainingSummary = lazy(() => import("./pages/TrainingSummary"));
const ChatbotAdmin = lazy(() => import("./pages/ChatbotAdmin"));
const InboundEmails = lazy(() => import("./pages/InboundEmails"));
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
            {/* Chatbot knowledge base admin */}
            <Route path="/chatbot-admin" element={<ChatbotAdmin />} />
            {/* Inbound emails */}
            <Route path="/emails" element={<InboundEmails />} />
            {/* Public needs survey */}
            <Route path="/questionnaire/:token" element={<Questionnaire />} />
            {/* Public evaluation form */}
            <Route path="/evaluation/:token" element={<Evaluation />} />
            {/* Public attendance signature */}
            <Route path="/emargement/:token" element={<Emargement />} />
            {/* Public devis signature */}
            <Route path="/signature-devis/:token" element={<SignatureDevis />} />
            {/* Public training summary for participants */}
            <Route path="/formation-info/:trainingId" element={<TrainingSummary />} />
            {/* Privacy policy */}
            <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/force-password-change" element={<ForcePasswordChange />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <ChatbotProvider />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
