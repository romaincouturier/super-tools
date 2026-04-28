import { ReactNode, useState } from "react";
import { Menu } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import AppTopBar from "@/components/AppTopBar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface ModuleLayoutProps {
  children: ReactNode;
  className?: string;
  /** Main content fills full height without scroll (child manages its own scroll, e.g. chat). */
  fitHeight?: boolean;
  /** Hide the in-page top bar (e.g. full-immersion pages). */
  hideTopBar?: boolean;
}

const ModuleLayout = ({ children, className = "", fitHeight, hideTopBar }: ModuleLayoutProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const mobileSlot = (
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      aria-label="Ouvrir la navigation"
      className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-black/5 transition-colors"
    >
      <Menu className="w-5 h-5" />
    </button>
  );

  return (
    <div className={`fixed inset-0 bg-background flex overflow-hidden ${className}`}>
      {/* Desktop sidebar */}
      <div className="hidden md:block h-full">
        <AppSidebar />
      </div>

      {/* Mobile sidebar drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-full p-0 sm:max-w-[260px]" hideCloseButton>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="h-full">
            <AppSidebar asDrawer onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className={`flex-1 flex flex-col ${fitHeight ? "overflow-hidden" : "overflow-hidden"} min-w-0`}>
        {!hideTopBar && <AppTopBar mobileSlot={mobileSlot} />}
        <main className={`flex-1 ${fitHeight ? "overflow-hidden min-h-0" : "overflow-y-auto"}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default ModuleLayout;
