import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Trash2, Utensils, Package, BookOpen } from "lucide-react";
import type { FoodItem } from "@/lib/nutrition";
import type { DiaryEntry } from "@/lib/storage";
import { useAuth } from "@/contexts/AuthContext";
import { loadProducts, type Product } from "@/lib/products";
import { loadRecipes, type Recipe } from "@/lib/recipes";
import { updateUsageStat, getLastAmount, loadUsageStats, type UsageStat } from "@/lib/firestore";

interface SearchItem {
  id: string;
  name: string;
  type: 'product' | 'recipe';
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  originalData?: Product | Recipe;
}

interface DiaryProps {
  entries: DiaryEntry[];
  onAdd: (entry: Omit<DiaryEntry, 'id' | 'addedAt'>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export const Diary = ({ entries, onAdd, onRemove }: DiaryProps) => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SearchItem | null>(null);
  const [grams, setGrams] = useState("100");
  const [userProducts, setUserProducts] = useState<Product[]>([]);
  const [userRecipes, setUserRecipes] = useState<Recipe[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      try {
        const [products, recipes, stats] = await Promise.all([
          loadProducts(),
          loadRecipes(),
          loadUsageStats(user.uid)
        ]);
        setUserProducts(products);
        setUserRecipes(recipes);
        setUsageStats(stats.slice(0, 5)); // show top 5 most used
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const getScore = (itemId: string): number => {
    const stat = usageStats.find(s => s.productId === itemId);
    if (!stat) return 0;
    const frequencyScore = stat.usageCount * 10;
    const daysSinceUse = (Date.now() - stat.lastUsedAt.toMillis()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 30 - daysSinceUse);
    return frequencyScore + recencyScore;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const results: SearchItem[] = [];
    
    if (!q) {
      // Show all user products when no search
      results.push(...userProducts
        .slice()
        .sort((a, b) => getScore(b.id) - getScore(a.id))
        .map(p => ({
          id: p.id,
          name: p.name,
          type: 'product' as const,
          calories: p.calories,
          protein: p.protein,
          fat: p.fat,
          carbs: p.carbs,
          originalData: p
        })));
      
      // Add separator if we have both products and recipes
      if (userProducts.length > 0 && userRecipes.length > 0) {
        results.push({
          id: 'recipes-separator',
          name: 'Рецепты',
          type: 'recipe' as const,
          calories: 0,
          protein: 0,
          fat: 0,
          carbs: 0
        });
      }
      
      results.push(...userRecipes
        .slice()
        .sort((a, b) => getScore(b.id) - getScore(a.id))
        .map(r => ({
          id: r.id,
          name: r.name,
          type: 'recipe' as const,
          calories: r.calories,
          protein: r.protein,
          fat: r.fat,
          carbs: r.carbs,
          originalData: r
        })));
    } else {
      // Search functionality - only user products and recipes
      const matchingProducts = userProducts.filter(p => p.name.toLowerCase().includes(q));
      matchingProducts
        .slice()
        .sort((a, b) => getScore(b.id) - getScore(a.id))
        .forEach(p => {
          results.push({
            id: p.id,
            name: p.name,
            type: 'product' as const,
            calories: p.calories,
            protein: p.protein,
            fat: p.fat,
            carbs: p.carbs,
            originalData: p
          });
        });
      
      // Add separator if we have both products and recipes in search results
      const productsInSearch = results.filter(item => item.type === 'product').length;
      const matchingRecipes = userRecipes.filter(r => r.name.toLowerCase().includes(q));
      
      if (productsInSearch > 0 && matchingRecipes.length > 0) {
        results.push({
          id: 'recipes-separator',
          name: 'Рецепты',
          type: 'recipe' as const,
          calories: 0,
          protein: 0,
          fat: 0,
          carbs: 0
        });
      }
      
      matchingRecipes
        .slice()
        .sort((a, b) => getScore(b.id) - getScore(a.id))
        .forEach(r => {
          results.push({
            id: r.id,
            name: r.name,
            type: 'recipe' as const,
            calories: r.calories,
            protein: r.protein,
            fat: r.fat,
            carbs: r.carbs,
            originalData: r
          });
        });
    }
    
    return results;
  }, [query, userProducts, userRecipes, usageStats]);


  const handleAdd = async () => {
    if (!selected) return;
    const g = Number(grams);
    if (!g || g <= 0) return;
    const factor = g / 100;
    
    await onAdd({
      foodId: selected.id,
      name: selected.name,
      grams: g,
      calories: Math.round(selected.calories * factor),
      protein: +(selected.protein * factor).toFixed(1),
      fat: +(selected.fat * factor).toFixed(1),
      carbs: +(selected.carbs * factor).toFixed(1),
      date: '', // Will be set in Index.tsx
    });
    
    if (user) {
      await updateUsageStat(user.uid, {
        id: selected.id,
        name: selected.name,
        type: selected.type,
        amount: g,
      });
    }
    
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
          <p className="text-xs text-muted-foreground">Записи · {entries.length} шт.</p>
        </div>
      </div>

      {/* Поиск */}
      <div className="space-y-3 mb-4">
        {usageStats.length > 0 && !selected && (
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Недавнее</p>
            <div className="flex flex-wrap gap-2">
              {usageStats.map((stat) => (
                <button
                  key={stat.productId}
                  onClick={async () => {
                    const item = [...userProducts, ...userRecipes].find(p => p.id === stat.productId);
                    if (!item) return;
                    const g = stat.lastAmount;
                    const factor = g / 100;
                    await onAdd({
                      foodId: item.id,
                      name: item.name,
                      grams: g,
                      calories: Math.round(item.calories * factor),
                      protein: +(item.protein * factor).toFixed(1),
                      fat: +(item.fat * factor).toFixed(1),
                      carbs: +(item.carbs * factor).toFixed(1),
                      date: '',
                    });
                    if (user) {
                      await updateUsageStat(user.uid, {
                        id: item.id,
                        name: item.name,
                        type: stat.productType,
                        amount: g,
                      });
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-muted/50 hover:bg-gradient-sunset-soft border border-border/50 px-3 py-1.5 text-sm font-medium transition-smooth"
                >
                  {stat.productType === 'recipe' ? '📖' : '📦'} {stat.productName}
                  <span className="text-xs text-muted-foreground ml-1">{stat.lastAmount}г</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск продуктов и рецептов..."
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
              {filtered.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={async () => {
                    if (item.id !== 'recipes-separator') {
                      setSelected(item);
                      if (user) {
                        const lastAmt = await getLastAmount(user.uid, item.id);
                        if (lastAmt) setGrams(String(lastAmt));
                      }
                    }
                  }}
                  disabled={item.id === 'recipes-separator'}
                  className={`w-full text-left rounded-lg px-3 py-2 transition-smooth flex items-center justify-between gap-2 ${
                    item.id === 'recipes-separator' 
                      ? 'bg-muted/50 cursor-default font-semibold text-muted-foreground' 
                      : 'hover:bg-gradient-sunset-soft'
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    {item.type === 'product' && <Package className="h-4 w-4 text-blue-500" />}
                    {item.type === 'recipe' && <BookOpen className="h-4 w-4 text-green-500" />}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.type === 'product' && 'Продукт'}
                        {item.type === 'recipe' && 'Рецепт'}
                      </div>
                    </div>
                  </div>
                  {item.id !== 'recipes-separator' && (
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      <span className="text-macro-calories font-semibold">{item.calories}</span> ккал/100г
                    </div>
                  )}
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
                  placeholder="Введите граммы"
                  autoFocus
                />
              </div>
              <Button onClick={handleAdd} className="bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90">
                <Plus className="h-4 w-4 mr-1" />
                Добавить приём пищи
              </Button>
              <Button variant="ghost" onClick={() => setSelected(null)}>Отмена</Button>
            </div>
          </div>
        )}
      </div>

      {/* Список съеденного */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Съедено</div>
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Нет записей
          </div>
        ) : (
          <ScrollArea className="max-h-72">
            <div className="space-y-1.5">
              {entries.slice().reverse().map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2.5 group hover:bg-muted/70 transition-smooth">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{e.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.grams}г · <span className="text-macro-calories font-semibold">{e.calories}</span> ккал · 
                      Б {e.protein}г · Ж {e.fat}г · У {e.carbs}г
                    </div>
                  </div>
                  <button
                    onClick={async () => await onRemove(e.id)}
                    className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-smooth p-1"
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
