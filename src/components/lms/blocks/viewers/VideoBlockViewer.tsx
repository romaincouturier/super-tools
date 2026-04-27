import type { VideoBlockContent } from "@/types/lms-blocks";

interface Props {
  content: VideoBlockContent;
}

export default function VideoBlockViewer({ content }: Props) {
  const url = content.url;
  if (!url) return null;
  const isYouTube = url.includes("youtube") || url.includes("youtu.be");
  const isVimeo = url.includes("vimeo");
  return (
    <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
      {isYouTube ? (
        <iframe
          src={url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : isVimeo ? (
        <iframe
          src={url.replace("vimeo.com/", "player.vimeo.com/video/")}
          className="w-full h-full"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      ) : (
        <video src={url} controls className="w-full h-full" />
      )}
    </div>
  );
}
