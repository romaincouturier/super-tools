import { ReactNode, useState } from "react";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import AppSidebar from "@/components/AppSidebar";

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
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        {!hideSidebar && (
          <div className="hidden md:block">
            <AppSidebar collapsed={collapsed} onToggle={handleToggle} />
          </div>
        )}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <main className="flex-1">{children}</main>
          {!hideFooter && <AppFooter />}
        </div>
      </div>
    </div>
  );
};

export default ModuleLayout;
