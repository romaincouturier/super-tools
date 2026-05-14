import { ReactNode } from "react";

interface ModuleContentProps {
  children: ReactNode;
  className?: string;
}

/**
 * Standard content wrapper for authenticated module pages.
 * Provides consistent padding and max-width inside ModuleLayout.
 * Usage: <ModuleLayout><ModuleContent>...</ModuleContent></ModuleLayout>
 */
const ModuleContent = ({ children, className = "" }: ModuleContentProps) => (
  <div className={`max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6 ${className}`}>
    {children}
  </div>
);

export default ModuleContent;
