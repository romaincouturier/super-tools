import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CertificateGenerator from "./pages/CertificateGenerator";
import MicroDevis from "./pages/MicroDevis";
import Historique from "./pages/Historique";
import Formations from "./pages/Formations";
import FormationCreate from "./pages/FormationCreate";
import FormationEdit from "./pages/FormationEdit";
import FormationDetail from "./pages/FormationDetail";
import Questionnaire from "./pages/Questionnaire";
import Evaluation from "./pages/Evaluation";
import Evaluations from "./pages/Evaluations";
import Ameliorations from "./pages/Ameliorations";
import PolitiqueConfidentialite from "./pages/PolitiqueConfidentialite";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ForcePasswordChange from "./pages/ForcePasswordChange";
import Emargement from "./pages/Emargement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/certificates" element={<CertificateGenerator />} />
          <Route path="/micro-devis" element={<MicroDevis />} />
          <Route path="/historique" element={<Historique />} />
          <Route path="/formations" element={<Formations />} />
          <Route path="/formations/new" element={<FormationCreate />} />
          <Route path="/formations/:id" element={<FormationDetail />} />
          <Route path="/formations/:id/edit" element={<FormationEdit />} />
          {/* Evaluations dashboard */}
          <Route path="/evaluations" element={<Evaluations />} />
          {/* Improvements tracking */}
          <Route path="/ameliorations" element={<Ameliorations />} />
          {/* Public needs survey */}
          <Route path="/questionnaire/:token" element={<Questionnaire />} />
          {/* Public evaluation form */}
          <Route path="/evaluation/:token" element={<Evaluation />} />
          {/* Public attendance signature */}
          <Route path="/emargement/:token" element={<Emargement />} />
          {/* Privacy policy */}
          <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/force-password-change" element={<ForcePasswordChange />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
