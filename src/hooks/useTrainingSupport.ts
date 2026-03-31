import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeFileName, resolveContentType } from "@/lib/file-utils";
import { registerMediaEntry, deleteMediaFile } from "@/hooks/useMedia";

// ── Types ───────────────────────────────────────────────────────────

export interface TrainingSupport {
  id: string;
  training_id: string;
  title: string;
  template_id: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportSection {
  id: string;
  support_id: string;
  title: string;
  content: string;
  position: number;
  is_resources: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupportMedia {
  id: string;
  section_id: string;
  support_id: string;
  file_url: string;
  file_name: string;
  file_type: "image" | "video" | "audio";
  mime_type: string | null;
  file_size: number | null;
  transcript: string | null;
  transcript_summary: string | null;
  position: number;
  created_at: string;
}

export interface SupportImport {
  id: string;
  support_id: string;
  file_url: string;
  file_name: string;
  file_type: "image" | "video";
  mime_type: string | null;
  file_size: number | null;
  assigned_section_id: string | null;
  created_at: string;
}

export interface SupportTemplate {
  id: string;
  name: string;
  description: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateSectionDef {
  id: string;
  template_id: string;
  title: string;
  content: string;
  position: number;
}

// ── Query keys ──────────────────────────────────────────────────────

const SUPPORT_KEY = "training-support";
const SECTIONS_KEY = "training-support-sections";
const MEDIA_KEY = "training-support-media";
const IMPORTS_KEY = "training-support-imports";
const TEMPLATES_KEY = "training-support-templates";

// ── Fetch support for a training ────────────────────────────────────

export const useTrainingSupport = (trainingId: string | undefined) => {
  return useQuery({
    queryKey: [SUPPORT_KEY, trainingId],
    enabled: !!trainingId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("training_supports")
        .select("*")
        .eq("training_id", trainingId)
        .maybeSingle();

      if (error) throw error;
      return data as TrainingSupport | null;
    },
  });
};

// ── Create support ──────────────────────────────────────────────────

export const useCreateSupport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ trainingId, title, templateId }: {
      trainingId: string;
      title?: string;
      templateId?: string;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      // Create support
      const { data: support, error } = await (supabase as any)
        .from("training_supports")
        .insert({
          training_id: trainingId,
          title: title || "Support de formation",
          template_id: templateId || null,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      // If from template, copy template sections
      if (templateId) {
        const { data: tplSections } = await (supabase as any)
          .from("training_support_template_sections")
          .select("*")
          .eq("template_id", templateId)
          .order("position");

        if (tplSections?.length) {
          const sections = tplSections.map((s: TemplateSectionDef, i: number) => ({
            support_id: support.id,
            title: s.title,
            content: s.content,
            position: i,
            is_resources: false,
          }));
          await (supabase as any).from("training_support_sections").insert(sections);
        }
      }

      // Always ensure a "Ressources" section exists at the end
      const { data: existingSections } = await (supabase as any)
        .from("training_support_sections")
        .select("id")
        .eq("support_id", support.id)
        .eq("is_resources", true);

      if (!existingSections?.length) {
        await (supabase as any).from("training_support_sections").insert({
          support_id: support.id,
          title: "Ressources",
          content: "",
          position: 9999,
          is_resources: true,
        });
      }

      return support as TrainingSupport;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [SUPPORT_KEY, variables.trainingId] });
      queryClient.invalidateQueries({ queryKey: [SECTIONS_KEY] });
    },
  });
};

// ── Update support ──────────────────────────────────────────────────

export const useUpdateSupport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TrainingSupport> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("training_supports")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPORT_KEY] });
    },
  });
};

// ── Sections ────────────────────────────────────────────────────────

export const useSupportSections = (supportId: string | undefined) => {
  return useQuery({
    queryKey: [SECTIONS_KEY, supportId],
    enabled: !!supportId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("training_support_sections")
        .select("*")
        .eq("support_id", supportId)
        .order("position");

      if (error) throw error;
      return (data || []) as SupportSection[];
    },
  });
};

