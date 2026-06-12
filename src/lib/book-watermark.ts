export async function downloadWithWatermark(
  fileUrl: string,
  filename: string,
  watermarkText: string,
): Promise<void> {
  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = fileUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  ctx.drawImage(img, 0, 0);

  const fontSize = Math.max(img.naturalWidth * 0.025, 18);
  ctx.font = `bold ${fontSize}px sans-serif`;

  const padding = fontSize * 0.8;
  const textMetrics = ctx.measureText(watermarkText);
  const textX = canvas.width - textMetrics.width - padding;
  const textY = canvas.height - padding;

  // Dark stroke for contrast
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = fontSize * 0.15;
  ctx.strokeText(watermarkText, textX, textY);

  // White fill
  ctx.fillStyle = '#ffffff';
  ctx.fillText(watermarkText, textX, textY);

  ctx.globalAlpha = 1;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/jpeg', 0.92);
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
