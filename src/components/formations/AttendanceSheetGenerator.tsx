import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import supertiltLogoJpg from "@/assets/supertilt-logo-anthracite.jpg";
import signatureImage from "@/assets/signature-formateur.jpg";

interface Schedule {
  day_date: string;
  start_time: string;
  end_time: string;
}

interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface AttendanceSheetGeneratorProps {
  trainingName: string;
  trainerName: string;
  location: string;
  startDate: string;
  endDate: string | null;
  schedules: Schedule[];
  participants: Participant[];
}

export default function AttendanceSheetGenerator({
  trainingName,
  trainerName,
  location,
  startDate,
  endDate,
  schedules,
  participants,
}: AttendanceSheetGeneratorProps) {
  const [generating, setGenerating] = useState(false);

  const generateHalfDayColumns = (): { label: string; date: string; period: "AM" | "PM" }[] => {
    const start = parseISO(startDate);
    const end = endDate ? parseISO(endDate) : start;
    const days = eachDayOfInterval({ start, end });

    const columns: { label: string; date: string; period: "AM" | "PM" }[] = [];

    days.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const schedule = schedules.find((s) => s.day_date === dateStr);

      if (schedule) {
        const startHour = parseInt(schedule.start_time.split(":")[0], 10);
        const endHour = parseInt(schedule.end_time.split(":")[0], 10);

        // Morning session (before 12:00)
        if (startHour < 12) {
          columns.push({
            label: format(day, "dd/MM", { locale: fr }) + " Matin",
            date: dateStr,
            period: "AM",
          });
        }

        // Afternoon session (after 12:00)
        if (endHour > 12 || (endHour === 12 && parseInt(schedule.end_time.split(":")[1], 10) > 0)) {
          columns.push({
            label: format(day, "dd/MM", { locale: fr }) + " Après-midi",
            date: dateStr,
            period: "PM",
          });
        }
      } else {
        // Default: full day with AM and PM
        columns.push({
          label: format(day, "dd/MM", { locale: fr }) + " Matin",
          date: dateStr,
          period: "AM",
        });
        columns.push({
          label: format(day, "dd/MM", { locale: fr }) + " Après-midi",
          date: dateStr,
          period: "PM",
        });
      }
    });

    return columns;
  };

  const loadImageAsBase64 = (src: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg"));
      };
      img.onerror = reject;
      img.src = src;
    });
  };

  const generatePDF = async () => {
    setGenerating(true);

    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;

      // Load images
      const [logoBase64, signatureBase64] = await Promise.all([
        loadImageAsBase64(supertiltLogoJpg),
        loadImageAsBase64(signatureImage),
      ]);

      // Add logo
      doc.addImage(logoBase64, "JPEG", margin, 10, 40, 15);

      // Title
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Feuille d'émargement", pageWidth / 2, 20, { align: "center" });

      // Training info
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      let yPos = 35;

      doc.setFont("helvetica", "bold");
      doc.text("Organisme de formation :", margin, yPos);
      doc.setFont("helvetica", "normal");
      doc.text("SuperTilt", margin + 50, yPos);

      yPos += 6;
      doc.setFont("helvetica", "bold");
      doc.text("Formation :", margin, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(trainingName, margin + 50, yPos);

      yPos += 6;
      doc.setFont("helvetica", "bold");
      doc.text("Dates :", margin, yPos);
      doc.setFont("helvetica", "normal");
      const start = parseISO(startDate);
      const dateText = endDate
        ? `Du ${format(start, "d MMMM yyyy", { locale: fr })} au ${format(parseISO(endDate), "d MMMM yyyy", { locale: fr })}`
        : format(start, "d MMMM yyyy", { locale: fr });
      doc.text(dateText, margin + 50, yPos);

      yPos += 6;
      doc.setFont("helvetica", "bold");
      doc.text("Lieu :", margin, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(location, margin + 50, yPos);

      yPos += 6;
      doc.setFont("helvetica", "bold");
      doc.text("Formateur :", margin, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(trainerName, margin + 50, yPos);

      // Table
      yPos += 12;

      const halfDayColumns = generateHalfDayColumns();
      const colCount = 2 + halfDayColumns.length; // Nom, Prénom, + half-days

      const tableWidth = pageWidth - 2 * margin;
      const nameColWidth = 50;
      const firstNameColWidth = 40;
      const signatureColWidth = (tableWidth - nameColWidth - firstNameColWidth) / halfDayColumns.length;

      const rowHeight = 12;
      const headerHeight = 10;

      // Table header
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos, tableWidth, headerHeight, "F");
      doc.setDrawColor(0);
      doc.rect(margin, yPos, tableWidth, headerHeight, "S");

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");

      let xPos = margin;
      doc.text("Nom", xPos + 2, yPos + 7);
      doc.line(xPos + nameColWidth, yPos, xPos + nameColWidth, yPos + headerHeight);

      xPos += nameColWidth;
      doc.text("Prénom", xPos + 2, yPos + 7);
      doc.line(xPos + firstNameColWidth, yPos, xPos + firstNameColWidth, yPos + headerHeight);

      xPos += firstNameColWidth;
      halfDayColumns.forEach((col) => {
        // Split text to fit in column
        const text = col.label.replace(" ", "\n");
        doc.setFontSize(7);
        doc.text(text, xPos + signatureColWidth / 2, yPos + 4, { align: "center" });
        doc.line(xPos + signatureColWidth, yPos, xPos + signatureColWidth, yPos + headerHeight);
        xPos += signatureColWidth;
      });

      yPos += headerHeight;

      // Table rows
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      // If no participants, add empty rows
      const displayParticipants = participants.length > 0 ? participants : Array(8).fill({ first_name: "", last_name: "", email: "" });

      displayParticipants.forEach((participant) => {
        doc.rect(margin, yPos, tableWidth, rowHeight, "S");

        xPos = margin;
        doc.text(participant.last_name || "", xPos + 2, yPos + 8);
        doc.line(xPos + nameColWidth, yPos, xPos + nameColWidth, yPos + rowHeight);

        xPos += nameColWidth;
        doc.text(participant.first_name || "", xPos + 2, yPos + 8);
        doc.line(xPos + firstNameColWidth, yPos, xPos + firstNameColWidth, yPos + rowHeight);

        xPos += firstNameColWidth;
        halfDayColumns.forEach(() => {
          doc.line(xPos + signatureColWidth, yPos, xPos + signatureColWidth, yPos + rowHeight);
          xPos += signatureColWidth;
        });

        yPos += rowHeight;
      });

      // Trainer signature section
      yPos += 10;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Signature du formateur :", margin, yPos);

      // Add signature image
      doc.addImage(signatureBase64, "JPEG", margin, yPos + 2, 40, 20);

      // Download and open print dialog using iframe instead of window.open (avoids popup blockers)
      const pdfBlob = doc.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Create hidden iframe for printing
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.src = pdfUrl;
      
      document.body.appendChild(iframe);
      
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print();
          // Clean up after a delay
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(pdfUrl);
          }, 1000);
        }, 500);
      };
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setGenerating(false);
    }
  };

  const isDisabled = generating || participants.length === 0;

  return (
    <Button 
      variant="outline" 
      onClick={generatePDF} 
      disabled={isDisabled}
      title={participants.length === 0 ? "Ajoutez des participants pour générer la feuille" : undefined}
    >
      {generating ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <FileText className="h-4 w-4 mr-2" />
      )}
      Générer la feuille d'émargement
    </Button>
  );
}
