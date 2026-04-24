import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Trash2, Utensils } from "lucide-react";
import { FOODS, type FoodItem } from "@/lib/nutrition";
import type { DiaryEntry } from "@/lib/storage";
import { todayKey } from "@/lib/storage";

interface DiaryProps {
  entries: DiaryEntry[];
  onAdd: (entry: DiaryEntry) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export const Diary = ({ entries, onAdd, onRemove }: DiaryProps) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState("100");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FOODS.slice(0, 8);
    return FOODS.filter((f) => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)).slice(0, 12);
  }, [query]);

  const todayEntries = entries.filter((e) => e.date === todayKey());

  const handleAdd = async () => {
    if (!selected) return;
    const g = Number(grams);
    if (!g || g <= 0) return;
    const factor = g / 100;
    await onAdd({
      id: crypto.randomUUID(),
      foodId: selected.id,
      name: selected.name,
      grams: g,
      calories: Math.round(selected.calories * factor),
      protein: +(selected.protein * factor).toFixed(1),
      fat: +(selected.fat * factor).toFixed(1),
      carbs: +(selected.carbs * factor).toFixed(1),
      date: todayKey(),
      addedAt: Date.now(),
    });
    setSelected(null);
    setQuery("");
    setGrams("100");
  };

  return (
    <Card className="p-6 md:p-8 shadow-card border-border/50 backdrop-blur-sm bg-card/80">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl bg-gradient-sunset p-2.5 shadow-glow">
          <Utensils className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Дневник питания</h3>
          <p className="text-xs text-muted-foreground">Сегодня · {todayEntries.length} записей</p>
        </div>
      </div>

      {/* Поиск */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск продукта..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            className="pl-9"
          />
        </div>

        {!selected && (
          <ScrollArea className="h-44 rounded-xl border border-border/50 bg-muted/30">
            <div className="p-2 space-y-1">
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Ничего не найдено</p>
              )}
              {filtered.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelected(f)}
                  className="w-full text-left rounded-lg px-3 py-2 hover:bg-gradient-sunset-soft transition-smooth flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{f.name}</div>
                    <div className="text-xs text-muted-foreground">{f.category}</div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    <span className="text-macro-calories font-semibold">{f.calories}</span> ккал/100г
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        {selected && (
          <div className="rounded-xl border-2 border-primary/30 bg-gradient-sunset-soft p-4 space-y-3">
            <div>
              <div className="font-semibold">{selected.name}</div>
              <div className="text-xs text-muted-foreground">
                на 100г: {selected.calories} ккал · Б {selected.protein} · Ж {selected.fat} · У {selected.carbs}
              </div>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label htmlFor="grams" className="text-xs">Граммы</Label>
                <Input
                  id="grams"
                  type="number"
                  min={1}
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  autoFocus
                />
              </div>
              <Button onClick={handleAdd} className="bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90">
                <Plus className="h-4 w-4 mr-1" />
                Добавить
              </Button>
              <Button variant="ghost" onClick={() => setSelected(null)}>Отмена</Button>
            </div>
          </div>
        )}
      </div>

      {/* Список съеденного */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Съедено сегодня</div>
        {todayEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Пока пусто. Добавьте первый продукт ↑
          </div>
        ) : (
          <ScrollArea className="max-h-72">
            <div className="space-y-1.5">
              {todayEntries.slice().reverse().map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2.5 group hover:bg-muted/70 transition-smooth">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{e.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.grams}г · <span className="text-macro-calories font-semibold">{e.calories}</span> ккал · 
                      Б{e.protein} Ж{e.fat} У{e.carbs}
                    </div>
                  </div>
                  <button
                    onClick={async () => await onRemove(e.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-smooth p-1"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </Card>
  );
};