export const useAddSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ supportId, title, content, position }: {
      supportId: string;
      title: string;
      content?: string;
      position: number;
    }) => {
      // Shift positions of existing sections at or after this position
      const { data: existing } = await (supabase as any)
        .from("training_support_sections")
        .select("id, position")
        .eq("support_id", supportId)
        .gte("position", position)
        .order("position", { ascending: false });

      if (existing && existing.length > 0) {
        for (const s of existing) {
          await (supabase as any)
            .from("training_support_sections")
            .update({ position: s.position + 1 })
            .eq("id", s.id);
        }
      }

      const { data, error } = await (supabase as any)
        .from("training_support_sections")
        .insert({ support_id: supportId, title, content: content || "", position })
        .select()
        .single();

      if (error) throw error;
      return data as SupportSection;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SECTIONS_KEY] });
    },
  });
};

export const useUpdateSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SupportSection> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("training_support_sections")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SECTIONS_KEY] });
    },
  });
};

export const useDeleteSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("training_support_sections")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SECTIONS_KEY] });
    },
  });
};

export const useReorderSections = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sections: { id: string; position: number }[]) => {
      for (const s of sections) {
        await (supabase as any)
          .from("training_support_sections")
          .update({ position: s.position })
          .eq("id", s.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SECTIONS_KEY] });
    },
  });
};

// ── Section media ───────────────────────────────────────────────────

export const useSectionMedia = (supportId: string | undefined) => {
  return useQuery({
    queryKey: [MEDIA_KEY, supportId],
    enabled: !!supportId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("training_support_media")
        .select("*")
        .eq("support_id", supportId)
        .order("position");

      if (error) throw error;
      return (data || []) as SupportMedia[];
    },
  });
};

export const useAddSectionMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sectionId: string;
      supportId: string;
      fileUrl: string;
      fileName: string;
      fileType: "image" | "video" | "audio";
      mimeType: string | null;
      fileSize: number | null;
    }) => {
      const { data, error } = await (supabase as any)
        .from("training_support_media")
        .insert({
          section_id: input.sectionId,
          support_id: input.supportId,
          file_url: input.fileUrl,
          file_name: input.fileName,
          file_type: input.fileType,
          mime_type: input.mimeType,
          file_size: input.fileSize,
          position: 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Also register in the central media library
      registerMediaEntry({
        file_url: input.fileUrl,
        file_name: input.fileName,
        file_type: input.fileType,
        mime_type: input.mimeType,
        file_size: input.fileSize,
        source_type: "training",
        source_id: input.supportId,
      });

      return data as SupportMedia;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MEDIA_KEY] });
    },
  });
};

export const useDeleteSectionMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fileUrl }: { id: string; fileUrl: string }) => {
      const { error } = await (supabase as any)
        .from("training_support_media")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await deleteMediaFile(fileUrl).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MEDIA_KEY] });
    },
  });
};

/** Remove image from section and put it back in unassigned imports */
export const useUnassignSectionMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (media: Pick<SupportMedia, "id" | "support_id" | "file_url" | "file_name" | "file_type" | "mime_type" | "file_size">) => {
      // Find the import that was assigned for this file
      const { data: imp } = await (supabase as any)
        .from("training_support_imports")
        .select("id")
        .eq("support_id", media.support_id)
        .eq("file_url", media.file_url)
        .not("assigned_section_id", "is", null)
        .maybeSingle();

      if (imp) {
        // Unmark the import so it reappears in available imports
        await (supabase as any)
          .from("training_support_imports")
          .update({ assigned_section_id: null })
          .eq("id", imp.id);
      } else {
        // No matching import found — recreate one
        await (supabase as any)
          .from("training_support_imports")
          .insert({
            support_id: media.support_id,
            file_url: media.file_url,
            file_name: media.file_name,
            file_type: media.file_type,
            mime_type: media.mime_type,
            file_size: media.file_size,
          });
      }

      // Delete the media entry from the section
      const { error } = await (supabase as any)
        .from("training_support_media")
        .delete()
        .eq("id", media.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MEDIA_KEY] });
      queryClient.invalidateQueries({ queryKey: [IMPORTS_KEY] });
    },
  });
};

export const useUpdateSectionMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SupportMedia> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("training_support_media")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MEDIA_KEY] });
    },
  });
};

// ── Bulk imports ────────────────────────────────────────────────────

export const useSupportImports = (supportId: string | undefined) => {
  return useQuery({
    queryKey: [IMPORTS_KEY, supportId],
    enabled: !!supportId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("training_support_imports")
        .select("*")
        .eq("support_id", supportId)
        .is("assigned_section_id", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as SupportImport[];
    },
  });
};

