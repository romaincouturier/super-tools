import { useState } from "react";
import { UserPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import ReseauChat from "./ReseauChat";
import {
  useNetworkConversation,
  useSendNetworkMessage,
  useCreateContact,
  useNetworkContacts,
  usePositioning,
} from "@/hooks/useReseau";
import type { ExtractedContact } from "@/types/reseau";

const WARMTH_LABELS = { hot: "Chaud", warm: "Tiède", cold: "Froid" } as const;

interface ReseauCartographyProps {
  onComplete: () => void;
}

const ReseauCartography = ({ onComplete }: ReseauCartographyProps) => {
  const { toast } = useToast();
  const { data: messages = [] } = useNetworkConversation("cartography");
  const { data: contacts = [] } = useNetworkContacts();
  const { data: positioning } = usePositioning();
  const sendMessage = useSendNetworkMessage();
  const createContact = useCreateContact();
  const [pendingContacts, setPendingContacts] = useState<ExtractedContact[]>([]);
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());

  const handleSend = async (content: string) => {
    try {
      const result = await sendMessage.mutateAsync({
        content,
        phase: "cartography",
        positioning,
        contacts,
      });
      if (result.contacts && result.contacts.length > 0) {
        setPendingContacts((prev) => [...prev, ...result.contacts!]);
      }
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message.",
        variant: "destructive",
      });
    }
  };

  const handleAddContact = async (contact: ExtractedContact) => {
    try {
      await createContact.mutateAsync({
        name: contact.name,
        context: contact.context,
        warmth: contact.warmth,
      });
      setAddedNames((prev) => new Set([...prev, contact.name]));
      toast({ title: `${contact.name} ajouté !` });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter ce contact.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <ReseauChat
        messages={messages}
        welcomeMessage="Cartographions votre réseau ! Commençons par vos anciens collègues ou managers qui connaissent bien votre travail. Pouvez-vous me citer 2-3 personnes ?"
        placeholder="Citez des contacts, décrivez votre relation..."
        isLoading={sendMessage.isPending}
        onSend={handleSend}
      />

      {pendingContacts.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Contacts détectés
            </h3>
            {pendingContacts.map((contact, idx) => {
              const isAdded = addedNames.has(contact.name);
              return (
                <div
                  key={`${contact.name}-${idx}`}
                  className="flex items-center justify-between p-2 rounded border"
                >
                  <div>
                    <span className="text-sm font-medium">{contact.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {contact.context} · {WARMTH_LABELS[contact.warmth]}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={isAdded ? "ghost" : "outline"}
                    disabled={isAdded || createContact.isPending}
                    onClick={() => handleAddContact(contact)}
                  >
                    {isAdded ? (
                      <>
                        <Check className="h-3 w-3 mr-1" /> Ajouté
                      </>
                    ) : (
                      "Ajouter"
                    )}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={onComplete}>
          Terminer la cartographie
        </Button>
      </div>
    </div>
  );
};

export default ReseauCartography;
