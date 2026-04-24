import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface PageNotFoundProps {
  message?: string;
  backTo: string;
  backLabel?: string;
}

const PageNotFound = ({ message = "Élément introuvable.", backTo, backLabel = "Retour" }: PageNotFoundProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-2xl mx-auto p-6 text-center text-muted-foreground">
        <p>{message}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(backTo)}>
          {backLabel}
        </Button>
      </div>
    </div>
  );
};

export default PageNotFound;
