export interface ExifData {
  exif_date: string | null;
  exif_width: number | null;
  exif_height: number | null;
}

export async function extractExifData(file: File): Promise<ExifData> {
  const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
  const exif_date = dateMatch ? dateMatch[1] : null;

  const { exif_width, exif_height } = await new Promise<{
    exif_width: number | null;
    exif_height: number | null;
  }>((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({ exif_width: null, exif_height: null });
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || null;
      const h = img.naturalHeight || null;
      URL.revokeObjectURL(url);
      resolve({ exif_width: w, exif_height: h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ exif_width: null, exif_height: null });
    };
    img.src = url;
  });

  return { exif_date, exif_width, exif_height };
}
