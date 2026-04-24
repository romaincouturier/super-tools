import { Spinner } from "@/components/ui/spinner";

const PageLoading = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Spinner size="lg" className="text-primary" />
    </div>
  );
};

export default PageLoading;
