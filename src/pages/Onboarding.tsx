import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalculatorForm } from "@/components/CalculatorForm";
import { ResultsCard } from "@/components/ResultsCard";
import { Card } from "@/components/ui/card";
import { saveNorm } from "@/lib/storage";
import type { MacroResult, CalcInput } from "@/lib/nutrition";
import { toast } from "sonner";

export const Onboarding = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState<MacroResult | null>(null);
  const [input, setInput] = useState<CalcInput | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleCalculate = (calcResult: MacroResult, calcInput: CalcInput) => {
    setResult(calcResult);
    setInput(calcInput);
    setIsSaved(false);
  };

  const handleSaveNorm = async () => {
    if (!result || !input) return;

    setIsSaving(true);
    try {
      await saveNorm(result, {
        gender: input.gender,
        height: input.height,
        age: input.age,
        goal: input.goal,
      });
      setIsSaved(true);
      toast.success("Норма КБЖУ сохранена!");
      
      // Redirect to main app after a short delay
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (error) {
      toast.error("Ошибка сохранения нормы");
      console.error("Error saving norm:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container pt-8 pb-20 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-3">Рассчитайте вашу норму КБЖУ</h1>
          <p className="text-muted-foreground text-lg">
            Это займёт 1 минуту. Норму можно изменить в профиле.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Calculator Form */}
          <div className="space-y-4">
            <CalculatorForm 
              onCalculate={handleCalculate}
              submitLabel="Рассчитать норму"
            />
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4">
              <ResultsCard
                result={result}
                onSave={handleSaveNorm}
                saved={isSaved}
              />
              {isSaved && (
                <Card className="p-4 text-center border-green-500/20 bg-green-500/5">
                  <p className="text-green-600 font-medium">
                    ✓ Норма сохранена! Перенаправляем в приложение...
                  </p>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
