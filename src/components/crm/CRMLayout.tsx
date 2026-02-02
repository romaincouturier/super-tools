import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Kanban,
  Calendar,
  Mail,
  FileText,
  BarChart3,
  Settings,
  ChevronLeft,
  Menu,
  Target,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import SupertiltLogo from "@/components/SupertiltLogo";
import LanguageSelector from "@/components/LanguageSelector";

interface CRMLayoutProps {
  children: ReactNode;
}

const crmNavItems = [
  { href: "/crm", icon: LayoutDashboard, title: "Tableau de bord" },
  { href: "/crm/pipeline", icon: Kanban, title: "Pipeline" },
  { href: "/crm/leads", icon: Users, title: "Leads" },
  { href: "/crm/activities", icon: Calendar, title: "Activites" },
  { href: "/crm/emails", icon: Mail, title: "Emails" },
  { href: "/crm/quotes", icon: FileText, title: "Devis" },
  { href: "/crm/invoices", icon: Receipt, title: "Factures" },
  { href: "/crm/objectives", icon: Target, title: "Objectifs" },
  { href: "/crm/reports", icon: BarChart3, title: "Rapports" },
  { href: "/crm/settings", icon: Settings, title: "Parametres" },
];

const CRMLayout = ({ children }: CRMLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="space-y-1">
      {crmNavItems.map((item) => {
        const isActive = location.pathname === item.href ||
          (item.href !== "/crm" && location.pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            {/* Mobile menu button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" className="-ml-2">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <div className="p-4 border-b">
                  <div className="flex items-center gap-2">
                    <SupertiltLogo className="h-8" />
                    <span className="font-semibold">CRM</span>
                  </div>
                </div>
                <div className="p-4">
                  <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <Link
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Retour a SuperTools
                  </Link>
                </div>
              </SheetContent>
            </Sheet>

            <Link
              to="/"
              className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">SuperTools</span>
            </Link>
            <div className="hidden md:block h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <SupertiltLogo className="h-6 md:h-8" />
              <h1 className="text-lg md:text-xl font-semibold">CRM</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSelector className="hidden sm:flex" />
            <Button size="sm" onClick={() => navigate("/crm/leads/new")}>
              + Nouveau lead
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 md:py-6">
        <div className="flex gap-6">
          {/* Sidebar - desktop only */}
          <aside className="hidden md:block w-56 shrink-0">
            <div className="sticky top-20">
              <NavLinks />
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
};

export default CRMLayout;
