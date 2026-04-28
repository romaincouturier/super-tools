import { FileText } from "lucide-react";
import { formatFileSize } from "@/lib/file-utils";

interface DepositLike {
  file_url: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_mime?: string | null;
}

interface Props {
  deposit: DepositLike;
}

/**
 * Visual preview for a deposit's uploaded file. Renders an inline image,
 * a native video player or a download link depending on the MIME. Used by
 * both the learner-facing summary and the admin detail drawer to keep the
 * markup in a single place.
 */
export default function DepositFilePreview({ deposit }: Props) {
  if (!deposit.file_url) return null;
  const mime = deposit.file_mime || "";
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const isPdf = mime === "application/pdf";

  return (
    <div className="rounded-md border bg-muted/30 overflow-hidden">
      {isImage ? (
        <img
          src={deposit.file_url}
          alt={deposit.file_name || ""}
          className="w-full h-auto max-h-[420px] object-contain"
        />
      ) : isVideo ? (
        <video src={deposit.file_url} controls className="w-full h-auto max-h-[420px]" />
      ) : (
        <a
          href={deposit.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 hover:bg-muted transition-colors"
        >
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium break-words">{deposit.file_name || "Fichier"}</p>
            {deposit.file_size != null && deposit.file_size > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatFileSize(deposit.file_size)}
                {isPdf ? " · PDF" : ""}
              </p>
            )}
          </div>
        </a>
      )}
    </div>
  );
}
