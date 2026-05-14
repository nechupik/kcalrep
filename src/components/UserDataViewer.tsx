import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Calendar, Loader2 } from "lucide-react";
import { loadNorm, loadDiary, loadActivity } from "@/lib/firestore";
import type { MacroResult } from "@/lib/nutrition";
import type { DiaryEntry } from "@/lib/storage";
import { toast } from "sonner";

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
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
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
