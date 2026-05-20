import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { MacroRing } from "@/components/MacroRing";
import { MainCalorieRing } from "@/components/MainCalorieRing";
import { MacroProgressBar } from "@/components/MacroProgressBar";
import { AppHeader } from "@/components/AppHeader";
import { AddFoodModal } from "@/components/AddFoodModal";
import { EatenFoodsList } from "@/components/EatenFoodsList";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  loadDiary,
  loadNorm,
  saveNorm,
  addDiaryEntry,
  removeDiaryEntry,
  updateDiaryEntry,
  type DiaryEntry,
} from "@/lib/storage";
import { saveActivity, loadActivity, loadWeight, loadFullNormData, loadUserSettings, loadLatestActivityEntries, type ActivityEntry } from "@/lib/firestore";
import { loadBodyComposition } from "@/lib/metabolic-firestore";
import { calculateMacrosWithWatchTDEE } from "@/lib/nutrition";
import type { MacroResult } from "@/lib/nutrition";

const Index = () => {
  const { user } = useAuth();
  const ADMIN_UID = 'irXSByiUKYg9S5g3UXF5xSXHijC3';
  const [loading, setLoading] = useState(true);
  const [norm, setNorm] = useState<MacroResult | null>(null);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [activity, setActivity] = useState<ActivityEntry | null>(null);
  const [activityInput, setActivityInput] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityEnabled, setActivityEnabled] = useState(true);
  const [activityCardHiding, setActivityCardHiding] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalAnimationState, setEditModalAnimationState] = useState<'enter' | 'exit' | null>(null);
  const [entryToEdit, setEntryToEdit] = useState<DiaryEntry | null>(null);
  const [editGrams, setEditGrams] = useState('');
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
      if (!user) { setLoading(false); return; }
      try {
        const [normData, diaryData, activityData, settings] = await Promise.all([
          loadNorm(),
          loadDiary(selectedDate),
          loadActivity(user.uid, selectedDate),
          loadUserSettings(user.uid),
        ]);
        
        setNorm(normData);
        setEntries(Array.isArray(diaryData) ? diaryData : []);
        setActivity(activityData);
        setActivityCardHiding(false);
        if (settings) setActivityEnabled(settings.activityTrackingEnabled);
        if (activityData) {
          if (activityData.type === 'calories') setActivityInput(String(activityData.value));
          if (activityData.type === 'steps') setActivityInput(String(activityData.value));
        }
      } finally {
        setLoading(false);
      }
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
    try {
      await removeDiaryEntry(id);
      const diaryData = await loadDiary(selectedDate);
      setEntries(Array.isArray(diaryData) ? diaryData : []);
      toast.success('Запись удалена');
    } catch (error) {
      toast.error('Ошибка удаления записи');
    }
  };

  const handleEditEntry = (entry: DiaryEntry) => {
    setEntryToEdit(entry);
    setEditGrams(entry.grams.toString());
    setShowEditModal(true);
  };

  // Control edit modal animation
  useEffect(() => {
    if (showEditModal) {
      setEditModalAnimationState('enter');
    } else {
      setEditModalAnimationState('exit');
      const timer = setTimeout(() => {
        setEditModalAnimationState(null);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [showEditModal]);

  const handleUpdateGrams = async () => {
    if (!entryToEdit || !editGrams) return;
    
    const newGrams = Number(editGrams);
    if (isNaN(newGrams) || newGrams <= 0) {
      toast.error('Введите корректное количество граммов');
      return;
    }

    try {
      // Calculate new nutritional values based on the ratio
      const ratio = newGrams / entryToEdit.grams;
      const updatedEntry = {
        grams: newGrams,
        calories: Math.round(entryToEdit.calories * ratio),
        protein: Math.round(entryToEdit.protein * ratio * 10) / 10,
        fat: Math.round(entryToEdit.fat * ratio * 10) / 10,
        carbs: Math.round(entryToEdit.carbs * ratio * 10) / 10,
      };

      await updateDiaryEntry(entryToEdit.id, updatedEntry);
      
      // Update local state
      setEntries(prev => prev.map(e => 
        e.id === entryToEdit.id ? { ...e, ...updatedEntry } : e
      ));
      
      toast.success(`Обновлено: ${entryToEdit.name} - ${newGrams}г`);
      setShowEditModal(false);
      setEntryToEdit(null);
      setEditGrams('');
    } catch (error) {
      toast.error('Ошибка обновления записи');
    }
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
        const steps = Number(activityInput) || 0;
        const lastWeight = await getLastWeight();
        caloriesBurned = Math.round(steps * lastWeight * 0.0005);
        type = 'steps';
        value = steps;
      }

      await saveActivity(user.uid, {
        date: selectedDate,
        type,
        value,
        caloriesBurned,
      });

      const updated = await loadActivity(user.uid, selectedDate);
      setActivity(updated);

      // Admin: start hide animation, remove from DOM after 650ms
      if (user.uid === ADMIN_UID) {
        setActivityCardHiding(true);
        setTimeout(() => setActivityCardHiding(false), 650);
      }

      // Admin: auto-recalculate floating norm from last 7 activity entries
      if (user.uid === ADMIN_UID) {
        try {
          const [latestActivities, normData, weightEntries, latestBodyComp, settings] = await Promise.all([
            loadLatestActivityEntries(user.uid, 7),
            loadFullNormData(user.uid),
            loadWeight(user.uid, 1),
            loadBodyComposition(user.uid, 1),
            loadUserSettings(user.uid),
          ]);

          if (normData && normData.gender && latestActivities.length > 0) {
            const avg = Math.round(latestActivities.reduce((sum, e) => sum + e.caloriesBurned, 0) / latestActivities.length);
            const w = weightEntries.length > 0 ? weightEntries[0].weight : 80;
            const deficitPct = settings?.deficitPercent ?? 10;
            const latestComp = latestBodyComp.length > 0 ? latestBodyComp[0] : null;
            const bmrFromScale = latestComp?.bmrFromScale && latestComp.bmrFromScale > 0
              ? latestComp.bmrFromScale
              : null;
            const bodyFatPercent = latestComp?.bodyFatPercent ?? undefined;
            const bmr = bmrFromScale ?? (normData.gender === 'male'
              ? 10 * w + 6.25 * normData.height - 5 * normData.age + 5
              : 10 * w + 6.25 * normData.height - 5 * normData.age - 161);

            const newNorm = calculateMacrosWithWatchTDEE(bmr, avg, deficitPct, w, normData.gender, normData.height, bodyFatPercent);
            await saveNorm(newNorm, { gender: normData.gender, height: normData.height, age: normData.age, goal: normData.goal || 'lose' });
            setNorm(newNorm);
            toast.success(`Активность сохранена. Норма обновлена: ${newNorm.calories} ккал (ср. ${avg} ккал/день)`);
          } else {
            toast.success('Активность сохранена');
          }
        } catch {
          toast.success('Активность сохранена');
        }
      } else {
        toast.success('Активность сохранена');
      }
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
    const burned = norm.bmr * 1.2 + activityCalories;
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

  if (loading) return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container max-w-5xl mt-4 mb-4 space-y-4">
        <div className="rounded-2xl bg-card/80 border border-border/50 p-6 md:p-8 animate-pulse">
          <div className="flex flex-col items-center gap-6">
            <div className="w-44 h-44 rounded-full bg-muted/60" />
            <div className="w-full space-y-3">
              <div className="h-3 rounded-full bg-muted/60 w-3/4 mx-auto" />
              <div className="h-3 rounded-full bg-muted/60 w-1/2 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="min-h-screen">
        <AppHeader />


        {/* Daily progress */}
        <section className="container max-w-5xl mt-4 mb-4">
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
                {deficitData && (
                  <div className="flex items-center gap-1.5 -mt-4">
                    <span className="text-xs text-muted-foreground">Дефицит —</span>
                    <span className={`text-xs font-bold ${deficitData.deficit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {Math.round(deficitData.deficit)} ккал
                    </span>
                  </div>
                )}
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
        <section className="container max-w-5xl mb-4">
          {norm && (user?.uid === ADMIN_UID || activityEnabled) && !(user?.uid === ADMIN_UID && activity && !activityCardHiding) && (
            <div style={{
              opacity: activityCardHiding ? 0 : 1,
              transform: activityCardHiding ? 'translateY(-6px)' : 'translateY(0)',
              transition: 'opacity 650ms ease-in-out, transform 650ms ease-in-out',
            }}>
            <Card className="w-full p-6 md:p-8 shadow-soft border-border/50 backdrop-blur-sm bg-card/80">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-semibold">Активность за вчера</h3>
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

            {/* WIFE: Steps input */}
            {user?.uid !== ADMIN_UID && (
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Количество шагов"
                  value={activityInput}
                  onChange={e => setActivityInput(e.target.value)}
                  className="w-2/3"
                />
                <Button
                  onClick={handleSaveActivity}
                  disabled={savingActivity || !activityInput}
                  className="w-1/3 bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-0 text-foreground hover:opacity-90"
                >
                  Сохранить
                </Button>
              </div>
            )}

          </Card>
          </div>
          )}
        </section>

        {/* Eaten Foods List */}
        <section className="container max-w-5xl">
          <EatenFoodsList
            entries={entries}
            onRemove={handleRemoveEntry}
            onEdit={handleEditEntry}
          />
        </section>

              <div className="h-8" />
      </div>

      <AddFoodModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddEntry}
        selectedDate={selectedDate}
      />

      {/* Edit Grams Modal */}
      {showEditModal && entryToEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ pointerEvents: showEditModal ? 'auto' : 'none' }}
        >
          {/* Overlay */}
          <div
            onClick={() => {
              setShowEditModal(false);
              setEntryToEdit(null);
              setEditGrams('');
            }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              opacity: showEditModal ? 1 : 0,
              transition: 'opacity 650ms cubic-bezier(0.4, 0, 0.2, 1)',
              pointerEvents: showEditModal ? 'auto' : 'none',
            }}
          />

          {/* Modal panel */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '448px',
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border) / 0.5)',
              borderRadius: '16px',
              padding: '24px',
              transform: showEditModal ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 650ms cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 -4px 40px rgba(0,0,0,0.4)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Изменить граммовку</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEntryToEdit(null);
                  setEditGrams('');
                }}
                className="text-muted-foreground hover:text-primary"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {entryToEdit.name}
              </div>
              
              <div className="space-y-2">
                <label htmlFor="grams" className="block text-sm font-medium">
                  Граммовка
                </label>
                <Input
                  id="grams"
                  type="number"
                  value={editGrams}
                  onChange={(e) => setEditGrams(e.target.value)}
                  placeholder="Введите граммовку"
                  className="w-full"
                  min="1"
                  step="1"
                />
              </div>

              {entryToEdit && editGrams && !isNaN(Number(editGrams)) && Number(editGrams) > 0 && (
                <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                  Новые значения:
                  <div className="mt-1">
                    Ккал: {Math.round(entryToEdit.calories * (Number(editGrams) / entryToEdit.grams))} ·
                    Б: {Math.round(entryToEdit.protein * (Number(editGrams) / entryToEdit.grams) * 10) / 10}г ·
                    Ж: {Math.round(entryToEdit.fat * (Number(editGrams) / entryToEdit.grams) * 10) / 10}г ·
                    У: {Math.round(entryToEdit.carbs * (Number(editGrams) / entryToEdit.grams) * 10) / 10}г
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  setEntryToEdit(null);
                  setEditGrams('');
                }}
                className="flex-1 text-muted-foreground hover:text-primary"
              >
                Отмена
              </Button>
              <Button
                onClick={handleUpdateGrams}
                disabled={!editGrams || isNaN(Number(editGrams)) || Number(editGrams) <= 0}
                className="flex-1 bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-0 text-foreground hover:opacity-90 shadow-glow"
              >
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Index;
