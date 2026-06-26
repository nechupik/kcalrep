import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Weight, TrendingDown, TrendingUp, Minus, Trash2, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN_UID } from "@/lib/config";
import { loadWeight, saveWeight, deleteWeightEntry, loadFullNormData, saveNorm as saveNormToFirestore, loadActivityRange, loadUserSettings } from "@/lib/firestore";
import {
  saveBodyComposition,
  loadBodyComposition,
} from "@/lib/metabolic-firestore";
import type { BodyCompositionEntry } from "@/lib/metabolic-types";
import { recalculateNormWithNewWeight, recalculateNormWithBodyComposition, calculateMacrosWithWatchTDEE } from "@/lib/nutrition";
import { toast } from "sonner";

interface WeightData {
  id: string;
  weight: number;
  date: string;
}

const SWIPE_THRESHOLD = 80;

function WeightHistoryRow({
  entry,
  idx,
  allEntries,
  bodyComp,
  deletingId,
  onDelete,
}: {
  entry: WeightData;
  idx: number;
  allEntries: WeightData[];
  bodyComp?: BodyCompositionEntry;
  deletingId: string | null;
  onDelete: (id: string) => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isDragging.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    // Only swipe horizontally
    if (!isDragging.current && Math.abs(dy) > Math.abs(dx)) return;
    isDragging.current = true;
    if (swiped) {
      // Already swiped open — allow closing by swiping right
      setOffsetX(Math.max(-SWIPE_THRESHOLD, Math.min(0, -SWIPE_THRESHOLD + (dx > 0 ? dx : 0))));
    } else {
      setOffsetX(Math.min(0, Math.max(-SWIPE_THRESHOLD, dx)));
    }
  }, [swiped]);

  const handleTouchEnd = useCallback(() => {
    if (offsetX < -SWIPE_THRESHOLD / 2) {
      setOffsetX(-SWIPE_THRESHOLD);
      setSwiped(true);
    } else {
      setOffsetX(0);
      setSwiped(false);
    }
  }, [offsetX]);

  const handleDeleteClick = () => {
    setOffsetX(0);
    setSwiped(false);
    onDelete(entry.id);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Red delete zone behind — only visible during swipe */}
      <div className={`absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 w-20 rounded-r-xl ${offsetX >= 0 ? 'hidden' : ''}`}>
        <button
          onClick={handleDeleteClick}
          disabled={deletingId === entry.id}
          className="flex items-center justify-center w-full h-full text-white disabled:opacity-50"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* Sliding content */}
      <div
        className="relative flex items-center justify-between bg-[hsl(var(--card))] px-4 py-3 group transition-transform"
        style={{
          transform: `translateX(${offsetX}px)`,
          transitionDuration: isDragging.current ? '0ms' : '650ms',
          transitionTimingFunction: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">
            {new Date(entry.date).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
            })}
          </span>
          {bodyComp && (
            <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
              {bodyComp.bodyFatPercent != null && <span>Жир {bodyComp.bodyFatPercent}%</span>}
              {bodyComp.lbmKg != null && <span>ЛБМ {bodyComp.lbmKg}кг</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="font-bold">{entry.weight} кг</span>
            {idx < allEntries.length - 1 && (
              <div className={`text-xs ${
                entry.weight < allEntries[idx + 1].weight
                  ? "text-green-400"
                  : entry.weight > allEntries[idx + 1].weight
                  ? "text-red-400"
                  : "text-muted-foreground"
              }`}>
                {entry.weight < allEntries[idx + 1].weight ? (
                  <span className="flex items-center justify-end gap-0.5">
                    <TrendingDown className="h-3 w-3" />
                    {(allEntries[idx + 1].weight - entry.weight).toFixed(1)}
                  </span>
                ) : entry.weight > allEntries[idx + 1].weight ? (
                  <span className="flex items-center justify-end gap-0.5">
                    <TrendingUp className="h-3 w-3" />
                    +{(entry.weight - allEntries[idx + 1].weight).toFixed(1)}
                  </span>
                ) : (
                  <span className="flex items-center justify-end gap-0.5">
                    <Minus className="h-3 w-3" />
                    0
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Desktop hover delete */}
          <button
            onClick={() => onDelete(entry.id)}
            disabled={deletingId === entry.id}
            className="hidden sm:block p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

const Body = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Weight
  const [weightEntries, setWeightEntries] = useState<WeightData[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [lastWeightPlaceholder, setLastWeightPlaceholder] = useState("75");

  // Body composition
  const [bodyCompEntries, setBodyCompEntries] = useState<BodyCompositionEntry[]>([]);
  const [bodyFatInput, setBodyFatInput] = useState("");
  const [lbmInput, setLbmInput] = useState("");
  const [bmrScaleInput, setBmrScaleInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const [weights, bodyComp] = await Promise.all([
          loadWeight(user.uid, 200),
          loadBodyComposition(user.uid, 200),
        ]);
        setWeightEntries(weights);
        setBodyCompEntries(bodyComp);
        if (weights.length > 0) {
          setLastWeightPlaceholder(String(weights[0].weight));
        }
      } catch (error) {
        console.error("Failed to load body data:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleSaveWeight = async () => {
    if (!user || !weightInput) return;
    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight <= 0) return;

    setSaving(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      await saveWeight(user.uid, weight, today);

      // Save body composition if any fields are filled
      const hasBodyComp = bodyFatInput || lbmInput || bmrScaleInput;
      if (hasBodyComp) {
        await saveBodyComposition(user.uid, {
          date: today,
          weight,
          bodyFatPercent: bodyFatInput ? parseFloat(bodyFatInput) : undefined,
          lbmKg: lbmInput ? parseFloat(lbmInput) : undefined,
          bmrFromScale: bmrScaleInput ? parseFloat(bmrScaleInput) : undefined,
        });
      }

      // Reload data
      const [weights, bodyComp] = await Promise.all([
        loadWeight(user.uid, 200),
        loadBodyComposition(user.uid, 200),
      ]);
      setWeightEntries(weights);
      setBodyCompEntries(bodyComp);

      // Auto-recalculate norm
      const currentNormData = await loadFullNormData(user.uid);
      if (currentNormData && currentNormData.gender) {
        let newNormResult;

        if (user.uid === ADMIN_UID) {
          // Admin: use Apple Watch 7-day avg for TDEE
          const today = new Date();
          const endDate = today.toISOString().split('T')[0];
          const startDay = new Date(today);
          startDay.setDate(today.getDate() - 6);
          const startDateStr = startDay.toISOString().split('T')[0];

          const [activityEntries, settings] = await Promise.all([
            loadActivityRange(user.uid, startDateStr, endDate),
            loadUserSettings(user.uid),
          ]);
          const avg = activityEntries.length > 0
            ? Math.round(activityEntries.reduce((sum, e) => sum + e.caloriesBurned, 0) / activityEntries.length)
            : 0;
          const deficitPercent = settings?.deficitPercent ?? 10;

          // Prioritize bmrFromScale: input field → latest saved entry → Mifflin
          const bmrScaleVal = bmrScaleInput ? parseFloat(bmrScaleInput) : null;
          const bmrFromSaved = bodyComp.length > 0 && bodyComp[0].bmrFromScale && bodyComp[0].bmrFromScale > 0
            ? bodyComp[0].bmrFromScale
            : null;
          const bmr = (bmrScaleVal && bmrScaleVal > 0)
            ? bmrScaleVal
            : bmrFromSaved ?? (currentNormData.gender === 'male'
              ? 10 * weight + 6.25 * currentNormData.height - 5 * currentNormData.age + 5
              : 10 * weight + 6.25 * currentNormData.height - 5 * currentNormData.age - 161);

          newNormResult = calculateMacrosWithWatchTDEE(
            bmr, avg, deficitPercent, weight,
            currentNormData.gender, currentNormData.height,
            bodyFatInput ? parseFloat(bodyFatInput) : undefined,
            lbmInput ? parseFloat(lbmInput) : undefined
          );
        } else {
          const bodyCompForCalc = {
            bodyFatPercent: bodyFatInput ? parseFloat(bodyFatInput) : undefined,
            lbmKg: lbmInput ? parseFloat(lbmInput) : undefined,
            bmrFromScale: bmrScaleInput ? parseFloat(bmrScaleInput) : undefined,
          };
          const hasBodyComp = Object.values(bodyCompForCalc).some((v) => v != null);
          newNormResult = hasBodyComp
            ? recalculateNormWithBodyComposition(currentNormData, weight, bodyCompForCalc)
            : recalculateNormWithNewWeight(currentNormData, weight);
        }

        await saveNormToFirestore(user.uid, newNormResult, {
          gender: currentNormData.gender,
          height: currentNormData.height,
          age: currentNormData.age,
          goal: currentNormData.goal,
        });
        toast.success(`Вес сохранён. Норма КБЖУ: ${newNormResult.calories} ккал`);
      } else {
        toast.success("Вес сохранён");
      }

      // Reset inputs
      setWeightInput("");
      setBodyFatInput("");
      setLbmInput("");
      setBmrScaleInput("");
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWeight = async (entryId: string) => {
    if (!user) return;
    setDeletingId(entryId);
    try {
      await deleteWeightEntry(user.uid, entryId);
      const weights = await loadWeight(user.uid, 200);
      setWeightEntries(weights);
      toast.success("Запись удалена");
    } catch (error) {
      console.error("Failed to delete:", error);
      toast.error("Ошибка удаления");
    } finally {
      setDeletingId(null);
    }
  };

  // Weight chart data
  const weightChartData = useMemo(() => {
    return weightEntries
      .slice(0, 15)
      .reverse()
      .map((entry) => ({
        date: new Date(entry.date).toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
        }),
        weight: entry.weight,
      }));
  }, [weightEntries]);

  // Body comp chart data
  const bodyCompChartData = useMemo(() => {
    return bodyCompEntries
      .filter((e) => e.bodyFatPercent != null)
      .slice(0, 15)
      .reverse()
      .map((entry) => ({
        date: new Date(entry.date).toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
        }),
        bodyFat: entry.bodyFatPercent,
        lbm: entry.lbmKg,
      }));
  }, [bodyCompEntries]);

  // Weight trend
  const weightTrend = useMemo(() => {
    if (weightEntries.length < 2) return null;
    const diff = weightEntries[0].weight - weightEntries[1].weight;
    return { diff, direction: diff > 0 ? "up" : diff < 0 ? "down" : "same" };
  }, [weightEntries]);

  // Latest body comp
  const latestBodyComp = bodyCompEntries.length > 0 ? bodyCompEntries[0] : null;

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="container max-w-5xl pt-6 pb-12">
          <div className="text-center text-muted-foreground">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />

      <section className="container max-w-5xl pt-6 pb-12 space-y-4">
        {/* Weight Input */}
        <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="font-semibold">Записать вес</h2>
          </div>

          <div className="space-y-3">
            {user?.uid === ADMIN_UID ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block pl-[5px]">Вес (кг)</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="0"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value.replace(",", "."))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block pl-[5px]">% жира</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="напр. 28.5"
                    value={bodyFatInput}
                    onChange={(e) => setBodyFatInput(e.target.value.replace(",", "."))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block pl-[5px]">Безжировая масса (кг)</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="напр. 52.0"
                    value={lbmInput}
                    onChange={(e) => setLbmInput(e.target.value.replace(",", "."))}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block pl-[5px]">BMR с весов</label>
                  <Input
                    type="number"
                    step="1"
                    placeholder="ккал"
                    value={bmrScaleInput}
                    onChange={(e) => setBmrScaleInput(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <Input
                type="number"
                step="0.1"
                placeholder="0"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value.replace(",", "."))}
              />
            )}

            <Button
              onClick={handleSaveWeight}
              disabled={!weightInput || saving}
              className="w-full flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] px-8 py-4 text-foreground font-bold text-lg shadow-glow hover:opacity-90 transition-smooth"
            >
              {saving ? "Сохраняю..." : "Сохранить"}
            </Button>
          </div>
        </Card>

        {/* Current Stats */}
        {(weightEntries.length > 0 || latestBodyComp) && (
          <div className="grid grid-cols-2 gap-3">
            {/* Current weight */}
            <Card className="p-4 bg-card/80 backdrop-blur-sm border-border/50">
              <div className="text-xs text-muted-foreground mb-1">Текущий вес</div>
              <div className="text-2xl font-bold">
                {weightEntries[0]?.weight} кг
              </div>
              {weightTrend && weightTrend.diff !== 0 && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${
                  weightTrend.direction === "down" ? "text-green-400" : "text-red-400"
                }`}>
                  {weightTrend.direction === "down" ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <TrendingUp className="h-3 w-3" />
                  )}
                  {Math.abs(weightTrend.diff).toFixed(1)} кг
                </div>
              )}
            </Card>

            {/* Body fat — admin only */}
            {user?.uid === ADMIN_UID && latestBodyComp?.bodyFatPercent != null && (
              <Card className="p-4 bg-card/80 backdrop-blur-sm border-border/50">
                <div className="text-xs text-muted-foreground mb-1">% жира</div>
                <div className="text-2xl font-bold">
                  {latestBodyComp.bodyFatPercent}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(latestBodyComp.date).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "short",
                  })}
                </div>
              </Card>
            )}

            {/* Lean body mass — admin only */}
            {user?.uid === ADMIN_UID && latestBodyComp?.lbmKg != null && (
              <Card className="p-4 bg-card/80 backdrop-blur-sm border-border/50">
                <div className="text-xs text-muted-foreground mb-1">Безжировая масса</div>
                <div className="text-2xl font-bold">
                  {latestBodyComp.lbmKg} кг
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Weight Chart */}
        {weightChartData.length > 1 && (
          <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="font-semibold">График веса</h2>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} domain={['dataMin - 1', 'dataMax + 1']} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.75rem",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="hsl(var(--foreground))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--foreground))", r: 3 }}
                    name="Вес (кг)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Body Composition Chart — admin only */}
        {user?.uid === ADMIN_UID && bodyCompChartData.length > 1 && (
          <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
            <h2 className="font-semibold mb-4">Состав тела</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bodyCompChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.75rem",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="bodyFat"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={{ fill: "#f97316", r: 3 }}
                    name="% жира"
                  />
                  {bodyCompChartData.some((d) => d.lbm != null) && (
                    <Line
                      type="monotone"
                      dataKey="lbm"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ fill: "#22c55e", r: 3 }}
                      name="Безжировая масса (кг)"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* History */}
        <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
          <h2 className="font-semibold mb-3">История записей</h2>
          {weightEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Нет данных. Запишите свой вес.
            </p>
          ) : (
            <>
              {/* First 5 entries always visible */}
              <div className="space-y-2">
                {weightEntries.slice(0, 5).map((entry, idx) => {
                  const bc = user?.uid === ADMIN_UID ? bodyCompEntries.find((b) => b.date === entry.date) : undefined;
                  return (
                    <WeightHistoryRow
                      key={entry.id}
                      entry={entry}
                      idx={idx}
                      allEntries={weightEntries}
                      bodyComp={bc}
                      deletingId={deletingId}
                      onDelete={handleDeleteWeight}
                    />
                  );
                })}
              </div>

              {/* Expandable section: next 10 entries per page */}
              {weightEntries.length > 5 && (
                <>
                  <button
                    onClick={() => { setShowMore(!showMore); setHistoryPage(0); }}
                    className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mt-3 py-2"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                    {showMore ? 'Скрыть' : `Ещё ${weightEntries.length - 5} записей`}
                  </button>

                  {showMore && (
                    <>
                      <div className="space-y-2 mt-2">
                        {weightEntries.slice(5 + historyPage * 10, 5 + (historyPage + 1) * 10).map((entry, i) => {
                          const globalIdx = 5 + historyPage * 10 + i;
                          const bc = user?.uid === ADMIN_UID ? bodyCompEntries.find((b) => b.date === entry.date) : undefined;
                          return (
                            <WeightHistoryRow
                              key={entry.id}
                              entry={entry}
                              idx={globalIdx}
                              allEntries={weightEntries}
                              bodyComp={bc}
                              deletingId={deletingId}
                              onDelete={handleDeleteWeight}
                            />
                          );
                        })}
                      </div>

                      {/* Pagination */}
                      {weightEntries.length - 5 > 10 && (
                        <div className="flex items-center justify-center gap-3 mt-3">
                          <button
                            onClick={() => setHistoryPage(Math.max(0, historyPage - 1))}
                            disabled={historyPage === 0}
                            className="p-1.5 rounded-lg hover:bg-muted/50 disabled:opacity-30 transition-colors"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {historyPage + 1} / {Math.ceil((weightEntries.length - 5) / 10)}
                          </span>
                          <button
                            onClick={() => setHistoryPage(Math.min(Math.ceil((weightEntries.length - 5) / 10) - 1, historyPage + 1))}
                            disabled={5 + (historyPage + 1) * 10 >= weightEntries.length}
                            className="p-1.5 rounded-lg hover:bg-muted/50 disabled:opacity-30 transition-colors"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </Card>
      </section>
    </div>
  );
};

export default Body;
