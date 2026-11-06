import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useCommunityThemesConfig, useSetCoursePrivateCommunity, useSetCourseTheme } from "@/hooks/useCommunityThemes";

export default function CommunityThemesManager() {
  const { data, isLoading } = useCommunityThemesConfig();
  const setTheme = useSetCourseTheme();
  const setPrivate = useSetCoursePrivateCommunity();
  const { toast } = useToast();
  const onError = () => toast({ title: "Modification impossible", variant: "destructive" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Communautés thématiques</CardTitle>
        <p className="text-sm text-muted-foreground">
          Rattachez chaque cours à une ou plusieurs thématiques. Une communauté privée (intra) reste visible
          de ses seuls participants ; ils voient aussi les thématiques de leur cours.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <div className="divide-y">
            {data.courses.filter((c) => c.status === "published").map((c) => (
              <div key={c.id} className="py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <span className="font-medium text-sm">{c.title}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {data.themes.map((t) => {
                    const linked = c.theme_ids.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={linked}
                        onClick={() => setTheme.mutate({ courseId: c.id, themeId: t.id, linked: !linked }, { onError })}
                      >
                        <Badge variant={linked ? "default" : "outline"}>{t.name}</Badge>
                      </button>
                    );
                  })}
                  <label className="flex items-center gap-2 text-xs text-muted-foreground ml-2">
                    <Switch
                      checked={c.community_is_private}
                      onCheckedChange={(v) => setPrivate.mutate({ courseId: c.id, isPrivate: v }, { onError })}
                    />
                    Communauté privée (intra)
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
