import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { MacroRing } from "@/components/MacroRing";
import { MainCalorieRing } from "@/components/MainCalorieRing";
import { MacroProgressBar } from "@/components/MacroProgressBar";
import { AppHeader } from "@/components/AppHeader";
import { AddFoodModal } from "@/components/AddFoodModal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  loadDiary,
  loadNorm,
  addDiaryEntry,
  removeDiaryEntry,
  type DiaryEntry,
} from "@/lib/storage";
import { saveActivity, loadActivity, loadWeight, loadFullNormData, loadUserSettings, wasWeightEnteredThisWeek, type ActivityEntry } from "@/lib/firestore";
import type { MacroResult } from "@/lib/nutrition";

const Index = () => {
  const { user } = useAuth();
  const ADMIN_UID = 'irXSByiUKYg9S5g3UXF5xSXHijC3';
  const [norm, setNorm] = useState<MacroResult | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [activity, setActivity] = useState<ActivityEntry | null>(null);
  const [activityInput, setActivityInput] = useState('');
  const [activityMode, setActivityMode] = useState<'home' | 'steps'>('home');
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityEnabled, setActivityEnabled] = useState(true);
  const [showWeightReminder, setShowWeightReminder] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedDate + 'T00:00:00');
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    const newDateString = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}-${String(newDate.getDate()).padStart(2, "0")}`;
    setSelectedDate(newDateString);
  };

  const goToToday = () => {
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setSelectedDate(todayString);
  };

  const getLastWeight = async (): Promise<number> => {
    if (!user) return 70;
    const weights = await loadWeight(user.uid, 1);
    if (weights.length > 0) return weights[0].weight;
    // Fallback to weight from norm
    const normData = await loadFullNormData(user.uid);
    return 70; // default fallback
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      const normData = await loadNorm();
      const diaryData = await loadDiary(selectedDate);
      const activityData = await loadActivity(user.uid, selectedDate);
      const settings = await loadUserSettings(user.uid);
      
      setNorm(normData);
      setEntries(Array.isArray(diaryData) ? diaryData : []);
      setActivity(activityData);
      if (settings) setActivityEnabled(settings.activityTrackingEnabled);
      if (activityData) {
        if (activityData.type === 'calories') setActivityInput(String(activityData.value));
        if (activityData.type === 'steps') setActivityInput(String(activityData.value));
      }
      
      // Check if weight reminder should be shown
      const weightEnteredThisWeek = await wasWeightEnteredThisWeek(user.uid);
      setShowWeightReminder(!weightEnteredThisWeek);
    };
    
    loadData();
  }, [user, selectedDate]);

  const handleAddEntry = async (entry: Omit<DiaryEntry, 'id' | 'addedAt'>) => {
    try {
      const entryWithDate = { ...entry, date: selectedDate };
      await addDiaryEntry(entryWithDate);
      const diaryData = await loadDiary(selectedDate);
      setEntries(Array.isArray(diaryData) ? diaryData : []);
      toast.success(`Добавлено: ${entry.name}`);
    } catch (error) {
      toast.error('Ошибка добавления записи');
    }
  };

  const handleRemoveEntry = async (id: string) => {
    setEntryToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;
    try {
      await removeDiaryEntry(entryToDelete);
      const diaryData = await loadDiary(selectedDate);
      setEntries(Array.isArray(diaryData) ? diaryData : []);
      toast.success('Запись удалена');
    } catch (error) {
      toast.error('Ошибка удаления записи');
    } finally {
      setDeleteConfirmOpen(false);
      setEntryToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmOpen(false);
    setEntryToDelete(null);
  };

  const handleRepeatYesterday = async () => {
    const yesterday = new Date(selectedDate + 'T00:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    
    const yesterdayEntries = await loadDiary(yesterdayStr);
    if (yesterdayEntries.length === 0) {
      toast.info('Вчера не было записей');
      return;
    }
    
    for (const entry of yesterdayEntries) {
      await addDiaryEntry({
        foodId: entry.foodId,
        name: entry.name,
        grams: entry.grams,
        calories: entry.calories,
        protein: entry.protein,
        fat: entry.fat,
        carbs: entry.carbs,
        date: selectedDate,
      });
    }
    
    const updated = await loadDiary(selectedDate);
    setEntries(Array.isArray(updated) ? updated : []);
    toast.success(`Скопировано ${yesterdayEntries.length} записей из вчера`);
  };

  const handleSaveActivity = async () => {
    if (!user) return;
    setSavingActivity(true);
    try {
      let caloriesBurned = 0;
      let type: ActivityEntry['type'] = 'home';
      let value = 0;

      if (user.uid === ADMIN_UID) {
        // Admin: direct calorie input from Apple Watch
        caloriesBurned = Number(activityInput) || 0;
        type = 'calories';
        value = caloriesBurned;
      } else {
        if (activityMode === 'home') {
          caloriesBurned = 0;
          type = 'home';
          value = 0;
        } else {
          const steps = Number(activityInput) || 0;
          const lastWeight = await getLastWeight();
          caloriesBurned = Math.round(steps * lastWeight * 0.0005);
          type = 'steps';
          value = steps;
        }
      }

      await saveActivity(user.uid, {
        date: selectedDate,
        type,
        value,
        caloriesBurned,
      });

      const updated = await loadActivity(user.uid, selectedDate);
      setActivity(updated);
      toast.success('Активность сохранена');
    } catch (error) {
      toast.error('Ошибка сохранения активности');
    } finally {
      setSavingActivity(false);
    }
  };

  const selectedDateTotals = useMemo(() => {
    return entries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        fat: acc.fat + e.fat,
        carbs: acc.carbs + e.carbs,
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 },
    );
  }, [entries]);

  const deficitData = useMemo(() => {
    if (!norm) return null;
    const activityCalories = (activityEnabled && activity?.caloriesBurned) ? activity.caloriesBurned : 0;
    const burned = norm.bmr + activityCalories;
    const deficit = burned - selectedDateTotals.calories;
    return {
      burned,
      deficit,
      activityCalories,
    };
  }, [norm, selectedDateTotals, activity, activityEnabled]);


  const isToday = selectedDate === (() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  })();

  return (
    <>
      <div className="min-h-screen">
        <AppHeader />

        
        {/* Weight Reminder */}
        {showWeightReminder && (
          <section className="container max-w-5xl mb-6">
            <Card className="p-4 border-yellow-500/50 bg-yellow-500/10 backdrop-blur-sm shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚖️</span>
                  <div>
                    <p className="text-sm font-semibold">Не забудь внести вес!</p>
                    <p className="text-xs text-muted-foreground">
                      Обновляй вес раз в неделю — это помогает точнее считать норму КБЖУ.
                    </p>
                  </div>
                </div>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20 shrink-0"
                >
                  <Link to="/stats">Внести</Link>
                </Button>
              </div>
            </Card>
          </section>
        )}

        {/* Daily progress */}
        <section className="container max-w-5xl mb-8">
          {norm ? (
            <Card className="p-6 md:p-8 shadow-soft border-border/50 backdrop-blur-sm bg-card/80">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                <div>
                  <h2 className="text-xl font-bold">{isToday ? 'Сегодня' : formatDate(selectedDate)}</h2>
                                  </div>
                {!isToday && (
                  <Button onClick={goToToday} variant="outline" size="sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Сегодня
                  </Button>
                )}
              </div>
              <div className="flex flex-col items-center gap-8 mb-6">
                <MainCalorieRing consumed={selectedDateTotals.calories} total={norm.calories} />
                <div className="w-full max-w-lg flex flex-row justify-between gap-2 px-2">
                  <MacroProgressBar consumed={selectedDateTotals.protein} total={norm.protein} label="Белки" colorVar="--macro-protein" />
                  <MacroProgressBar consumed={selectedDateTotals.fat} total={norm.fat} label="Жиры" colorVar="--macro-fat" />
                  <MacroProgressBar consumed={selectedDateTotals.carbs} total={norm.carbs} label="Углеводы" colorVar="--macro-carbs" />
                </div>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] px-8 py-4 text-foreground font-bold text-lg shadow-glow hover:opacity-90 transition-smooth"
                >
                  <Plus className="h-6 w-6" />
                  Добавить еду
                </button>
              </div>
            </Card>
          ) : null}
        </section>

        {/* Activity Tracking */}
        <section className="container max-w-5xl mb-6">
          {norm && (user?.uid === ADMIN_UID || activityEnabled) && (
            <Card className="w-full p-6 md:p-8 shadow-soft border-border/50 backdrop-blur-sm bg-card/80">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold">Активность за день</h3>
              {activity && (
                <span className="ml-auto text-sm font-semibold text-green-400">
                  +{activity.caloriesBurned} ккал
                </span>
              )}
            </div>

            {/* ADMIN: Apple Watch calories input */}
            {user?.uid === ADMIN_UID && (
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Kcal from Apple Watch"
                  value={activityInput}
                  onChange={e => setActivityInput(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleSaveActivity}
                  disabled={savingActivity || !activityInput}
                  className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] px-8 py-4 text-foreground font-bold text-lg shadow-glow hover:opacity-90 transition-smooth"
                >
                  Сохранить
                </Button>
              </div>
            )}

            {/* WIFE: Home or Steps toggle */}
            {user?.uid !== ADMIN_UID && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActivityMode('home')}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-smooth border ${
                      activityMode === 'home'
                        ? 'bg-gradient-sunset text-primary-foreground border-transparent'
                        : 'border-border/50 text-muted-foreground'
                    }`}
                  >
                    🏠 Дома
                  </button>
                  <button
                    onClick={() => setActivityMode('steps')}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-smooth border ${
                      activityMode === 'steps'
                        ? 'bg-gradient-sunset text-primary-foreground border-transparent'
                        : 'border-border/50 text-muted-foreground'
                    }`}
                  >
                    👣 Выходила
                  </button>
                </div>

                {activityMode === 'steps' && (
                  <Input
                    type="number"
                    placeholder="Количество шагов"
                    value={activityInput}
                    onChange={e => setActivityInput(e.target.value)}
                  />
                )}

                <Button
                  onClick={handleSaveActivity}
                  disabled={savingActivity || (activityMode === 'steps' && !activityInput)}
                  className="w-full bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-0 text-foreground hover:opacity-90"
                >
                  Сохранить активность
                </Button>
              </div>
            )}

            {/* Deficit summary */}
            {deficitData && (
              <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Сожжено</div>
                  <div className="font-bold text-sm">{deficitData.burned} ккал</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Съедено</div>
                  <div className="font-bold text-sm">{selectedDateTotals.calories} ккал</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Дефицит</div>
                  <div className={`font-bold text-sm ${deficitData.deficit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {deficitData.deficit > 0 ? '+' : ''}{deficitData.deficit} ккал
                  </div>
                </div>
              </div>
            )}
          </Card>
          )}
        </section>

        {/* Eaten Foods List */}
        {entries.length > 0 && (
          <Card className="p-5 md:p-6 shadow-card border-border/50 backdrop-blur-sm bg-card/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Съедено</h3>
              <span className="text-xs text-muted-foreground">{entries.length} шт.</span>
            </div>
            <div className="space-y-2">
              {entries.slice().reverse().map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2.5 group hover:bg-muted/70 transition-smooth"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{e.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.grams > 1 ? `${e.grams}г · ` : '1 порция · '}
                      <span className="text-macro-calories font-semibold">{e.calories}</span> ккал ·
                      Б {e.protein}г · Ж {e.fat}г · У {e.carbs}г
                    </div>
                  </div>
                  <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                    <AlertDialogTrigger asChild>
                      <button
                        onClick={() => handleRemoveEntry(e.id)}
                        className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-smooth p-1 shrink-0"
                        aria-label="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Вы уверены, что хотите удалить "{e.name}"? Это действие нельзя отменить.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={cancelDelete}>Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Удалить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          </Card>
        )}

              <div className="h-8" />
      </div>

      <AddFoodModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddEntry}
        selectedDate={selectedDate}
      />
    </>
  );
};

export default Index;
