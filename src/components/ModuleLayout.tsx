import { ReactNode } from "react";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

interface ModuleLayoutProps {
  children: ReactNode;
  className?: string;
}

const ModuleLayout = ({ children, className = "" }: ModuleLayoutProps) => {
  return (
    <div className={`min-h-screen bg-background flex flex-col ${className}`}>
      <AppHeader />
      <main className="flex-1">{children}</main>
      <AppFooter />
    </div>
  );
};

export default ModuleLayout;
