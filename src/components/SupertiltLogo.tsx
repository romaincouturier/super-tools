import * as React from "react";

import supertiltLogoJpg from "@/assets/supertilt-logo-anthracite.jpg";
import { cn } from "@/lib/utils";

type Props = {
  /** Height in Tailwind classes (e.g. "h-10"). Defaults to "h-10" */
  className?: string;
  /**
   * When true, applies the same treatment as the old header logo (white on dark background).
   * Uses CSS filter on the already-background-removed image.
   */
  invert?: boolean;
  alt?: string;
};

function removeNearWhiteBackground(data: ImageData, threshold = 245) {
  const d = data.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];

    // Luma (perceived brightness)
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    if (luma >= threshold) {
      // Soft edge: keep a little alpha for pixels just below pure white
      const alpha = Math.max(0, Math.min(255, (threshold + 10 - luma) * 25.5));
      d[i + 3] = alpha;
    }
  }

  return data;
}

export default function SupertiltLogo({
  className,
  invert = false,
  alt = "SuperTilt",
}: Props) {
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const img = new Image();
    img.decoding = "async";
    img.src = supertiltLogoJpg;

    img.onload = () => {
      if (cancelled) return;

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.putImageData(removeNearWhiteBackground(imageData), 0, 0);

      const png = canvas.toDataURL("image/png");
      if (!cancelled) setSrc(png);
    };

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <img
      src={src ?? supertiltLogoJpg}
      alt={alt}
      className={cn(
        "w-auto object-contain transition-opacity",
        src ? "opacity-100" : "opacity-0",
        invert && "brightness-0 invert",
        className ?? "h-10",
      )}
      loading="eager"
      decoding="async"
    />
  );
}
