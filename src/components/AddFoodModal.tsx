import { useState, useEffect, useMemo } from 'react';
import { X, Package, BookOpen, PenLine, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { loadProducts, saveProduct, type Product } from '@/lib/products';
import { loadRecipes, type Recipe } from '@/lib/recipes';
import type { DiaryEntry } from '@/lib/storage';

interface AddFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (entry: Omit<DiaryEntry, 'id' | 'addedAt'>) => Promise<void>;
  selectedDate: string;
}

type Tab = 'product' | 'dish' | 'manual';

export const AddFoodModal = ({ isOpen, onClose, onAdd, selectedDate }: AddFoodModalProps) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('product');
  const [products, setProducts] = useState<Product[]>([]);
  const [dishes, setDishes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Product | Recipe | null>(null);
  const [grams, setGrams] = useState('100');
  const [loading, setLoading] = useState(true);

  // Manual entry state
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [saveToBase, setSaveToBase] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;
    const load = async () => {
      setLoading(true);
      const [p, d] = await Promise.all([loadProducts(), loadRecipes()]);
      setProducts(p);
      setDishes(d);
      setLoading(false);
    };
    load();
  }, [isOpen, user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = activeTab === 'product' ? products : dishes;
    if (!q) return list;
    return list.filter(item => item.name.toLowerCase().includes(q));
  }, [query, products, dishes, activeTab]);

  const handleSelect = (item: Product | Recipe) => {
    setSelected(item);
    setQuery(item.name);
  };

  const isPortion = (item: Product | Recipe): boolean => {
    return 'servingType' in item && item.servingType === 'portion';
  };

  const handleAdd = async () => {
    if (!selected) return;
    const isPortionType = isPortion(selected);

    let entry: Omit<DiaryEntry, 'id' | 'addedAt'>;

    if (isPortionType) {
      entry = {
        foodId: selected.id,
        name: selected.name,
        grams: 1,
        calories: selected.calories,
        protein: selected.protein,
        fat: selected.fat,
        carbs: selected.carbs,
        date: selectedDate,
      };
    } else {
      const g = Number(grams);
      if (!g || g <= 0) return;
      const factor = g / 100;
      entry = {
        foodId: selected.id,
        name: selected.name,
        grams: g,
        calories: Math.round(selected.calories * factor),
        protein: +(selected.protein * factor).toFixed(1),
        fat: +(selected.fat * factor).toFixed(1),
        carbs: +(selected.carbs * factor).toFixed(1),
        date: selectedDate,
      };
    }

    await onAdd(entry);
    resetForm();
    onClose();
  };

  const handleManualAdd = async () => {
    if (!manualName || !manualCalories) return;
    
    if (saveToBase && user) {
      await saveProduct({
        name: manualName,
        calories: Number(manualCalories) || 0,
        protein: Number(manualProtein) || 0,
        fat: Number(manualFat) || 0,
        carbs: Number(manualCarbs) || 0,
      }, user.uid);
    }

    const entry: Omit<DiaryEntry, 'id' | 'addedAt'> = {
      foodId: saveToBase ? manualName : 'manual-' + Date.now(),
      name: manualName,
      grams: 100,
      calories: Number(manualCalories) || 0,
      protein: Number(manualProtein) || 0,
      fat: Number(manualFat) || 0,
      carbs: Number(manualCarbs) || 0,
      date: selectedDate,
    };
    
    await onAdd(entry);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setQuery('');
    setSelected(null);
    setGrams('100');
    setManualName('');
    setManualCalories('');
    setManualProtein('');
    setManualFat('');
    setManualCarbs('');
    setSaveToBase(false);
    setActiveTab('product');
  };


  const tabs = [
    { id: 'product' as Tab, label: 'Продукт', icon: Package },
    { id: 'dish' as Tab, label: 'Блюдо', icon: BookOpen },
    { id: 'manual' as Tab, label: 'Вручную', icon: PenLine },
  ];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none`}
      aria-hidden={!isOpen}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-2000 ease-in-out"
        style={{
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      />

      {/* Modal */}
      <div
        className="relative w-full sm:max-w-lg bg-background border border-border/50 rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto transition-transform duration-2000 ease-in-out"
        style={{
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">Добавить еду</h2>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-muted/50 transition-smooth">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1.5 mb-5 rounded-xl bg-muted/40 p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelected(null); setQuery(''); }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-smooth ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] text-primary-foreground shadow-glow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Keep all existing tab content exactly as before */}
        {(activeTab === 'product' || activeTab === 'dish') && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={activeTab === 'product' ? 'Поиск продуктов...' : 'Поиск блюд...'}
                value={query}
                onChange={e => { setQuery(e.target.value); setSelected(null); }}
                className="pl-9"
              />
            </div>

            {!selected && (
              <div className="space-y-1 max-h-56 overflow-y-auto rounded-xl border border-border/50 bg-muted/20 p-2">
                {loading && <p className="text-sm text-muted-foreground text-center py-4">Загрузка...</p>}
                {!loading && filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Ничего не найдено</p>
                )}
                {filtered.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-smooth flex items-center justify-between gap-2"
                  >
                    <span className="text-sm font-medium truncate">{item.name}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {'servingType' in item && item.servingType === 'portion'
                        ? `${item.calories} ккал/порц` 
                        : `${item.calories} ккал/100г`}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {selected && (
              <div className="rounded-xl border-2 border-primary/30 bg-muted/20 p-4 space-y-3">
                <div>
                  <div className="font-semibold">{selected.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {isPortion(selected)
                      ? `Порция: ${selected.calories} ккал · Б ${selected.protein} · Ж ${selected.fat} · У ${selected.carbs}` 
                      : `на 100г: ${selected.calories} ккал · Б ${selected.protein} · Ж ${selected.fat} · У ${selected.carbs}`}
                  </div>
                </div>

                {!isPortion(selected) && (
                  <div>
                    <Label className="text-xs">Граммы</Label>
                    <Input
                      type="number"
                      min={1}
                      value={grams}
                      onChange={e => setGrams(e.target.value)}
                      autoFocus
                    />
                  </div>
                )}

                {isPortion(selected) && (
                  <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                    🍽️ Добавится как одна порция
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleAdd}
                    className="flex-1 bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] border-0 text-primary-foreground hover:opacity-90"
                  >
                    Добавить
                  </Button>
                  <Button variant="ghost" onClick={() => { setSelected(null); setQuery(''); }}>
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="space-y-4">
            <div>
              <Label>Название</Label>
              <Input
                placeholder="Например: Борщ домашний"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Калории (ккал)</Label>
                <Input type="number" placeholder="0" value={manualCalories} onChange={e => setManualCalories(e.target.value)} />
              </div>
              <div>
                <Label>Белки (г)</Label>
                <Input type="number" placeholder="0" value={manualProtein} onChange={e => setManualProtein(e.target.value)} />
              </div>
              <div>
                <Label>Жиры (г)</Label>
                <Input type="number" placeholder="0" value={manualFat} onChange={e => setManualFat(e.target.value)} />
              </div>
              <div>
                <Label>Углеводы (г)</Label>
                <Input type="number" placeholder="0" value={manualCarbs} onChange={e => setManualCarbs(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Сохранить в базу продуктов</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {saveToBase ? 'Продукт сохранится и будет доступен всем' : 'Только в дневник, без сохранения'}
                </p>
              </div>
              <button
                onClick={() => setSaveToBase(!saveToBase)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ml-3 ${
                  saveToBase ? 'bg-gradient-to-r from-[#4C1D95] to-[#7C3AED]' : 'bg-muted'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${saveToBase ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <Button
              onClick={handleManualAdd}
              disabled={!manualName || !manualCalories}
              className="w-full bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] border-0 text-primary-foreground hover:opacity-90"
            >
              Добавить запись
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
