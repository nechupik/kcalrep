import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, CalendarDays, CalendarRange, Download } from "lucide-react";
import { toast } from "sonner";
import { generateMarkdownReport } from "@/lib/exportReport";

interface ExportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

type ExportMode = "month" | "week" | "custom";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function currentMonthStartStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const ExportDataModal = ({ isOpen, onClose, userId }: ExportDataModalProps) => {
  const [startDate, setStartDate] = useState(currentMonthStartStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [generatingMode, setGeneratingMode] = useState<ExportMode | null>(null);

  const isGenerating = generatingMode !== null;

  const runExport = async (mode: ExportMode, start: string, end: string) => {
    if (!start || !end) {
      toast.error("Выберите период");
      return;
    }
    if (start > end) {
      toast.error("Дата начала позже даты окончания");
      return;
    }

    setGeneratingMode(mode);
    try {
      const { filename, content } = await generateMarkdownReport(userId, start, end);
      downloadMarkdown(filename, content);
      toast.success("Отчёт выгружен");
      onClose();
    } catch (error) {
      console.error("Failed to export data:", error);
      toast.error("Ошибка выгрузки данных");
    } finally {
      setGeneratingMode(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card/95 backdrop-blur-sm border-border/50 max-w-[calc(100%-40px)] rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle>Выгрузка данных</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => runExport("month", currentMonthStartStr(), todayStr())}
              disabled={isGenerating}
              className="w-full justify-start gap-2"
            >
              <Calendar className="h-4 w-4" />
              {generatingMode === "month" ? "Формирование..." : "За текущий месяц"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => runExport("week", daysAgoStr(6), todayStr())}
              disabled={isGenerating}
              className="w-full justify-start gap-2"
            >
              <CalendarDays className="h-4 w-4" />
              {generatingMode === "week" ? "Формирование..." : "За последние 7 дней"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCustomRange((v) => !v)}
              disabled={isGenerating}
              className="w-full justify-start gap-2"
            >
              <CalendarRange className="h-4 w-4" />
              За выбранный период
            </Button>
          </div>

          {showCustomRange && (
            <div className="space-y-3 rounded-xl border border-border/50 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="export-start">С</Label>
                  <Input
                    id="export-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="export-end">По</Label>
                  <Input
                    id="export-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={() => runExport("custom", startDate, endDate)}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] text-foreground hover:opacity-90 border-0 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {generatingMode === "custom" ? "Формирование..." : "Скачать за период"}
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            В отчёт войдут: время приёмов пищи, что съедено по дням, дневные итоги и дефицит калорий, BMR и настройки дефицита по дням, изменение веса и состава тела, активность и TDEE — за выбранный период.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
            className="w-full sm:w-auto"
          >
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
