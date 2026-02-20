import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface UserProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  is_admin: boolean | null;
}

interface AssignedUserSelectorProps {
  value: string | null;
  onChange: (userId: string | null) => void;
}

export default function AssignedUserSelector({
  value,
  onChange,
}: AssignedUserSelectorProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email, is_admin")
        .order("first_name");

      if (error) throw error;
      setUsers((data || []) as UserProfile[]);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = (user: UserProfile) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user.first_name) return user.first_name;
    return user.email.split("@")[0];
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  const selectedUser = users.find((u) => u.user_id === value);

  return (
    <Select
      value={value || "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? null : v)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Non assigné">
          {selectedUser ? getDisplayName(selectedUser) : "Non assigné"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-muted-foreground">Non assigné</span>
        </SelectItem>
        {users.map((user) => (
          <SelectItem key={user.user_id} value={user.user_id}>
            <span>
              {getDisplayName(user)}
              {user.is_admin && (
                <span className="text-xs text-muted-foreground ml-1">(admin)</span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
