import { Loader2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";

interface PageLoadingProps {
  showHeader?: boolean;
}

const PageLoading = ({ showHeader = true }: PageLoadingProps) => {
  return (
    <div className="min-h-screen bg-background">
      {showHeader && <AppHeader />}
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    </div>
  );
};

export default PageLoading;
