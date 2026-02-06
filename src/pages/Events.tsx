import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, CalendarHeart } from "lucide-react";
import { Card } from "@/components/ui/card";

const Events = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">Événements</h1>
        <Card className="p-8 text-center text-muted-foreground">
          <CalendarHeart className="w-12 h-12 mx-auto mb-4 text-primary/40" />
          <p className="text-lg font-medium">Module Événements</p>
          <p className="text-sm mt-2">
            La gestion des événements sera bientôt disponible ici.
          </p>
        </Card>
      </main>
    </div>
  );
};

export default Events;
