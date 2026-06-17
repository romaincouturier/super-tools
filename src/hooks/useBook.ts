import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import type {
  BookProfile,
  BookAlbum,
  BookProduction,
  BookShareLink,
  BookLinkStats,
} from "@/types/book";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  return user.id;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function useBookProfile() {
  return useQuery<BookProfile | null>({
    queryKey: ["book-profile"],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from("book_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useUpsertBookProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fields: Partial<Omit<BookProfile, "id" | "user_id" | "created_at" | "updated_at">>) => {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from("book_profiles")
        .upsert({ ...fields, user_id: userId }, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      return data as BookProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book-profile"] });
    },
    onError: (err: Error) => {
      toastError(toast, err);
    },
  });
}

// ---------------------------------------------------------------------------
// Albums
// ---------------------------------------------------------------------------

export function useBookAlbums() {
  return useQuery<BookAlbum[]>({
    queryKey: ["book-albums"],
    queryFn: async () => {
      const [{ data: albums, error: albumsError }, { data: productions, error: productionsError }] =
        await Promise.all([
          supabase
            .from("book_albums")
            .select("*")
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
          supabase
            .from("book_productions")
            .select("album_id, file_url, thumbnail_url, file_type, sort_order, created_at")
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
        ]);

      if (albumsError) throw albumsError;
      if (productionsError) throw productionsError;

      const countMap: Record<string, number> = {};
      const coverMap: Record<string, string> = {};
      for (const row of productions ?? []) {
        countMap[row.album_id] = (countMap[row.album_id] ?? 0) + 1;
        if (!coverMap[row.album_id]) {
          coverMap[row.album_id] = row.thumbnail_url ?? row.file_url;
        }
      }

      const candidateUrls = [
        ...Object.values(coverMap),
        ...(albums ?? []).map((a) => a.cover_url).filter((u): u is string => !!u),
      ];
      const signedCoverUrls = await signStorageUrls(candidateUrls);

      const resolveCover = (url: string | null | undefined) =>
        url ? signedCoverUrls[url] ?? url : null;

      return (albums ?? []).map((album) => ({
        ...(album as BookAlbum),
        cover_url:
          resolveCover(album.cover_url) ??
          resolveCover(coverMap[album.id]) ??
          null,
        production_count: countMap[album.id] ?? 0,
      }));
    },
  });
}

export function useCreateAlbum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      fields: Pick<BookAlbum, "title"> & Partial<Pick<BookAlbum, "description" | "cover_url" | "sort_order">>
    ) => {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from("book_albums")
        .insert({ ...fields, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as BookAlbum;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book-albums"] });
    },
    onError: (err: Error) => {
      toastError(toast, err);
    },
  });
}

export function useUpdateAlbum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: { id: string } & Partial<Omit<BookAlbum, "id" | "user_id" | "created_at" | "updated_at" | "production_count">>) => {
      const { data, error } = await supabase
        .from("book_albums")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as BookAlbum;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book-albums"] });
    },
    onError: (err: Error) => {
      toastError(toast, err);
    },
  });
}

export function useDeleteAlbum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (albumId: string) => {
      const userId = await getCurrentUserId();

      // Remove all files in storage under {userId}/{albumId}/
      const { data: fileList } = await supabase.storage
        .from("book-productions")
        .list(`${userId}/${albumId}`);

      if (fileList && fileList.length > 0) {
        const paths = fileList.map((f) => `${userId}/${albumId}/${f.name}`);
        await supabase.storage.from("book-productions").remove(paths);
      }

      const { error } = await supabase
        .from("book_albums")
        .delete()
        .eq("id", albumId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book-albums"] });
    },
    onError: (err: Error) => {
      toastError(toast, err);
    },
  });
}

export function useAlbumRawCover(albumId: string) {
  return useQuery<string | null>({
    queryKey: ["book-album-raw-cover", albumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("book_albums")
        .select("cover_url")
        .eq("id", albumId)
        .maybeSingle();
      if (error) throw error;
      return data?.cover_url ?? null;
    },
    enabled: !!albumId,
  });
}

// ---------------------------------------------------------------------------
// Productions
// ---------------------------------------------------------------------------

export function extractStoragePath(fileUrl: string): string | null {
  try {
    const u = new URL(fileUrl);
    const markers = [
      "/object/public/book-productions/",
      "/object/sign/book-productions/",
      "/object/book-productions/",
    ];
    for (const m of markers) {
      const idx = u.pathname.indexOf(m);
      if (idx !== -1)
        return decodeURIComponent(u.pathname.slice(idx + m.length).split("?")[0]);
    }
    return null;
  } catch {
    return null;
  }
}

