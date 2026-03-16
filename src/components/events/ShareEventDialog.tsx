import { useState, useEffect } from "react";
import { Send, Share2, Loader2, Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Event } from "@/types/events";

interface Profile {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
}

interface ShareEventDialogProps {
  event: Event;
}

const ShareEventDialog = ({ event }: ShareEventDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchCurrentUser();
      fetchProfiles();
    }
  }, [open]);

  const fetchCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setCurrentUserId(session?.user?.id || null);
  };

  const fetchProfiles = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const currentId = session?.user?.id;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, email, first_name, last_name, display_name")
      .order("first_name");

    if (!error && data) {
      // Exclude current user
      setProfiles(data.filter((p) => p.user_id !== currentId));
    }
  };

  const getDisplayName = (profile: Profile) => {
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    if (profile.display_name) {
      return profile.display_name;
    }
    return profile.email;
  };

  const handleShare = async () => {
    if (!selectedProfile) return;

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await supabase.functions.invoke("send-event-share-email", {
        body: {
          event_id: event.id,
          recipient_email: selectedProfile.email,
          recipient_name: getDisplayName(selectedProfile) !== selectedProfile.email
            ? getDisplayName(selectedProfile)
            : undefined,
        },
      });

      if (response.error) {
        throw new Error(response.error instanceof Error ? error.message : "Erreur d'envoi");
      }

      // Record the share in event_shares table (upsert to avoid duplicates)
      const userId = session?.user?.id;
      const recipientName = getDisplayName(selectedProfile) !== selectedProfile.email
        ? getDisplayName(selectedProfile) : null;
      await (supabase as any).from("event_shares").upsert({
        event_id: event.id,
        recipient_email: selectedProfile.email,
        recipient_name: recipientName,
        shared_by: userId,
      }, { onConflict: "event_id,recipient_email" });

      toast({
        title: "Événement partagé !",
        description: `Email envoyé à ${getDisplayName(selectedProfile)}`,
      });

      setSelectedProfile(null);
      setOpen(false);
    } catch (err: unknown) {
      console.error("Share error:", err);
      toast({
        title: "Erreur d'envoi",
        description: err instanceof Error ? err.message : "Impossible d'envoyer l'email.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelectedProfile(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-1" />
          Partager
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Partager l'événement</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sélectionnez un collaborateur pour lui envoyer un email avec les détails
            et les images de l'événement <strong>{event.title}</strong>.
          </p>

          {/* User selector */}
          <Popover open={comboOpen} onOpenChange={setComboOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={comboOpen}
                className="w-full justify-between font-normal"
              >
                <div className="flex items-center gap-2 truncate">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {selectedProfile ? (
                    <span className="truncate">
                      {getDisplayName(selectedProfile)} ({selectedProfile.email})
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Choisir un collaborateur</span>
                  )}
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command shouldFilter={true}>
                <CommandInput placeholder="Rechercher un collaborateur..." />
                <CommandList>
                  <CommandEmpty>Aucun collaborateur trouvé.</CommandEmpty>
                  <CommandGroup heading="Collaborateurs">
                    {profiles.map((profile) => (
                      <CommandItem
                        key={profile.id}
                        value={`${getDisplayName(profile)} ${profile.email}`}
                        onSelect={() => {
                          setSelectedProfile(profile);
                          setComboOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedProfile?.id === profile.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{getDisplayName(profile)}</span>
                          <span className="text-sm text-muted-foreground">{profile.email}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Send button */}
          <div className="flex justify-end">
            <Button
              onClick={handleShare}
              disabled={!selectedProfile || sending}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Envoyer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareEventDialog;
