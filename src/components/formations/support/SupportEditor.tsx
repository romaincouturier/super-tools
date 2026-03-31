import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  BookOpen, Plus, Loader2, Eye, Save, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  useTrainingSupport, useCreateSupport, useUpdateSupport,
  useSupportSections, useSectionMedia, useSupportImports,
  useAddSection, useReorderSections, useAssignImportToSection,
} from "@/hooks/useTrainingSupport";
import SupportSectionCard from "./SupportSectionCard";
import SupportBulkImport from "./SupportBulkImport";
import SupportTemplateDialog from "./SupportTemplateDialog";

interface SupportEditorProps {
  trainingId: string;
  trainingName: string;
}

const SupportEditor = ({ trainingId, trainingName }: SupportEditorProps) => {
  const { data: support, isLoading: supportLoading } = useTrainingSupport(trainingId);
  const { data: sections = [] } = useSupportSections(support?.id);
  const { data: allMedia = [] } = useSectionMedia(support?.id);
  const { data: imports = [] } = useSupportImports(support?.id);

  const [expanded, setExpanded] = useState(false);

  const createSupport = useCreateSupport();
  const updateSupport = useUpdateSupport();
  const addSection = useAddSection();
  const reorderSections = useReorderSections();
  const assignImport = useAssignImportToSection();

  // Sort: non-resources first by position, resources last
  const sortedSections = useMemo(() => {
    return [...sections].sort((a, b) => {
      if (a.is_resources && !b.is_resources) return 1;
      if (!a.is_resources && b.is_resources) return -1;
      return a.position - b.position;
    });
  }, [sections]);

  const nonResourceSections = sortedSections.filter((s) => !s.is_resources);
  const resourcesSection = sortedSections.find((s) => s.is_resources);

  const handleCreate = async (templateId?: string) => {
    try {
      await createSupport.mutateAsync({
        trainingId,
        title: `Support — ${trainingName}`,
        templateId,
      });
      setExpanded(true);
      toast.success("Support de formation créé");
    } catch (error) {
      console.error("Error creating support:", error);
      toast.error("Erreur lors de la création");
    }
  };

  const handleAddSection = async (position: "start" | "end" | number) => {
    if (!support) return;

    let pos: number;
    if (position === "start") {
      pos = 0;
    } else if (position === "end") {
      const maxPos = Math.max(0, ...nonResourceSections.map((s) => s.position));
      pos = maxPos + 1;
    } else {
      pos = position;
    }

    try {
      await addSection.mutateAsync({
        supportId: support.id,
        title: "Nouvelle section",
        position: pos,
      });
    } catch {
      toast.error("Erreur lors de l'ajout");
    }
  };

  const handleMoveSection = async (sectionId: string, direction: "up" | "down") => {
    const idx = nonResourceSections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= nonResourceSections.length) return;

    const updates = nonResourceSections.map((s, i) => {
      if (i === idx) return { id: s.id, position: nonResourceSections[swapIdx].position };
      if (i === swapIdx) return { id: s.id, position: nonResourceSections[idx].position };
      return { id: s.id, position: s.position };
    });

    await reorderSections.mutateAsync(updates);
  };

  const [optimisticPublished, setOptimisticPublished] = useState<boolean | null>(null);
  const isPublished = optimisticPublished ?? support?.is_published ?? false;

  const handleTogglePublished = async () => {
    if (!support) return;
    const newValue = !isPublished;
    setOptimisticPublished(newValue);
    try {
      await updateSupport.mutateAsync({ id: support.id, is_published: newValue });
      toast.success(newValue ? "Support publié" : "Support dépublié");
    } catch {
      setOptimisticPublished(null);
      toast.error("Erreur");
    } finally {
      setOptimisticPublished(null);
    }
  };

  const handleAssignImport = async (importId: string, sectionId: string) => {
    if (!support) return;
    try {
      await assignImport.mutateAsync({ importId, sectionId, supportId: support.id });
      toast.success("Image affectée à la section");
    } catch {
      toast.error("Erreur lors de l'affectation");
    }
  };

  const mediaBySection = useMemo(() => {
    const map: Record<string, typeof allMedia> = {};
    allMedia.forEach((m) => {
      if (!map[m.section_id]) map[m.section_id] = [];
      map[m.section_id].push(m);
    });
    return map;
  }, [allMedia]);

  if (supportLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // No support yet — show creation card
  if (!support) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5" />
            Support de formation
          </CardTitle>
          <CardDescription>Créez un support structuré pour cette formation</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => handleCreate()} disabled={createSupport.isPending}>
            {createSupport.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Créer un support vierge
          </Button>
          <SupportTemplateDialog mode="create" onSelectTemplate={(tplId) => handleCreate(tplId)} />
        </CardContent>
      </Card>
    );
  }

  // Support exists — show editor
  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5" />
            Support de formation
            <Badge variant={isPublished ? "default" : "secondary"} className="text-[10px]">
              {isPublished ? "Publié" : "Brouillon"}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {sections.length} section{sections.length !== 1 ? "s" : ""}
            </Badge>
          </CardTitle>
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={isPublished}
                onCheckedChange={handleTogglePublished}
                id="support-published"
              />
              <Label htmlFor="support-published" className="text-sm">Publié (visible par les participants)</Label>
            </div>

            <div className="flex-1" />

            <SupportTemplateDialog mode="save" supportId={support.id} onSelectTemplate={() => {}} />

            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAddSection("start")}>
              <Plus className="h-3.5 w-3.5" />
              Section au début
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAddSection("end")}>
              <Plus className="h-3.5 w-3.5" />
              Section à la fin
            </Button>
          </div>

          {/* Bulk import */}
          <SupportBulkImport supportId={support.id} imports={imports} />

          {/* Sections */}
          <div className="space-y-3">
            {sortedSections.map((section, idx) => {
              const isFirstNonResource = !section.is_resources && idx === 0;
              const nonResIdx = nonResourceSections.findIndex((s) => s.id === section.id);

              return (
                <div key={section.id}>
                  {/* Add section between */}

                  <SupportSectionCard
                    section={section}
                    sectionMedia={mediaBySection[section.id] || []}
                    availableImports={imports}
                    supportId={support.id}
                    isFirst={section.is_resources || nonResIdx === 0}
                    isLast={section.is_resources || nonResIdx === nonResourceSections.length - 1}
                    onMoveUp={() => handleMoveSection(section.id, "up")}
                    onMoveDown={() => handleMoveSection(section.id, "down")}
                    onAssignImport={(importId) => handleAssignImport(importId, section.id)}
                    onInsertAbove={() => handleAddSection(section.position)}
                    onInsertBelow={() => handleAddSection(section.position + 1)}
                  />
                </div>
              );
            })}
          </div>

          {sortedSections.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aucune section encore. Ajoutez-en une pour commencer.</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default SupportEditor;