async function signStorageUrls(urls: string[]): Promise<Record<string, string>> {
  const pathByUrl = new Map<string, string>();
  urls.forEach((url) => {
    const path = extractStoragePath(url);
    if (path) pathByUrl.set(url, path);
  });

  const paths = [...new Set(pathByUrl.values())];
  if (paths.length === 0) return {};

  const { data, error } = await supabase.storage
    .from("book-productions")
    .createSignedUrls(paths, 60 * 60);
  if (error || !data) return {};

  const signedByPath: Record<string, string> = {};
  data.forEach((item, index) => {
    if (item.signedUrl) signedByPath[paths[index]] = item.signedUrl;
  });

  return Object.fromEntries(
    [...pathByUrl.entries()].flatMap(([url, path]) =>
      signedByPath[path] ? [[url, signedByPath[path]]] : []
    )
  );
}

async function signProductions(rows: BookProduction[]): Promise<BookProduction[]> {
  const signedUrls = await signStorageUrls(rows.map((row) => row.file_url));
  return rows.map((row) => ({
    ...row,
    file_url: signedUrls[row.file_url] ?? row.file_url,
  }));
}

export function useBookProductions(albumId: string) {
  return useQuery<BookProduction[]>({
    queryKey: ["book-productions", albumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("book_productions")
        .select("*")
        .eq("album_id", albumId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return await signProductions((data ?? []) as BookProduction[]);
    },
    enabled: !!albumId,
    staleTime: 30 * 60 * 1000,
  });
}

interface UploadProductionParams {
  albumId: string;
  file: File;
  title?: string;
  notes?: string;
  tags?: string[];
  exifDate?: string | null;
  exifWidth?: number | null;
  exifHeight?: number | null;
}

export function useUploadProduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      albumId,
      file,
      title,
      notes,
      tags,
      exifDate,
      exifWidth,
      exifHeight,
    }: UploadProductionParams) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("albumId", albumId);
      if (title != null) formData.append("title", title);
      if (notes != null) formData.append("notes", notes);
      if (tags != null) formData.append("tags", JSON.stringify(tags));
      if (exifDate != null) formData.append("exifDate", exifDate);
      if (exifWidth != null) formData.append("exifWidth", String(exifWidth));
      if (exifHeight != null) formData.append("exifHeight", String(exifHeight));
      formData.append("originalFilename", file.name);

      const { data, error } = await supabase.functions.invoke(
        "book-upload-production",
        { body: formData }
      );
      if (error) throw error;
      return data.production as BookProduction;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["book-productions", variables.albumId] });
    },
    onError: (err: Error) => {
      toastError(toast, err, { title: "Erreur upload" });
    },
  });
}

export function useUpdateProduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      albumId,
      ...fields
    }: { id: string; albumId: string } & Partial<
      Omit<BookProduction, "id" | "album_id" | "user_id" | "created_at" | "updated_at">
    >) => {
      const { data, error } = await supabase
        .from("book_productions")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as BookProduction;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["book-productions", variables.albumId] });
    },
    onError: (err: Error) => {
      toastError(toast, err);
    },
  });
}

export function useDeleteProduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      fileUrl,
      sourceMediaId,
    }: {
      id: string;
      albumId: string;
      fileUrl: string;
      sourceMediaId?: string | null;
    }) => {
      // Only clean up storage for files we own (not references to the media library)
      if (!sourceMediaId) {
        try {
          const storagePath = extractStoragePath(fileUrl);
          if (storagePath) {
            await supabase.storage.from("book-productions").remove([storagePath]);
          }
        } catch {
          console.warn("[useDeleteProduction] Could not parse fileUrl for storage cleanup:", fileUrl);
        }
      }

      const { error } = await supabase
        .from("book_productions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["book-productions", variables.albumId] });
      queryClient.invalidateQueries({ queryKey: ["book-albums"] });
    },
    onError: (err: Error) => {
      toastError(toast, err);
    },
  });
}

interface MediaPickerItem {
  id: string;
  file_url: string;
  file_name: string;
  file_type: "image" | "video" | "video_link" | "audio";
}

export function useAddMediaToAlbum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      albumId,
      items,
    }: {
      albumId: string;
      items: MediaPickerItem[];
    }) => {
      const userId = await getCurrentUserId();

      const compatible = items.filter(
        (m) => m.file_type === "image" || m.file_type === "video"
      );
      if (compatible.length === 0) return [];

      const { data: existing } = await supabase
        .from("book_productions")
        .select("sort_order")
        .eq("album_id", albumId)
        .order("sort_order", { ascending: false })
        .limit(1);
      const startOrder = (existing?.[0]?.sort_order ?? -1) + 1;

      const rows = compatible.map((m, idx) => ({
        album_id: albumId,
        user_id: userId,
        title: m.file_name.replace(/\.[^/.]+$/, ""),
        file_url: m.file_url,
        thumbnail_url: m.file_url,
        file_type: m.file_type as "image" | "video",
        original_filename: m.file_name,
        sort_order: startOrder + idx,
        source_media_id: m.id,
      }));

      const { data, error } = await supabase
        .from("book_productions")
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["book-productions", variables.albumId] });
      queryClient.invalidateQueries({ queryKey: ["book-albums"] });
    },
    onError: (err: Error) => {
      toastError(toast, err, { title: "Erreur ajout depuis la médiathèque" });
    },
  });
}

