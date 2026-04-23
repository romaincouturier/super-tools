import { useMemo, useState } from "react";
import { Check, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { displayNameOf, type UserProfileLite } from "@/lib/userDisplay";

interface MultiUserSelectorProps {
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  triggerLabel?: string;
  className?: string;
  /** Restrict selection to these user_ids — useful for sharing/access contexts. */
  allowedUserIds?: string[];
}

export default function MultiUserSelector({
  value,
  onChange,
  placeholder = "Rechercher un collaborateur…",
  triggerLabel,
  className,
  allowedUserIds,
}: MultiUserSelectorProps) {
  const [open, setOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery<UserProfileLite[]>({
    queryKey: ["profiles-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .order("first_name", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as UserProfileLite[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredUsers = useMemo(() => {
    if (!allowedUserIds) return users;
    const allowed = new Set(allowedUserIds);
    return users.filter((u) => allowed.has(u.user_id));
  }, [users, allowedUserIds]);

  const selected = useMemo(
    () => filteredUsers.filter((u) => value.includes(u.user_id)),
    [filteredUsers, value],
  );

  const toggleUser = (userId: string) => {
    const next = value.includes(userId)
      ? value.filter((id) => id !== userId)
      : [...value, userId];
    onChange(next);
  };

  const label = triggerLabel
    ?? (selected.length === 0
      ? "Taguer des collaborateurs"
      : selected.length === 1
        ? displayNameOf(selected[0])
        : `${selected.length} collaborateurs`);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <Users className="h-4 w-4" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <>
                <CommandEmpty>Aucun collaborateur trouvé.</CommandEmpty>
                <CommandGroup>
                  {filteredUsers.map((user) => {
                    const isSelected = value.includes(user.user_id);
                    return (
                      <CommandItem
                        key={user.user_id}
                        value={`${displayNameOf(user)} ${user.email}`}
                        onSelect={() => toggleUser(user.user_id)}
                        className="flex items-center gap-2"
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm">{displayNameOf(user)}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
