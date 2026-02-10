import { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

interface SupertiltLinkComboboxProps {
  value: string;
  onChange: (value: string) => void;
}

const SupertiltLinkCombobox = ({ value, onChange }: SupertiltLinkComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    fetchLinks();
  }, []);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const fetchLinks = async () => {
    const { data, error } = await (supabase as any)
      .from("trainings")
      .select("supertilt_link")
      .not("supertilt_link", "is", null)
      .neq("supertilt_link", "")
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Deduplicate and keep unique links
      const unique = Array.from(new Set(data.map((d: any) => String(d.supertilt_link)))) as string[];
      setLinks(unique);
    }
  };

  const handleSelect = (link: string) => {
    onChange(link);
    setInputValue(link);
    setOpen(false);
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    onChange(newValue);
  };

  const filtered = links.filter(
    (l) => !inputValue || l.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10"
        >
          <span className={cn("truncate text-left", !value && "text-muted-foreground")}>
            {value || "Saisir ou sélectionner un lien..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Coller ou rechercher un lien..."
            value={inputValue}
            onValueChange={handleInputChange}
          />
          <CommandList>
            <CommandEmpty>
              <div className="py-2 px-3 text-sm text-muted-foreground">
                {inputValue ? "Aucun lien existant trouvé. La valeur saisie sera utilisée." : "Aucun lien enregistré."}
              </div>
            </CommandEmpty>

            {filtered.length > 0 && (
              <CommandGroup heading="Liens précédents">
                {filtered.map((link) => (
                  <CommandItem
                    key={link}
                    value={link}
                    onSelect={() => handleSelect(link)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === link ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate text-sm">{link}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SupertiltLinkCombobox;