export function useSetAlbumCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      albumId,
      production,
    }: {
      albumId: string;
      production: BookProduction | null;
    }) => {
      // Store the raw (un-signed) URL: either the media library URL for referenced
      // items, or re-derive the public URL form for items in our private bucket.
      let coverUrl: string | null = null;
      if (production) {
        if (production.source_media_id) {
          coverUrl = production.file_url;
        } else {
          const path = extractStoragePath(production.file_url);
          if (path) {
            const { data: row } = await supabase
              .from("book_productions")
              .select("file_url")
              .eq("id", production.id)
              .maybeSingle();
            coverUrl = row?.file_url ?? production.file_url;
          } else {
            coverUrl = production.file_url;
          }
        }
      }

      const { error } = await supabase
        .from("book_albums")
        .update({ cover_url: coverUrl })
        .eq("id", albumId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book-albums"] });
    },
    onError: (err: Error) => {
      toastError(toast, err);
    },
  });
}

export function useReorderProductions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderedIds,
    }: {
      albumId: string;
      orderedIds: string[];
    }) => {
      const updates = orderedIds.map((id, index) =>
        supabase
          .from("book_productions")
          .update({ sort_order: index })
          .eq("id", id)
      );
      const results = await Promise.all(updates);
      for (const { error } of results) {
        if (error) throw error;
      }
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["book-productions", variables.albumId] });
    },
    onError: (err: Error) => {
      toastError(toast, err);
    },
  });
}

// ---------------------------------------------------------------------------
// Share links
// ---------------------------------------------------------------------------

export function useBookShareLinks(albumId: string) {
  return useQuery<BookShareLink[]>({
    queryKey: ["book-share-links", albumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("book_share_links")
        .select("*")
        .eq("album_id", albumId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BookShareLink[];
    },
    enabled: !!albumId,
  });
}

export function useCreateShareLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      albumId,
      prospectName,
    }: {
      albumId: string;
      prospectName: string;
    }) => {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from("book_share_links")
        .insert({ album_id: albumId, user_id: userId, prospect_name: prospectName })
        .select()
        .single();
      if (error) throw error;
      return data as BookShareLink;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["book-share-links", variables.albumId] });
    },
    onError: (err: Error) => {
      toastError(toast, err);
    },
  });
}

export function useRevokeShareLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; albumId: string }) => {
      const { error } = await supabase
        .from("book_share_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["book-share-links", variables.albumId] });
    },
    onError: (err: Error) => {
      toastError(toast, err);
    },
  });
}

// ---------------------------------------------------------------------------
// Link analytics / stats
// ---------------------------------------------------------------------------

export function useBookLinkStats(albumId: string) {
  return useQuery<BookLinkStats[]>({
    queryKey: ["book-link-stats", albumId],
    queryFn: async () => {
      const { data: links, error: linksError } = await supabase
        .from("book_share_links")
        .select("*")
        .eq("album_id", albumId)
        .order("created_at", { ascending: false });
      if (linksError) throw linksError;

      if (!links || links.length === 0) return [];

      const linkIds = links.map((l) => l.id);

      const { data: events, error: eventsError } = await supabase
        .from("book_analytics_events")
        .select("link_id, event_type, production_id, viewed_at")
        .in("link_id", linkIds);
      if (eventsError) throw eventsError;

      return (links as BookShareLink[]).map((link) => {
        const linkEvents = (events ?? []).filter((e) => e.link_id === link.id);
        const viewedAts = linkEvents.map((e) => e.viewed_at).sort();
        const productionViews = linkEvents
          .filter((e) => e.event_type === "production_view" && e.production_id != null)
          .map((e) => e.production_id as string);
        const uniqueProductionsViewed = [...new Set(productionViews)];

        return {
          link,
          total_views: linkEvents.length,
          first_viewed_at: viewedAts.length > 0 ? viewedAts[0] : null,
          last_viewed_at: viewedAts.length > 0 ? viewedAts[viewedAts.length - 1] : null,
          productions_viewed: uniqueProductionsViewed,
        } satisfies BookLinkStats;
      });
    },
    enabled: !!albumId,
  });
}

// ---------------------------------------------------------------------------
// Public album (no auth)
// ---------------------------------------------------------------------------

interface PublicAlbumResult {
  album: BookAlbum;
  productions: BookProduction[];
  profile: BookProfile | null;
  link: { id: string; prospect_name: string };
}

export function usePublicAlbum(token: string) {
  return useQuery<PublicAlbumResult | null>({
    queryKey: ["book-public", token],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("book-public-album", {
        body: { token },
      });
      if (error) throw error;
      return (data as PublicAlbumResult) ?? null;
    },
    enabled: !!token,
  });
}

// ---------------------------------------------------------------------------
// Record view (silent mutation)
// ---------------------------------------------------------------------------

export function useRecordView() {
  return useMutation({
    mutationFn: async ({
      token,
      productionId,
    }: {
      token: string;
      productionId: string;
    }) => {
      const { error } = await supabase.functions.invoke("book-record-view", {
        body: { token, productionId },
      });
      if (error) throw error;
    },
  });
}
