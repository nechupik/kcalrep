import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  deleteActivityLog,
  loadActivityLogRange,
  saveActivityLog,
  type ActivityLogEntry,
} from "@/lib/firestore";
import { MAX_LOG_KCAL, MAX_LOG_STEPS, parseAmount, recentDates } from "@/lib/activity-log";

const DAYS_SHOWN = 7;

const formatCount = (n: number) => n.toLocaleString("ru-RU");

function dayLabel(date: string, index: number): string {
  if (index === 0) return "Сегодня";
  if (index === 1) return "Вчера";
  return new Date(`${date}T00:00:00`).toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Manual log of burned kcal and steps per day. Stored apart from the Apple Watch `activity` data and never read
 * by the norm calculation: entering values here does not touch КБЖУ. It does show up in the data export.
 */
export const ActivityLogCard = ({ userId }: { userId: string }) => {
  const days = useMemo(() => recentDates(new Date(), DAYS_SHOWN), []);
  const today = days[0];

  const [entries, setEntries] = useState<Record<string, ActivityLogEntry>>({});
  const [loadFailed, setLoadFailed] = useState(false);
  const [date, setDate] = useState(today);
  const [kcal, setKcal] = useState("");
  const [steps, setSteps] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadActivityLogRange(userId, days[days.length - 1], today)
      .then((rows) => {
        if (cancelled) return;
        setEntries(Object.fromEntries(rows.map((row) => [row.date, row])));
        setLoadFailed(false);
      })
      .catch((error) => {
        console.error("Failed to load activity log:", error);
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, days, today]);

  const handleSave = async () => {
    const kcalParsed = parseAmount(kcal, MAX_LOG_KCAL);
    const stepsParsed = parseAmount(steps, MAX_LOG_STEPS);
    if (!kcalParsed.ok) {
      toast.error(`Ккал: введите число от 0 до ${formatCount(MAX_LOG_KCAL)}`);
      return;
    }
    if (!stepsParsed.ok) {
      toast.error(`Шаги: введите число от 0 до ${formatCount(MAX_LOG_STEPS)}`);
      return;
    }
    if (kcalParsed.value === null && stepsParsed.value === null) {
      toast.error("Введите ккал или шаги");
      return;
    }
    if (!date || date > today) {
      toast.error("Выберите дату не позже сегодняшней");
      return;
    }

    const calories = kcalParsed.value ?? undefined;
    const stepCount = stepsParsed.value ?? undefined;
    setSaving(true);
    try {
      await saveActivityLog(userId, { date, calories, steps: stepCount });
      // Mirror the merge the database did: a value left blank keeps what was stored.
      setEntries((prev) => ({
        ...prev,
        [date]: {
          ...prev[date],
          date,
          ...(calories !== undefined && { calories }),
          ...(stepCount !== undefined && { steps: stepCount }),
        } as ActivityLogEntry,
      }));
      toast.success("Активность сохранена");
      setKcal("");
      setSteps("");
      setDate(today);
    } catch (error) {
      console.error("Failed to save activity log:", error);
      toast.error("Ошибка сохранения активности");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (day: string) => {
    try {
      await deleteActivityLog(userId, day);
      setEntries((prev) => {
        const { [day]: _removed, ...rest } = prev;
        return rest;
      });
      toast.success("Запись удалена");
    } catch (error) {
      console.error("Failed to delete activity log entry:", error);
      toast.error("Ошибка удаления записи");
    }
  };

  return (
    <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50 shadow-soft mb-6">
      <h2 className="text-lg font-bold mb-1">Активность и шаги</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Записи для статистики и выгрузки. В расчёт КБЖУ и нормы не входят.
      </p>

      <div className="space-y-3">
        <div className="min-w-0">
          <label htmlFor="activity-log-date" className="text-xs text-muted-foreground mb-1 block pl-[5px]">
            Дата
          </label>
          {/* iOS Safari sizes native date inputs by their content and centres the value; force it into the card. */}
          <Input
            id="activity-log-date"
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-w-0 max-w-full appearance-none text-left [&::-webkit-date-and-time-value]:text-left"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 [&>div]:min-w-0">
          <div>
            <label htmlFor="activity-log-kcal" className="text-xs text-muted-foreground mb-1 block pl-[5px]">
              Активность (ккал)
            </label>
            <Input
              id="activity-log-kcal"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="напр. 450"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="activity-log-steps" className="text-xs text-muted-foreground mb-1 block pl-[5px]">
              Шаги
            </label>
            <Input
              id="activity-log-steps"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="напр. 8000"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || (!kcal.trim() && !steps.trim())}
          className="w-full bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] border-0 text-white hover:opacity-90"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Пустое поле не меняет уже сохранённое значение за этот день.
        </p>
      </div>

      <div className="mt-5 border-t border-border/30 pt-4">
        <div className="text-xs font-medium text-muted-foreground mb-2">Последние {DAYS_SHOWN} дней</div>
        {loadFailed && <p className="text-xs text-destructive mb-2">Не удалось загрузить записи.</p>}
        <ul className="divide-y divide-border/30">
          {days.map((day, index) => {
            const entry = entries[day];
            const hasData = entry?.calories !== undefined || entry?.steps !== undefined;
            return (
              <li key={day} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDate(day)}
                  aria-label={`Внести данные за ${dayLabel(day, index)}`}
                  className={`grid flex-1 min-w-0 grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent/40 ${
                    day === date ? "bg-accent/30" : ""
                  }`}
                >
                  <span className={index === 0 ? "font-medium" : "text-muted-foreground"}>{dayLabel(day, index)}</span>
                  <span className="w-20 text-right tabular-nums">
                    {entry?.calories !== undefined ? `${formatCount(entry.calories)} ккал` : "—"}
                  </span>
                  <span className="w-24 text-right tabular-nums">
                    {entry?.steps !== undefined ? `${formatCount(entry.steps)} шагов` : "—"}
                  </span>
                </button>
                {hasData ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(day)}
                    aria-label={`Удалить запись за ${dayLabel(day, index)}`}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="w-8" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
};
