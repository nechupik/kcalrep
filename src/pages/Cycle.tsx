import { useEffect, useState, useMemo, useCallback } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Activity, ShieldAlert, Plus, Edit, Trash2, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  saveCycleEntry,
  updateCycleEntry,
  deleteCycleEntry,
  loadCycles,
  saveDailySurvey,
  loadDailySurvey,
  loadMetabolicConfig,
  saveMetabolicConfig,
} from "@/lib/metabolic-firestore";
import {
  getCurrentCycleState,
  predictNextCycle,
  computeMacroAdjustment,
  shouldShowAntiPanic,
  updateSymptomMap,
  recalculateMetabolicConfig,
  calculateCycleDurations,
  getCycleDay,
} from "@/lib/cycle-engine";
import {
  loadBodyComposition,
} from "@/lib/metabolic-firestore";
import type {
  CycleEntry,
  DailySurvey,
  MetabolicConfig,
  CyclePhase,
  BodyCompositionEntry,
} from "@/lib/metabolic-types";
import {
  CYCLE_PHASE_LABELS,
  CONFIDENCE_LABELS,
  SURVEY_LABELS,
} from "@/lib/metabolic-types";
import { seedCyclesForUser } from "@/lib/seed-cycles";

// ==========================================
// Helper: format date for display
// ==========================================
function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Phase colors
const PHASE_COLORS: Record<CyclePhase, string> = {
  menstrual: "bg-red-500/20 text-red-400 border-red-500/30",
  follicular: "bg-green-500/20 text-green-400 border-green-500/30",
  ovulation: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  luteal: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const PHASE_DOT_COLORS: Record<CyclePhase, string> = {
  menstrual: "bg-red-400",
  follicular: "bg-green-400",
  ovulation: "bg-blue-400",
  luteal: "bg-yellow-400",
};

const Cycle = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<CycleEntry[]>([]);
  const [config, setConfig] = useState<MetabolicConfig | null>(null);
  const [bodyComp, setBodyComp] = useState<BodyCompositionEntry[]>([]);
  const [todaySurvey, setTodaySurvey] = useState<DailySurvey | null>(null);

  // Add/edit cycle form
  const [showAddCycle, setShowAddCycle] = useState(false);
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null);
  const [cycleStartInput, setCycleStartInput] = useState("");
  const [cycleEndInput, setCycleEndInput] = useState("");

  const [seeding, setSeeding] = useState(false);

  // Survey form
  const [surveyInputs, setSurveyInputs] = useState({
    hunger: 5,
    energy: 5,
    cravings: 5,
    waterRetention: 5,
    mood: 5,
  });
  const [savingSurvey, setSavingSurvey] = useState(false);

  // ==========================================
  // Load data
  // ==========================================
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [cyclesData, configData, bodyCompData, surveyData] =
        await Promise.all([
          loadCycles(user.uid),
          loadMetabolicConfig(user.uid),
          loadBodyComposition(user.uid, 10),
          loadDailySurvey(user.uid, todayStr()),
        ]);
      setCycles(cyclesData);
      setConfig(configData);
      setBodyComp(bodyCompData);
      setTodaySurvey(surveyData);

      if (surveyData) {
        setSurveyInputs({
          hunger: surveyData.hunger,
          energy: surveyData.energy,
          cravings: surveyData.cravings,
          waterRetention: surveyData.waterRetention,
          mood: surveyData.mood,
        });
      }
    } catch (error) {
      console.error("Failed to load cycle data:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==========================================
  // Computed state
  // ==========================================
  const cyclesWithDurations = useMemo(
    () => calculateCycleDurations(cycles),
    [cycles]
  );

  const cycleState = useMemo(
    () => getCurrentCycleState(cyclesWithDurations),
    [cyclesWithDurations]
  );

  const prediction = useMemo(() => {
    const sorted = [...cyclesWithDurations].sort(
      (a, b) => b.startDate.localeCompare(a.startDate)
    );
    return predictNextCycle(sorted);
  }, [cyclesWithDurations]);

  const macroAdjustment = useMemo(() => {
    if (!cycleState) return null;
    return computeMacroAdjustment(
      cycleState.phase,
      config?.predictionConfidence || "medium",
      bodyComp[0] || null,
      todaySurvey
    );
  }, [cycleState, config, bodyComp, todaySurvey]);

  const antiPanicMsg = useMemo(() => {
    if (!cycleState) return null;
    return shouldShowAntiPanic(cycleState.phase, bodyComp, todaySurvey);
  }, [cycleState, bodyComp, todaySurvey]);

  // ==========================================
  // Handlers
  // ==========================================
  const handleAddCycle = async () => {
    if (!user || !cycleStartInput || !cycleEndInput) return;
    try {
      const start = cycleStartInput;
      const end = cycleEndInput;
      const bleedingDays =
        Math.round(
          (new Date(end).getTime() - new Date(start).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1;

      await saveCycleEntry(user.uid, {
        startDate: start,
        endDate: end,
        duration: 0, // will be calculated
        bleedingDays,
        confirmed: true,
      });

      // Reload and recalculate
      const newCycles = await loadCycles(user.uid);
      setCycles(newCycles);
      const withDurations = calculateCycleDurations(newCycles);
      const newConfig = recalculateMetabolicConfig(withDurations, config);
      await saveMetabolicConfig(user.uid, newConfig);
      setConfig(newConfig);

      setCycleStartInput("");
      setCycleEndInput("");
      setShowAddCycle(false);
      toast.success("Цикл добавлен");
    } catch (error) {
      console.error("Failed to add cycle:", error);
      toast.error("Ошибка добавления");
    }
  };

  const handleEditCycle = async () => {
    if (!user || !editingCycleId || !cycleStartInput || !cycleEndInput) return;
    try {
      const bleedingDays =
        Math.round(
          (new Date(cycleEndInput).getTime() -
            new Date(cycleStartInput).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1;

      await updateCycleEntry(user.uid, editingCycleId, {
        startDate: cycleStartInput,
        endDate: cycleEndInput,
        bleedingDays,
        confirmed: true,
      });

      const newCycles = await loadCycles(user.uid);
      setCycles(newCycles);
      const withDurations = calculateCycleDurations(newCycles);
      const newConfig = recalculateMetabolicConfig(withDurations, config);
      await saveMetabolicConfig(user.uid, newConfig);
      setConfig(newConfig);

      setEditingCycleId(null);
      setCycleStartInput("");
      setCycleEndInput("");
      toast.success("Цикл обновлён");
    } catch (error) {
      toast.error("Ошибка обновления");
    }
  };

  const handleDeleteCycle = async (cycleId: string) => {
    if (!user) return;
    try {
      await deleteCycleEntry(user.uid, cycleId);
      const newCycles = await loadCycles(user.uid);
      setCycles(newCycles);
      const withDurations = calculateCycleDurations(newCycles);
      const newConfig = recalculateMetabolicConfig(withDurations, config);
      await saveMetabolicConfig(user.uid, newConfig);
      setConfig(newConfig);
      toast.success("Цикл удалён");
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const handleSaveSurvey = async () => {
    if (!user) return;
    setSavingSurvey(true);
    try {
      const survey: DailySurvey = {
        date: todayStr(),
        ...surveyInputs,
      };
      await saveDailySurvey(user.uid, survey);
      setTodaySurvey(survey);

      // Update symptom map in config
      if (cycleState && config) {
        const newMap = updateSymptomMap(
          config.symptomMap,
          cycleState.cycleDay,
          survey
        );
        const updatedConfig = { ...config, symptomMap: newMap, updatedAt: Date.now() };
        await saveMetabolicConfig(user.uid, updatedConfig);
        setConfig(updatedConfig);
      }

      toast.success("Опрос сохранён");
    } catch (error) {
      toast.error("Ошибка сохранения опроса");
    } finally {
      setSavingSurvey(false);
    }
  };

  const startEditCycle = (cycle: CycleEntry) => {
    setEditingCycleId(cycle.id);
    setCycleStartInput(cycle.startDate);
    setCycleEndInput(cycle.endDate);
    setShowAddCycle(false);
  };

  const cancelEdit = () => {
    setEditingCycleId(null);
    setCycleStartInput("");
    setCycleEndInput("");
    setShowAddCycle(false);
  };

  // ==========================================
  // Render
  // ==========================================
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

      <section className="container max-w-5xl pt-6 pb-12">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="mb-4 w-full grid grid-cols-3">
            <TabsTrigger value="dashboard" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Статус</span>
              <span className="sm:hidden">Статус</span>
            </TabsTrigger>
            <TabsTrigger value="cycles" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Циклы</span>
              <span className="sm:hidden">Циклы</span>
            </TabsTrigger>
            <TabsTrigger value="survey" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <ShieldAlert className="h-4 w-4" />
              <span className="hidden sm:inline">Опрос</span>
              <span className="sm:hidden">Опрос</span>
            </TabsTrigger>
          </TabsList>

          {/* ==========================================
              TAB 1: Dashboard / Status
          ========================================== */}
          <TabsContent value="dashboard" className="space-y-4">
            {/* Current Phase Card */}
            {cycleState ? (
              <Card className={`p-5 md:p-6 border ${PHASE_COLORS[cycleState.phase]}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-3 h-3 rounded-full ${PHASE_DOT_COLORS[cycleState.phase]}`} />
                  <h2 className="font-semibold text-lg">
                    {CYCLE_PHASE_LABELS[cycleState.phase]}
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">День цикла</div>
                    <div className="text-2xl font-bold">{cycleState.cycleDay}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Длина цикла (прогноз)</div>
                    <div className="text-2xl font-bold">{cycleState.estimatedLength} дн.</div>
                  </div>
                </div>
                {config && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Уверенность: <span className="font-medium">{CONFIDENCE_LABELS[config.predictionConfidence]}</span></span>
                    <span>·</span>
                    <span>MAD: {config.mad} дн.</span>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50 text-center">
                <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Добавьте историю циклов, чтобы увидеть текущую фазу
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Рекомендуется минимум 6 месяцев для точного прогноза
                </p>
              </Card>
            )}

            {/* Macro Adjustment */}
            {macroAdjustment && macroAdjustment.calorieAdjustment > 0 && (
              <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🍽️</span>
                  <h3 className="font-semibold">Коррекция питания</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="rounded-xl bg-muted/40 p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Калории</div>
                    <div className="font-bold text-green-400">
                      +{macroAdjustment.calorieAdjustment} ккал
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Углеводы</div>
                    <div className="font-bold text-green-400">
                      +{macroAdjustment.carbAdjustment}г
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{macroAdjustment.reason}</p>
              </Card>
            )}

            {/* Anti-Panic */}
            {antiPanicMsg && (
              <Card className="p-5 md:p-6 bg-yellow-500/10 border border-yellow-500/30">
                <div className="flex items-start gap-3">
                  <div className="bg-yellow-500/20 rounded-full p-2 mt-0.5">
                    <ShieldAlert className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-yellow-400 mb-1">Не паникуй!</h3>
                    <p className="text-sm text-muted-foreground">{antiPanicMsg}</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Next Period Prediction */}
            {prediction && (
              <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📅</span>
                  <h3 className="font-semibold">Прогноз следующих месячных</h3>
                </div>
                <div className="text-2xl font-bold mb-1">
                  {formatDate(prediction.nextPeriodStart)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Прогноз: {prediction.predictedCycleLength} дн. цикл, {prediction.predictedBleedingDays} дн. кровотечение
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Уверенность: {CONFIDENCE_LABELS[prediction.confidence]} (MAD {prediction.mad} дн.)
                </div>
              </Card>
            )}

            {/* Phase Timeline */}
            {cycleState && (
              <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
                <h3 className="font-semibold mb-3">Фазы текущего цикла</h3>
                <div className="space-y-2">
                  {(Object.entries(cycleState.currentPhases) as [CyclePhase, { start: string; end: string }][]).map(
                    ([phase, range]) => (
                      <div
                        key={phase}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                          cycleState.phase === phase
                            ? PHASE_COLORS[phase]
                            : "bg-muted/20 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${PHASE_DOT_COLORS[phase]}`} />
                          <span>{CYCLE_PHASE_LABELS[phase]}</span>
                        </div>
                        <span className="text-xs">
                          {formatDateShort(range.start)} — {formatDateShort(range.end)}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ==========================================
              TAB 2: Cycle History
          ========================================== */}
          <TabsContent value="cycles" className="space-y-4">
            {/* Seed Button (only for target user, only if no cycles) */}
            {user?.uid === '3DXd9soOLnSZj4Axhg7zWPef2lj2' && cycles.length === 0 && (
              <Button
                onClick={async () => {
                  setSeeding(true);
                  try {
                    const result = await seedCyclesForUser(user.uid);
                    toast.success(`Добавлено ${result.added} циклов, пропущено ${result.skipped}`);
                    await loadData();
                  } catch (e) {
                    toast.error('Ошибка загрузки данных');
                    console.error(e);
                  } finally {
                    setSeeding(false);
                  }
                }}
                disabled={seeding}
                variant="outline"
                className="w-full rounded-2xl"
              >
                {seeding ? 'Загрузка...' : 'Загрузить историю циклов (12 месяцев)'}
              </Button>
            )}

            {/* Add Cycle Button */}
            {!showAddCycle && !editingCycleId && (
              <Button
                onClick={() => setShowAddCycle(true)}
                className="w-full flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] text-foreground hover:opacity-90 shadow-glow"
              >
                <Plus className="h-4 w-4" />
                Добавить цикл
              </Button>
            )}

            {/* Add/Edit Form */}
            {(showAddCycle || editingCycleId) && (
              <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
                <h3 className="font-semibold mb-3">
                  {editingCycleId ? "Редактировать цикл" : "Новый цикл"}
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Начало
                    </label>
                    <Input
                      type="date"
                      value={cycleStartInput}
                      onChange={(e) => setCycleStartInput(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Конец кровотечения
                    </label>
                    <Input
                      type="date"
                      value={cycleEndInput}
                      onChange={(e) => setCycleEndInput(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={editingCycleId ? handleEditCycle : handleAddCycle}
                    disabled={!cycleStartInput || !cycleEndInput}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] text-foreground hover:opacity-90"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    {editingCycleId ? "Сохранить" : "Добавить"}
                  </Button>
                  <Button onClick={cancelEdit} variant="ghost" className="rounded-xl">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            )}

            {/* Cycle List */}
            {cyclesWithDurations.length === 0 ? (
              <Card className="p-8 text-center bg-card/80 backdrop-blur-sm border-border/50">
                <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">Нет записей о циклах</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Добавьте историю за последние 6 месяцев
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {[...cyclesWithDurations]
                  .sort((a, b) => b.startDate.localeCompare(a.startDate))
                  .map((cycle) => (
                    <Card
                      key={cycle.id}
                      className="px-4 py-3 bg-card/80 backdrop-blur-sm border-border/50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">
                            {formatDate(cycle.startDate)} — {formatDate(cycle.endDate)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {cycle.bleedingDays} дн. кровотечение
                            {cycle.duration > 0 && ` · Цикл: ${cycle.duration} дн.`}
                            {!cycle.confirmed && (
                              <span className="ml-2 text-yellow-400">прогноз</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditCycle(cycle)}
                            className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCycle(cycle.id)}
                            className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-muted-foreground hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            )}

            {/* Stats Summary */}
            {config && cyclesWithDurations.length >= 2 && (
              <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
                <h3 className="font-semibold mb-3">Статистика циклов</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-muted/40 p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Средний цикл</div>
                    <div className="text-xl font-bold">{config.avgCycleLength} дн.</div>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Среднее кровотечение</div>
                    <div className="text-xl font-bold">{config.avgBleedingDays} дн.</div>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">MAD</div>
                    <div className="text-xl font-bold">{config.mad} дн.</div>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Уверенность</div>
                    <div className="text-xl font-bold">
                      {CONFIDENCE_LABELS[config.predictionConfidence]}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ==========================================
              TAB 3: Daily Survey
          ========================================== */}
          <TabsContent value="survey" className="space-y-4">
            <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Как вы себя чувствуете?</h3>
                <span className="text-xs text-muted-foreground">
                  {new Date().toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </div>

              {todaySurvey && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400">
                  Опрос на сегодня уже заполнен. Можно обновить.
                </div>
              )}

              <div className="space-y-4">
                {(
                  Object.keys(SURVEY_LABELS) as Array<
                    keyof typeof SURVEY_LABELS
                  >
                ).map((key) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">
                        {SURVEY_LABELS[key]}
                      </label>
                      <span className="text-sm font-bold w-6 text-center">
                        {surveyInputs[key]}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={surveyInputs[key]}
                      onChange={(e) =>
                        setSurveyInputs((prev) => ({
                          ...prev,
                          [key]: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-foreground"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                      <span>
                        {key === "hunger"
                          ? "Не голодна"
                          : key === "energy"
                          ? "Без сил"
                          : key === "cravings"
                          ? "Нет тяги"
                          : key === "waterRetention"
                          ? "Нет отёков"
                          : "Раздражена"}
                      </span>
                      <span>
                        {key === "hunger"
                          ? "Сильный голод"
                          : key === "energy"
                          ? "Полна энергии"
                          : key === "cravings"
                          ? "Очень хочется"
                          : key === "waterRetention"
                          ? "Сильные отёки"
                          : "Отличное"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleSaveSurvey}
                disabled={savingSurvey}
                className="w-full mt-5 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] px-8 py-4 text-foreground font-bold text-lg shadow-glow hover:opacity-90 transition-smooth"
              >
                {savingSurvey
                  ? "Сохраняю..."
                  : todaySurvey
                  ? "Обновить опрос"
                  : "Сохранить опрос"}
              </Button>
            </Card>

            {/* Survey Info */}
            {cycleState && (
              <Card className="p-4 bg-card/80 backdrop-blur-sm border-border/50">
                <p className="text-xs text-muted-foreground">
                  Данные опроса помогают системе точнее определять фазу цикла и корректировать питание.
                  Чем чаще вы заполняете опрос, тем точнее прогнозы.
                  <span className="font-medium"> День цикла: {cycleState.cycleDay}</span>
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
};

export default Cycle;
