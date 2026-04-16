import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, Hash } from "lucide-react";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";

interface SlackChannel {
  id: string;
  name: string;
  num_members: number;
}

interface SlackChannelCardProps {
  currentChannel: string;
  onChannelChange: (channel: string) => void;
}

export default function SlackChannelCard({ currentChannel, onChannelChange }: SlackChannelCardProps) {
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { loading, invoke } = useEdgeFunction<{ channels?: SlackChannel[] }>(
    "slack-list-channels",
    { errorMessage: "Erreur Slack" },
  );

  const fetchChannels = async () => {
    setError(null);
    const data = await invoke();
    if (data?.channels) {
      setChannels(data.channels);
    } else if (data === null) {
      setError("Erreur de chargement");
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Slack</CardTitle>
        <CardDescription>
          Recevez une notification Slack quand une opportunité CRM est créée ou gagnée.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Canal de notification</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchChannels}
              disabled={loading}
              className="h-7 px-2 text-xs"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              <span className="ml-1">Rafraîchir</span>
            </Button>
          </div>

          {error && channels.length === 0 ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <Select
              value={
                currentChannel
                  ? (channels.find((ch) => ch.id === currentChannel || ch.name === currentChannel)?.id ?? currentChannel)
                  : ""
              }
              onValueChange={onChannelChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un canal" />
              </SelectTrigger>
              <SelectContent>
                {channels.length > 0 ? (
                  channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      <span className="flex items-center gap-1.5">
                        <Hash className="h-3 w-3 text-muted-foreground" />
                        {ch.name}
                        <span className="text-muted-foreground text-xs">({ch.num_members})</span>
                      </span>
                    </SelectItem>
                  ))
                ) : loading ? (
                  <SelectItem value="__loading__" disabled>
                    Chargement…
                  </SelectItem>
                ) : (
                  <SelectItem value="__none__" disabled>
                    Aucun canal disponible
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          )}

          <p className="text-xs text-muted-foreground">
            Canal où seront postées les notifications CRM (opportunités créées/gagnées).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
