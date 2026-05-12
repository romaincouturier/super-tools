import { supabase } from "@/integrations/supabase/client";

export interface AdminDocument {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  year: number | null;
  category: string | null;
  tags: string[];
  summary: string | null;
  analysis_status: "pending" | "done" | "failed";
  uploaded_at: string;
  analyzed_at: string | null;
}

export const ARCHIVE_CATEGORIES = [
  "Facture",
  "Contrat",
  "RH / Paie",
  "Fiscal",
  "Bancaire",
  "Assurance",
  "Légal",
  "Formation",
  "Commercial",
  "Divers",
] as const;

export type ArchiveCategory = (typeof ARCHIVE_CATEGORIES)[number];

export interface AdminDocumentFilters {
  year?: number | null;
  category?: string | null;
  search?: string;
}

/** Fetch documents with optional year/category/search filters. */
export async function fetchAdminDocuments(
  filters: AdminDocumentFilters = {},
): Promise<AdminDocument[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("admin_documents")
    .select("id, file_url, file_name, file_size, mime_type, year, category, tags, summary, analysis_status, uploaded_at, analyzed_at")
    .order("uploaded_at", { ascending: false });

  if (filters.year) query = query.eq("year", filters.year);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.search) {
    const term = `%${filters.search}%`;
    query = query.or(`file_name.ilike.${term},summary.ilike.${term},tags.cs.{${filters.search}}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AdminDocument[];
}

/** Fetch the distinct years present in admin_documents (for the year filter). */
export async function fetchAdminDocumentYears(): Promise<number[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("admin_documents")
    .select("year")
    .not("year", "is", null)
    .order("year", { ascending: false });

  const years = Array.from(new Set<number>((data ?? []).map((r: { year: number }) => r.year)));
  return years;
}

/**
 * Upload a file to admin-archives, insert a DB record (status=pending),
 * and let the backend trigger the analysis in background.
 * Returns the inserted record immediately so the UI can show a loading state.
 */
export async function uploadAdminDocument(file: File): Promise<AdminDocument> {
  const formData = new FormData();
  formData.append("file", file);

  const { data, error } = await supabase.functions.invoke("upload-admin-document", {
    body: formData,
  });

  if (error) throw error;
  if (!data?.document) throw new Error("Upload échoué : aucun document retourné");

  return data.document as AdminDocument;
}

/** Delete a document (storage + DB). */
export async function deleteAdminDocument(doc: AdminDocument): Promise<void> {
  const parts = doc.file_url.split("/admin-archives/");
  if (parts.length > 1) {
    await supabase.storage.from("admin-archives").remove([parts[1]]);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("admin_documents").delete().eq("id", doc.id);
}
