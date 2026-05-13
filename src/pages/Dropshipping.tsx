import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

export default function Dropshipping() {
  return (
    <ModuleLayout>
      <PageHeader title="Dropshipping" />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <ShoppingCart className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-medium">Module en cours de développement</p>
            <p className="text-sm text-muted-foreground mt-1">
              Suivi des ventes de jeux par produit, gestion des auteurs et calcul des royalties à partir des commandes WooCommerce.
            </p>
          </div>
        </CardContent>
      </Card>
    </ModuleLayout>
  );
}
