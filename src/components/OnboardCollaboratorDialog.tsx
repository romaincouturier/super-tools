import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus } from "lucide-react";
import { AppModule, MODULE_LABELS } from "@/hooks/useModuleAccess";

interface OnboardCollaboratorDialogProps {
  userEmail?: string;
}

const ALL_MODULES: AppModule[] = [
  "micro_devis",
  "formations",
  "evaluations",
  "certificates",
  "ameliorations",
  "historique",
  "contenu",
];

const OnboardCollaboratorDialog = ({ userEmail }: OnboardCollaboratorDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedModules, setSelectedModules] = useState<AppModule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Only romain@supertilt.fr can see and use this
  if (userEmail?.toLowerCase() !== "romain@supertilt.fr") {
    return null;
  }

  const handleModuleToggle = (module: AppModule, checked: boolean) => {
    if (checked) {
      setSelectedModules((prev) => [...prev, module]);
    } else {
      setSelectedModules((prev) => prev.filter((m) => m !== module));
    }
  };

  const handleSelectAll = () => {
    if (selectedModules.length === ALL_MODULES.length) {
      setSelectedModules([]);
    } else {
      setSelectedModules([...ALL_MODULES]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedModules.length === 0) {
      toast({
        title: "Attention",
        description: "Veuillez sélectionner au moins un module",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("onboard-collaborator", {
        body: { email, firstName, lastName, modules: selectedModules },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Collaborateur ajouté",
        description: data.message,
      });

      setEmail("");
      setFirstName("");
      setLastName("");
      setSelectedModules([]);
      setIsOpen(false);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="gap-2">
          <UserPlus className="w-4 h-4" />
          Ajouter un collaborateur
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un collaborateur</DialogTitle>
          <DialogDescription>
            Un email sera envoyé au collaborateur avec ses identifiants de connexion temporaires.
            Il devra changer son mot de passe à la première connexion.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="collaboratorFirstName">Prénom</Label>
                <Input
                  id="collaboratorFirstName"
                  type="text"
                  placeholder="Jean"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collaboratorLastName">Nom</Label>
                <Input
                  id="collaboratorLastName"
                  type="text"
                  placeholder="Dupont"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="collaboratorEmail">Email du collaborateur</Label>
              <Input
                id="collaboratorEmail"
                type="email"
                placeholder="collaborateur@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Modules accessibles</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs h-7"
                >
                  {selectedModules.length === ALL_MODULES.length
                    ? "Tout désélectionner"
                    : "Tout sélectionner"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ALL_MODULES.map((module) => (
                  <div
                    key={module}
                    className="flex items-center space-x-2 p-2 rounded border hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`module-${module}`}
                      checked={selectedModules.includes(module)}
                      onCheckedChange={(checked) =>
                        handleModuleToggle(module, checked as boolean)
                      }
                    />
                    <Label
                      htmlFor={`module-${module}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {MODULE_LABELS[module]}
                    </Label>
                  </div>
                ))}
              </div>
              {selectedModules.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Sélectionnez au moins un module
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading || selectedModules.length === 0}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Envoyer l'invitation"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardCollaboratorDialog;
