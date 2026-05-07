import type { VideoBlockContent } from "@/types/lms-blocks";

interface Props {
  content: VideoBlockContent;
}

function VideoEmbed({ url, videoRadius }: { url: string; videoRadius: number }) {
  const isYouTube = url.includes("youtube") || url.includes("youtu.be");
  const isVimeo = url.includes("vimeo");
  const borderRadius = `${videoRadius}px`;
  const overflowStyle: React.CSSProperties = { borderRadius, overflow: "hidden" };

  return (
    <div className="aspect-video w-full" style={overflowStyle}>
      {isYouTube ? (
        <iframe
          src={url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ borderRadius }}
        />
      ) : isVimeo ? (
        <iframe
          src={url.replace("vimeo.com/", "player.vimeo.com/video/")}
          className="w-full h-full"
          allow="autoplay; fullscreen"
          allowFullScreen
          style={{ borderRadius }}
        />
      ) : (
        <video src={url} controls className="w-full h-full" style={{ borderRadius }} />
      )}
    </div>
  );
}

export default function VideoBlockViewer({ content }: Props) {
  const url = content.url;
  if (!url) return null;

  const isStyled = content.display_style === "styled";

  if (!isStyled) {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
        <VideoEmbed url={url} videoRadius={8} />
      </div>
    );
  }

  const containerRadius = content.container_radius ?? 20;
  const videoRadius = content.video_radius ?? 20;
  const padding = content.padding ?? 24;
  const bgColor = content.bg_color || "#FFD100";

  const containerStyle: React.CSSProperties = {
    backgroundColor: bgColor,
    borderRadius: `${containerRadius}px`,
    padding: `${padding}px`,
  };

  return (
    <div style={containerStyle} className="w-full">
      <VideoEmbed url={url} videoRadius={videoRadius} />
    </div>
  );
}
