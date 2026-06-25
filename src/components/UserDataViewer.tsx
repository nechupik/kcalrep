import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { X, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { loadNorm, loadDiary, loadActivity } from "@/lib/firestore";
import type { MacroResult } from "@/lib/nutrition";
import type { DiaryEntry } from "@/lib/storage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function formatDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface CalendarPickerProps {
  value: string;
  onChange: (date: string) => void;
}

function CalendarPicker({ value, onChange }: CalendarPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = value ? new Date(value + "T00:00:00") : new Date();
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  const today = new Date();
  const todayStr = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const offset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const handlePrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const handleNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleSelectDay = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  const displayDate = value
    ? new Date(value + "T00:00:00").toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "Выберите дату";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="flex items-center gap-2 bg-muted/40 border border-border/50 rounded-lg px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors duration-200"
      >
        <span className="text-card-foreground">{displayDate}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-card border border-border/50 rounded-xl shadow-2xl p-3 w-[260px]">
          {/* Month/year header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="font-semibold text-sm text-card-foreground">
              {MONTHS_RU[viewMonth]} {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                className="p-1 rounded-md hover:bg-muted/50 transition-colors"
              >
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={handleNext}
                className="p-1 rounded-md hover:bg-muted/50 transition-colors"
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS_SHORT.map(d => (
              <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {/* Leading cells from prev month */}
            {Array.from({ length: offset }).map((_, i) => {
              const day = daysInPrevMonth - offset + 1 + i;
              return (
                <div key={`prev-${i}`} className="text-center py-1">
                  <span className="text-xs text-muted-foreground/40">{day}</span>
                </div>
              );
            })}
            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = formatDateStr(viewYear, viewMonth, day);
              const isSelected = dateStr === value;
              const isToday = dateStr === todayStr;
              return (
                <div key={day} className="flex items-center justify-center py-0.5">
                  <button
                    onClick={() => handleSelectDay(dateStr)}
                    className={cn(
                      "h-8 w-8 rounded-full text-xs font-medium transition-all duration-150",
                      isSelected
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/40"
                        : isToday
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted/50 text-card-foreground"
                    )}
                  >
                    {day}
                  </button>
                </div>
              );
            })}
            {/* Trailing cells for next month */}
            {(() => {
              const total = offset + daysInMonth;
              const trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
              return Array.from({ length: trailing }).map((_, i) => (
                <div key={`next-${i}`} className="text-center py-1">
                  <span className="text-xs text-muted-foreground/40">{i + 1}</span>
                </div>
              ));
            })()}
          </div>

          {/* Footer */}
          <div className="flex justify-between mt-3 pt-2 border-t border-border/30">
            <button
              onClick={() => { onChange(''); setIsOpen(false); }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1"
            >
              Удалить
            </button>
            <button
              onClick={() => handleSelectDay(todayStr)}
              className="text-xs text-primary hover:opacity-80 transition-colors px-1"
            >
              Сегодня
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface UserDataViewerProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserName: string;
}

export const UserDataViewer = ({ isOpen, onClose, targetUserId, targetUserName }: UserDataViewerProps) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    return today;
  });
  const [norm, setNorm] = useState<MacroResult | null>(null);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [activity, setActivity] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!isOpen || !targetUserId) return;

      setLoading(true);
      try {
        const [normData, entries, activityData] = await Promise.all([
          loadNorm(targetUserId),
          loadDiary(targetUserId, selectedDate),
          loadActivity(targetUserId, selectedDate),
        ]);

        setNorm(normData);
        setDiaryEntries(entries);
        setActivity(activityData);
      } catch (error) {
        console.error("Error loading user data:", error);
        toast.error("Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, targetUserId, selectedDate]);

  if (!isOpen) return null;

  const totals = diaryEntries.reduce(
    (acc, entry) => ({
      calories: acc.calories + entry.calories,
      protein: acc.protein + entry.protein,
      fat: acc.fat + entry.fat,
      carbs: acc.carbs + entry.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl bg-background border border-border/50 rounded-2xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold">{targetUserName}</h2>
            <p className="text-sm text-muted-foreground">Данные питания</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-muted/50 transition-smooth"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Date selector */}
        <div className="flex items-center gap-2 mb-5">
          <CalendarPicker value={selectedDate} onChange={setSelectedDate} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Norm */}
            {norm && (
              <Card className="p-4 border-border/50 mb-4">
                <h3 className="font-semibold mb-3">Норма КБЖУ</h3>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold">{norm.calories}</div>
                    <div className="text-xs text-muted-foreground">ккал</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">{Math.round(norm.protein)}г</div>
                    <div className="text-xs text-muted-foreground">белки</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">{Math.round(norm.fat)}г</div>
                    <div className="text-xs text-muted-foreground">жиры</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">{Math.round(norm.carbs)}г</div>
                    <div className="text-xs text-muted-foreground">углеводы</div>
                  </div>
                </div>
              </Card>
            )}

            {/* Daily totals */}
            {diaryEntries.length > 0 && (
              <Card className="p-4 border-border/50 mb-4">
                <h3 className="font-semibold mb-3">Съедено за день</h3>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold">{totals.calories}</div>
                    <div className="text-xs text-muted-foreground">ккал</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">{Math.round(totals.protein)}г</div>
                    <div className="text-xs text-muted-foreground">белки</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">{Math.round(totals.fat)}г</div>
                    <div className="text-xs text-muted-foreground">жиры</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">{Math.round(totals.carbs)}г</div>
                    <div className="text-xs text-muted-foreground">углеводы</div>
                  </div>
                </div>
                {norm && (
                  <div className="mt-3 pt-3 border-t text-center">
                    <span className="text-sm">
                      {Math.round((totals.calories / norm.calories) * 100)}% от нормы
                    </span>
                  </div>
                )}
              </Card>
            )}

            {/* Activity */}
            {activity && activity.caloriesBurned > 0 && (
              <Card className="p-4 border-border/50 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{activity.type === 'calories' ? '⌚' : '👣'}</span>
                    <span className="text-sm font-medium">
                      {activity.type === 'calories' ? 'Apple Watch' : 
                       activity.type === 'steps' ? `${activity.value.toLocaleString()} шагов` : 'Дома'}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-green-400">+{activity.caloriesBurned} ккал</span>
                </div>
              </Card>
            )}

            {/* Diary entries */}
            {diaryEntries.length > 0 ? (
              <Card className="p-4 border-border/50">
                <h3 className="font-semibold mb-3">Что съел</h3>
                <div className="space-y-2">
                  {diaryEntries.map((entry) => (
                    <div key={entry.id} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                      <div className="flex-1">
                        <span className="font-medium">{entry.name}</span>
                        <span className="text-muted-foreground ml-2">{entry.grams}г</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {entry.calories} ккал
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <Card className="p-4 border-border/50">
                <p className="text-center text-muted-foreground">
                  Нет записей за этот день
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};
