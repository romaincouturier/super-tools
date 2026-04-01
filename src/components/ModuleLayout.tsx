import { ReactNode, useState } from "react";
import { Menu, PanelLeft } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import AppSidebar from "@/components/AppSidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface ModuleLayoutProps {
  children: ReactNode;
  className?: string;
  /** Hide sidebar (e.g. on public pages) */
  hideSidebar?: boolean;
  /** Hide footer (e.g. full-height chat pages) */
  hideFooter?: boolean;
}

const SIDEBAR_STORAGE_KEY = "sidebar-collapsed";

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

const ModuleLayout = ({ children, className = "", hideSidebar, hideFooter }: ModuleLayoutProps) => {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleToggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch { /* noop */ }
      return next;
    });
  };

  return (
    <div className={`h-screen bg-background flex flex-col overflow-hidden ${className}`}>
      <AppHeader
        sidebarSlot={
          !hideSidebar ? (
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-background/10 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          ) : undefined
        }
      />

      {/* Mobile sidebar drawer */}
      {!hideSidebar && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-full p-0 sm:max-w-[280px]" hideCloseButton>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="h-full" onClick={() => setMobileOpen(false)}>
              <AppSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        {!hideSidebar && (
          <div className="hidden md:block">
            <AppSidebar collapsed={collapsed} onToggle={handleToggle} />
          </div>
        )}
        <div className="flex-1 flex flex-col overflow-y-auto relative">
          {/* Expand sidebar button when collapsed */}
          {!hideSidebar && collapsed && (
            <button
              onClick={handleToggle}
              className="hidden md:flex absolute top-2 left-2 z-10 p-1.5 rounded-md hover:bg-muted border bg-background transition-colors text-muted-foreground"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
          <main className="flex-1">{children}</main>
          {!hideFooter && <AppFooter />}
        </div>
      </div>
    </div>
  );
};

export default ModuleLayout;
