import type { VideoBlockContent } from "@/types/lms-blocks";
import LessonVideoPlayer from "./LessonVideoPlayer";

interface Props {
  content: VideoBlockContent;
}

export default function VideoBlockViewer({ content }: Props) {
  const url = content.url;
  if (!url) return null;

  const isStyled = content.display_style === "styled";

  if (!isStyled) {
    return <LessonVideoPlayer url={url} radius={8} />;
  }

  const containerRadius = content.container_radius ?? 20;
  const videoRadius = content.video_radius ?? 20;
  const padding = content.padding ?? 24;
  const bgColor = content.bg_color || "#FFD100";

  return (
    <LessonVideoPlayer
      url={url}
      radius={videoRadius}
      containerStyle={{
        backgroundColor: bgColor,
        borderRadius: `${containerRadius}px`,
        padding: `${padding}px`,
      }}
    />
  );
}
