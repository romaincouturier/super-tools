import { useRef, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useUploadBalanceSheetPDF } from "@/hooks/useBalanceSheets";
import { useExtractBalanceSheet } from "@/hooks/useExtractBalanceSheet";

interface BalanceSheetUploaderProps {
  onUploaded: () => void;
  defaultYear?: number;
}

export default function BalanceSheetUploader({ onUploaded, defaultYear }: BalanceSheetUploaderProps) {
  const { toast } = useToast();
  const upload = useUploadBalanceSheetPDF();
  const { extract, loading: extracting } = useExtractBalanceSheet();
  const [year, setYear] = useState<number>(defaultYear ?? new Date().getFullYear() - 1);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async () => {
    if (!file) return;
    try {
      const uploaded = await upload.mutateAsync({ file, annee: year });
      const result = await extract({
        storage_path: uploaded.storage_path,
        annee: year,
        pdf_filename: uploaded.filename,
      });
      if (result) {
        toast({ title: "Bilan extrait avec succès" });
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        onUploaded();
      }
    } catch (err) {
      toastError(toast, err);
    }
  };

  const busy = upload.isPending || extracting;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Importer un bilan comptable
        </CardTitle>
        <CardDescription>
          PDF d'un bilan annuel (format PCG). L'IA extrait les données chiffrées, tu peux ensuite les corriger
          manuellement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="bs-year">Année du bilan</Label>
            <Input
              id="bs-year"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bs-file">Fichier PDF</Label>
            <Input
              id="bs-file"
              ref={inputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={busy}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleAnalyze} disabled={!file || busy}>
            {busy ? <Spinner className="mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            {upload.isPending ? "Upload..." : extracting ? "Extraction IA..." : "Analyser le bilan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