export const useAddSupportImport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      supportId: string;
      fileUrl: string;
      fileName: string;
      fileType: "image" | "video";
      mimeType: string | null;
      fileSize: number | null;
    }) => {
      const { data, error } = await (supabase as any)
        .from("training_support_imports")
        .insert({
          support_id: input.supportId,
          file_url: input.fileUrl,
          file_name: input.fileName,
          file_type: input.fileType,
          mime_type: input.mimeType,
          file_size: input.fileSize,
        })
        .select()
        .single();

      if (error) throw error;
      return data as SupportImport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [IMPORTS_KEY] });
    },
  });
};

export const useAssignImportToSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ importId, sectionId, supportId }: {
      importId: string;
      sectionId: string;
      supportId: string;
    }) => {
      // Get import data
      const { data: imp } = await (supabase as any)
        .from("training_support_imports")
        .select("*")
        .eq("id", importId)
        .single();

      if (!imp) throw new Error("Import not found");

      // Create media entry in the section
      await (supabase as any).from("training_support_media").insert({
        section_id: sectionId,
        support_id: supportId,
        file_url: imp.file_url,
        file_name: imp.file_name,
        file_type: imp.file_type,
        mime_type: imp.mime_type,
        file_size: imp.file_size,
        position: 0,
      });

      // Also register in the central media library
      registerMediaEntry({
        file_url: imp.file_url,
        file_name: imp.file_name,
        file_type: imp.file_type,
        mime_type: imp.mime_type,
        file_size: imp.file_size,
        source_type: "training",
        source_id: supportId,
      });

      // Mark import as assigned
      await (supabase as any)
        .from("training_support_imports")
        .update({ assigned_section_id: sectionId })
        .eq("id", importId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [IMPORTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [MEDIA_KEY] });
    },
  });
};

// ── Templates ───────────────────────────────────────────────────────

export const useSupportTemplates = () => {
  return useQuery({
    queryKey: [TEMPLATES_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("training_support_templates")
        .select("*")
        .order("name");

      if (error) throw error;
      return (data || []) as SupportTemplate[];
    },
  });
};

export const useTemplateSections = (templateId: string | undefined) => {
  return useQuery({
    queryKey: [TEMPLATES_KEY, "sections", templateId],
    enabled: !!templateId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("training_support_template_sections")
        .select("*")
        .eq("template_id", templateId)
        .order("position");

      if (error) throw error;
      return (data || []) as TemplateSectionDef[];
    },
  });
};

export const useCreateTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, description, sections }: {
      name: string;
      description?: string;
      sections: { title: string; content: string }[];
    }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const { data: tpl, error } = await (supabase as any)
        .from("training_support_templates")
        .insert({ name, description: description || "", created_by: userId })
        .select()
        .single();

      if (error) throw error;

      if (sections.length > 0) {
        const rows = sections.map((s, i) => ({
          template_id: tpl.id,
          title: s.title,
          content: s.content,
          position: i,
        }));
        await (supabase as any).from("training_support_template_sections").insert(rows);
      }

      return tpl as SupportTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY] });
    },
  });
};

export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("training_support_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY] });
    },
  });
};

// ── Save current support as template ────────────────────────────────

export const useSaveAsTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ supportId, name }: { supportId: string; name: string }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      // Fetch current sections
      const { data: sections } = await (supabase as any)
        .from("training_support_sections")
        .select("title, content, position")
        .eq("support_id", supportId)
        .order("position");

      // Create template
      const { data: tpl, error } = await (supabase as any)
        .from("training_support_templates")
        .insert({ name, created_by: userId })
        .select()
        .single();

      if (error) throw error;

      if (sections?.length) {
        const rows = sections.map((s: { title: string; content: string }, i: number) => ({
          template_id: tpl.id,
          title: s.title,
          content: s.content,
          position: i,
        }));
        await (supabase as any).from("training_support_template_sections").insert(rows);
      }

      return tpl as SupportTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY] });
    },
  });
};

// ── File upload ─────────────────────────────────────────────────────

export const uploadSupportFile = async (file: File, supportId: string) => {
  const safeName = sanitizeFileName(file.name);
  const path = `${supportId}/${Date.now()}_${safeName}`;
  const contentType = resolveContentType(file);

  const { error } = await supabase.storage
    .from("training-supports")
    .upload(path, file, { contentType, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from("training-supports").getPublicUrl(path);
  return data.publicUrl;
};
