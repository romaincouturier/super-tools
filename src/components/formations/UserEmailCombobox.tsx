import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
}

interface UserEmailComboboxProps {
  value: string;
  onChange: (email: string, name: string) => void;
  placeholder?: string;
}

const UserEmailCombobox = ({
  value,
  onChange,
  placeholder = "Sélectionner ou saisir un email",
}: UserEmailComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, email, first_name, last_name, display_name")
      .order("first_name");

    if (!error && data) {
      setProfiles(data);
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

  const handleSelect = (profile: Profile) => {
    const name = getDisplayName(profile);
    onChange(profile.email, name !== profile.email ? name : "");
    setInputValue(profile.email);
    setOpen(false);
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
  };

  const handleInputBlur = () => {
    // If the input value is different from the current value and looks like an email
    if (inputValue !== value && inputValue.includes("@")) {
      onChange(inputValue, "");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.includes("@")) {
      onChange(inputValue, "");
      setOpen(false);
    }
  };

  const selectedProfile = profiles.find((p) => p.email === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <div className="flex items-center gap-2 truncate">
            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            {value ? (
              <span className="truncate">
                {selectedProfile
                  ? `${getDisplayName(selectedProfile)} (${selectedProfile.email})`
                  : value}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Rechercher ou saisir un email..."
            value={inputValue}
            onValueChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
          />
          <CommandList>
            <CommandEmpty>
              {inputValue.includes("@") ? (
                <div className="p-2 text-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      onChange(inputValue, "");
                      setOpen(false);
                    }}
                  >
                    Utiliser "{inputValue}"
                  </Button>
                </div>
              ) : (
                <span className="p-2 text-sm text-muted-foreground">
                  Aucun utilisateur trouvé. Saisissez un email valide.
                </span>
              )}
            </CommandEmpty>
            <CommandGroup heading="Utilisateurs du système">
              {profiles.map((profile) => (
                <CommandItem
                  key={profile.id}
                  value={`${getDisplayName(profile)} ${profile.email}`}
                  onSelect={() => handleSelect(profile)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === profile.email ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{getDisplayName(profile)}</span>
                    <span className="text-sm text-muted-foreground">
                      {profile.email}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default UserEmailCombobox;
