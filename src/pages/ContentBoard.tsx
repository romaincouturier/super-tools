import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Newspaper, Eye, EyeOff } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import PageHeader from "@/components/PageHeader";
import ModuleLayout from "@/components/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import KanbanBoard from "@/components/content/KanbanBoard";
import ContentDashboard from "@/components/content/ContentDashboard";
import AiIdeasSearch from "@/components/content/AiIdeasSearch";
import NotificationBell from "@/components/content/NotificationBell";
import NewsletterSection from "@/components/content/NewsletterSection";
import { useAuth } from "@/hooks/useAuth";

const ContentBoard = () => {
  const { user, loading, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const openCardId = searchParams.get("card");
  const [filterReview, setFilterReview] = useState(false);
  const [showPublished, setShowPublished] = useState(false);
  const [newsletterRefreshKey, setNewsletterRefreshKey] = useState(0);

  const handleSelectCard = (cardId: string) => {
    setSearchParams({ card: cardId });
  };

  const handleCloseCard = () => {
    setSearchParams({});
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  return (
    <ModuleLayout>
      <main className="flex-1 max-w-full mx-auto p-6 overflow-hidden">
        <PageHeader
          icon={Newspaper}
          title="Gestion du contenu"
          subtitle="Tableau Kanban pour le marketing de contenu"
          actions={
            <>
              <Button
                variant={showPublished ? "default" : "outline"}
                size="sm"
                onClick={() => setShowPublished(!showPublished)}
                className="gap-2"
              >
                {showPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {showPublished ? "Tout affiché" : "Publiés masqués"}
              </Button>
              <Button
                variant={filterReview ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterReview(!filterReview)}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                En relecture
                {filterReview && <Badge variant="secondary" className="ml-1 bg-background/20">Actif</Badge>}
              </Button>
              <NotificationBell />
            </>
          }
        />

        <ContentDashboard />

        <NewsletterSection onCardClick={handleSelectCard} refreshKey={newsletterRefreshKey} />

        <div className="mb-6">
          <AiIdeasSearch onSelectCard={handleSelectCard} />
        </div>

        <KanbanBoard
          openCardId={openCardId}
          onCloseCard={handleCloseCard}
          filterReviewOnly={filterReview}
          showPublished={showPublished}
          onNewsletterChange={() => setNewsletterRefreshKey((k) => k + 1)}
        />
      </main>
    </ModuleLayout>
  );
};

export default ContentBoard;
