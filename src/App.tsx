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
import FormationDetail from "./pages/FormationDetail";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ForcePasswordChange from "./pages/ForcePasswordChange";
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
