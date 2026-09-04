import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, CalendarDays, CalendarRange, Download } from "lucide-react";
import { toast } from "sonner";
import { generateMarkdownReport } from "@/lib/exportReport";

interface ExportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

type ExportMode = "month" | "week" | "custom";

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(days: number): Date {
  const d = today();
  d.setDate(d.getDate() - days);
  return d;
}

function currentMonthStart(): Date {
  const d = today();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateRu(date: Date): string {
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
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
  const [range, setRange] = useState<DateRange | undefined>({
    from: currentMonthStart(),
    to: today(),
  });
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const [generatingMode, setGeneratingMode] = useState<ExportMode | null>(null);

  const isGenerating = generatingMode !== null;

  const runExport = async (mode: ExportMode, start: string, end: string) => {
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

  const handleCustomRangeExport = () => {
    if (!range?.from || !range?.to) {
      toast.error("Выберите период");
      return;
    }
    runExport("custom", toDateStr(range.from), toDateStr(range.to));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card/95 backdrop-blur-sm border-border/50 max-w-[calc(100%-40px)] sm:max-w-md rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle>Выгрузка данных</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => runExport("month", toDateStr(currentMonthStart()), toDateStr(today()))}
              disabled={isGenerating}
              className="w-full justify-start gap-2"
            >
              <CalendarIcon className="h-4 w-4" />
              {generatingMode === "month" ? "Формирование..." : "За текущий месяц"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => runExport("week", toDateStr(daysAgo(6)), toDateStr(today()))}
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
              <Popover open={rangePickerOpen} onOpenChange={setRangePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isGenerating}
                    className="w-full justify-start gap-2 font-normal"
                  >
                    <CalendarIcon className="h-4 w-4 shrink-0" />
                    {range?.from && range?.to
                      ? `${formatDateRu(range.from)} – ${formatDateRu(range.to)}`
                      : "Выберите период"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    locale={ru}
                    selected={range}
                    onSelect={setRange}
                    defaultMonth={range?.from}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                onClick={handleCustomRangeExport}
                disabled={isGenerating || !range?.from || !range?.to}
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
