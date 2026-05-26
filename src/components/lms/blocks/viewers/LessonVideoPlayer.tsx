import type { CSSProperties } from "react";

interface Props {
  url: string;
  /** Border radius applied to the video frame (default 8px). */
  radius?: number;
  /** Optional container style (background, padding, outer radius) for "styled" variants. */
  containerStyle?: CSSProperties;
  /** Max width in px on desktop. Defaults to 900. */
  maxWidth?: number;
}

/**
 * Unified video player for lesson blocks.
 *
 * Guarantees a consistent rendering across every block type (video, exercise,
 * etc.): max-width 900px, centered, 16:9 ratio, full width on mobile.
 * Do NOT inline iframes/videos elsewhere — always go through this component.
 */
export default function LessonVideoPlayer({ url, radius = 8, containerStyle, maxWidth = 900 }: Props) {
  if (!url) return null;
  const isYouTube = url.includes("youtube") || url.includes("youtu.be");
  const isVimeo = url.includes("vimeo");
  const borderRadius = `${radius}px`;

  const player = (
    <div className="aspect-video w-full bg-muted" style={{ borderRadius, overflow: "hidden" }}>
      {isYouTube ? (
        <iframe
          src={url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ borderRadius, border: 0 }}
        />
      ) : isVimeo ? (
        <iframe
          src={url.replace("vimeo.com/", "player.vimeo.com/video/")}
          className="w-full h-full"
          allow="autoplay; fullscreen"
          allowFullScreen
          style={{ borderRadius, border: 0 }}
        />
      ) : (
        <video src={url} controls className="w-full h-full" style={{ borderRadius }} />
      )}
    </div>
  );

  return (
    <div className="w-full mx-auto" style={{ maxWidth: `${maxWidth}px` }}>
      {containerStyle ? <div style={containerStyle}>{player}</div> : player}
    </div>
  );
}
