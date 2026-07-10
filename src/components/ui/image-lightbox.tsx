import { useCallback, useEffect } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/file-utils";
import { toast } from "@/lib/toast";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
  rotation?: number;
}

const ImageLightbox = ({ src, alt, onClose, rotation = 0 }: ImageLightboxProps) => {
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  const isRotated = normalizedRotation % 180 === 90;
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleDownload = async () => {
    try {
      const fileName = alt || src.split("/").pop() || "image";
      await downloadFile(src, fileName);
    } catch {
      toast.error("Erreur lors du téléchargement");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-white hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
        >
          <Download className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <img
        src={src}
        alt={alt || "Image"}
        className="rounded-lg shadow-2xl"
        style={{
          maxWidth: isRotated ? "90vh" : "90vw",
          maxHeight: isRotated ? "90vw" : "90vh",
          objectFit: "contain",
          transform: `rotate(${normalizedRotation}deg)`,
          transformOrigin: "center center",
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

export default ImageLightbox;
