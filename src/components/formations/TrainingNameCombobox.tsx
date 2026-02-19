import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface FormationConfig {
  id: string;
  formation_name: string;
  duree_heures: number;
  prix: number;
  programme_url: string | null;
  objectives: string[] | null;
  prerequisites: string[] | null;
  supports_url: string | null;
  elearning_duration: number | null;
  elearning_access_email_content: string | null;
  supertilt_link: string | null;
  woocommerce_product_id: number | null;
  description: string | null;
  is_active: boolean;
}

interface TrainingNameComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onFormationSelect?: (formation: FormationConfig | null) => void;
}

const TrainingNameCombobox = ({ value, onChange, onFormationSelect }: TrainingNameComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [formations, setFormations] = useState<FormationConfig[]>([]);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    fetchFormations();
  }, []);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const fetchFormations = async () => {
    const { data, error } = await supabase
      .from("formation_configs")
      .select("id, formation_name, duree_heures, prix, programme_url, objectives, prerequisites, supports_url, elearning_duration, elearning_access_email_content, supertilt_link, woocommerce_product_id, description, is_active")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (!error && data) {
      setFormations(data);
    }
  };

  const handleSelect = (formationName: string) => {
    onChange(formationName);
    setInputValue(formationName);
    setOpen(false);

    // Find and pass the full formation config
    const selectedFormation = formations.find(f => f.formation_name === formationName);
    onFormationSelect?.(selectedFormation || null);
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    onChange(newValue);
    // Clear formation selection when typing custom value
    if (!formations.some(f => f.formation_name === newValue)) {
      onFormationSelect?.(null);
    }
  };

  const isNewFormation = inputValue && !formations.some(
    f => f.formation_name.toLowerCase() === inputValue.toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || "Sélectionner ou saisir une formation..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Rechercher ou saisir..."
            value={inputValue}
            onValueChange={handleInputChange}
          />
          <CommandList>
            <CommandEmpty>
              {inputValue ? (
                <div className="py-2 px-3 text-sm text-muted-foreground">
                  Appuyez sur Entrée pour créer "{inputValue}"
                </div>
              ) : (
                "Aucune formation trouvée."
              )}
            </CommandEmpty>

            {/* Option to create new formation */}
            {isNewFormation && (
              <>
                <CommandGroup heading="Nouvelle formation">
                  <CommandItem
                    value={`create-${inputValue}`}
                    onSelect={() => handleSelect(inputValue)}
                    className="cursor-pointer"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Créer "{inputValue}"
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Existing formations */}
            {formations.length > 0 && (
              <CommandGroup heading="Catalogue de formations">
                {formations
                  .filter(f =>
                    !inputValue ||
                    f.formation_name.toLowerCase().includes(inputValue.toLowerCase())
                  )
                  .map((formation) => (
                    <CommandItem
                      key={formation.id}
                      value={formation.formation_name}
                      onSelect={() => handleSelect(formation.formation_name)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === formation.formation_name ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{formation.formation_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formation.duree_heures}h &middot; {formation.prix}€
                          {formation.woocommerce_product_id && " · WC"}
                        </span>
                      </div>
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

export default TrainingNameCombobox;
