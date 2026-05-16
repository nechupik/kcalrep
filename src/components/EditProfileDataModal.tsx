import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Flame, Target } from "lucide-react";
import type { Gender, Goal } from "@/lib/nutrition";
import { loadFullNormData, saveNorm as saveNormToFirestore, loadWeight } from "@/lib/firestore";
import { calculateMacros, type CalcInput, type MacroResult } from "@/lib/nutrition";
import { toast } from "sonner";

interface EditProfileDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newNorm: MacroResult) => void;
  userId: string;
}

export const EditProfileDataModal = ({ isOpen, onClose, onSave, userId }: EditProfileDataModalProps) => {
  const [gender, setGender] = useState<Gender>("male");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (isOpen && userId) {
        const normData = await loadFullNormData(userId);
        if (normData) {
          setGender(normData.gender as Gender || "male");
          setAge(normData.age ? String(normData.age) : "");
          setHeight(normData.height ? String(normData.height) : "");
        }
      }
    };
    loadData();
  }, [isOpen, userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsedAge = Number(age);
    const parsedHeight = Number(height);
    
    if (!parsedAge || !parsedHeight || parsedAge < 10 || parsedAge > 100 || parsedHeight < 100 || parsedHeight > 250) {
      toast.error("Введите корректные значения возраста (10-100) и роста (100-250)");
      return;
    }

    setIsSubmitting(true);
    try {
      // Load current norm to get goal
      const currentNormData = await loadFullNormData(userId);
      if (!currentNormData) {
        toast.error("Не удалось загрузить текущие данные");
        return;
      }

      // Load current weight from weight entries
      const weightEntries = await loadWeight(userId, 1);
      const currentWeight = weightEntries.length > 0 ? weightEntries[0].weight : 70;

      // Recalculate with new parameters but keep current weight and goal
      const input: CalcInput = {
        gender,
        age: parsedAge,
        height: parsedHeight,
        weight: currentWeight,
        activityMode: "steps",
        steps: 0,
        goal: currentNormData.goal as Goal || "maintain",
      };

      const newNorm = calculateMacros(input);
      
      await saveNormToFirestore(userId, newNorm, {
        gender,
        height: parsedHeight,
        age: parsedAge,
        goal: input.goal,
      });

      onSave(newNorm);
      onClose();
      toast.success("Данные обновлены");
    } catch (error) {
      console.error("Failed to save profile data:", error);
      toast.error("Ошибка сохранения данных");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card/95 backdrop-blur-sm border-border/50 max-w-[calc(100%-40px)] rounded-2xl [&>button:last-child]:hidden p-6">

        <form onSubmit={handleSave} className="space-y-6">
          {/* Пол */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Пол
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {(["male", "female"] as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`rounded-xl border-2 px-4 py-3 text-sm font-medium transition-smooth ${
                    gender === g
                      ? "border-primary bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {g === "male" ? "Мужчина" : "Женщина"}
                </button>
              ))}
            </div>
          </div>

          {/* Возраст и Рост */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="age">Возраст</Label>
              <Input
                id="age"
                type="number"
                min={10}
                max={100}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="28"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Рост, см</Label>
              <Input
                id="height"
                type="number"
                min={100}
                max={250}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="178"
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 justify-between">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] text-foreground hover:opacity-90 border-0"
            >
              {isSubmitting ? "Сохранение..." : "Сохранить"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full"
            >
              Отмена
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
