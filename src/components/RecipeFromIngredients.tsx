import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { loadProducts, saveProduct, type Product } from "@/lib/products";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Plus, Trash2, Calculator, Edit2, Check, X, PackagePlus } from "lucide-react";
import type { RecipeIngredient as RecipeIngredientType } from "@/lib/recipes";

const DRAFT_KEY = 'recipe_ingredients_draft';

interface RecipeIngredient {
  product: Product;
  grams: number;
}

interface RecipeFromIngredientsProps {
  onSave: (recipe: {
    name: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    text: string;
    servingType: 'grams' | 'portion';
    totalGrams?: number;
    ingredients?: RecipeIngredientType[];
  }) => void;
  onCancel: () => void;
  initialData?: {
    name: string;
    ingredients: RecipeIngredientType[];
    description: string;
    servingType: 'grams' | 'portion';
    totalGrams?: number;
  };
}

export const RecipeFromIngredients = ({ onSave, onCancel, initialData }: RecipeFromIngredientsProps) => {
  const [recipeName, setRecipeName] = useState(initialData?.name || "");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [grams, setGrams] = useState("");
  const [description, setDescription] = useState(initialData?.description || "");
  const [loading, setLoading] = useState(false);
  const [servingType, setServingType] = useState<'grams' | 'portion'>(initialData?.servingType || 'grams');
  const [editingGramsIndex, setEditingGramsIndex] = useState<number | null>(null);
  const [editingGramsValue, setEditingGramsValue] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [showAddProductForm, setShowAddProductForm] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCalories, setNewProductCalories] = useState("");
  const [newProductProtein, setNewProductProtein] = useState("");
  const [newProductFat, setNewProductFat] = useState("");
  const [newProductCarbs, setNewProductCarbs] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);
  const { user } = useAuth();

  // Load products on component mount
  useEffect(() => {
    loadProductsList();
  }, []);

  // Load initial ingredients if editing
  useEffect(() => {
    if (initialData?.ingredients && products.length > 0) {
      const loadedIngredients: RecipeIngredient[] = initialData.ingredients.map(ing => {
        const product = products.find(p => p.id === ing.productId);
        if (!product) return null;
        return {
          product,
          grams: ing.grams
        };
      }).filter((ing): ing is RecipeIngredient => ing !== null);
      setIngredients(loadedIngredients);
    }
  }, [initialData, products]);

  // Filter products when search query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts([]);
    }
  }, [searchQuery, products]);

  // Check for existing draft on mount (only when not editing)
  useEffect(() => {
    if (!initialData) {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          if (draft.recipeName || (draft.ingredients && draft.ingredients.length > 0)) {
            setHasDraft(true);
          }
        } catch {}
      }
    }
  }, []);

  // Auto-save draft whenever form has content
  useEffect(() => {
    if (!initialData && (recipeName || ingredients.length > 0 || description)) {
      const draft = {
        recipeName,
        ingredients: ingredients.map(ing => ({ product: ing.product, grams: ing.grams })),
        description,
        servingType,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  }, [recipeName, ingredients, description, servingType, initialData]);

  const loadProductsList = async () => {
    setLoading(true);
    try {
      const productsList = await loadProducts();
      setProducts(productsList);
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Ошибка загрузки продуктов");
    } finally {
      setLoading(false);
    }
  };

  const loadDraft = () => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setRecipeName(draft.recipeName || "");
        setIngredients(draft.ingredients || []);
        setDescription(draft.description || "");
        setServingType(draft.servingType || 'grams');
        setHasDraft(false);
      } catch {
        toast.error("Ошибка загрузки черновика");
      }
    }
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
  };

  const handleSaveNewProduct = async () => {
    if (!user || !newProductName.trim() || !newProductCalories) return;
    setSavingProduct(true);
    try {
      const newProductId = await saveProduct({
        name: newProductName.trim(),
        calories: Number(newProductCalories) || 0,
        protein: Number(newProductProtein) || 0,
        fat: Number(newProductFat) || 0,
        carbs: Number(newProductCarbs) || 0,
      }, user.uid);
      const updatedProducts = await loadProducts();
      setProducts(updatedProducts);
      const addedProduct = updatedProducts.find(p => p.id === newProductId);
      if (addedProduct) {
        setSelectedProduct(addedProduct);
        setSearchQuery(addedProduct.name);
        setFilteredProducts([]);
      }
      setShowAddProductForm(false);
      setNewProductName("");
      setNewProductCalories("");
      setNewProductProtein("");
      setNewProductFat("");
      setNewProductCarbs("");
      toast.success(`«${newProductName.trim()}» добавлен в базу`);
    } catch {
      toast.error("Ошибка добавления продукта");
    } finally {
      setSavingProduct(false);
    }
  };

  const calculateTotals = () => {
    return ingredients.reduce((acc, ingredient) => {
      const factor = ingredient.grams / 100; // Convert from per-100g to actual grams
      return {
        calories: acc.calories + (ingredient.product.calories * factor),
        protein: acc.protein + (ingredient.product.protein * factor),
        fat: acc.fat + (ingredient.product.fat * factor),
        carbs: acc.carbs + (ingredient.product.carbs * factor),
      };
    }, { calories: 0, protein: 0, fat: 0, carbs: 0 });
  };

  const totals = calculateTotals();
  const totalGrams = ingredients.reduce((sum, ing) => sum + ing.grams, 0);

  const handleAddIngredient = () => {
    if (!selectedProduct || !grams || Number(grams) <= 0) {
      toast.error("Выберите продукт и укажите граммовку");
      return;
    }

    const newIngredient: RecipeIngredient = {
      product: selectedProduct,
      grams: Number(grams)
    };

    setIngredients([...ingredients, newIngredient]);
    setSelectedProduct(null);
    setGrams("");
    setSearchQuery("");
    setFilteredProducts([]);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleStartEditGrams = (index: number) => {
    setEditingGramsIndex(index);
    setEditingGramsValue(ingredients[index].grams.toString());
  };

  const handleSaveGrams = (index: number) => {
    const newGrams = Number(editingGramsValue);
    if (newGrams <= 0) {
      toast.error("Граммовка должна быть больше 0");
      return;
    }
    const updatedIngredients = [...ingredients];
    updatedIngredients[index].grams = newGrams;
    setIngredients(updatedIngredients);
    setEditingGramsIndex(null);
    setEditingGramsValue("");
  };

  const handleCancelEditGrams = () => {
    setEditingGramsIndex(null);
    setEditingGramsValue("");
  };

  const handleSaveRecipe = () => {
    if (!recipeName.trim()) {
      toast.error("Введите название блюда");
      return;
    }

    if (ingredients.length === 0) {
      toast.error("Добавьте хотя бы один ингредиент");
      return;
    }

    const ingredientsList = ingredients
      .map(ing => `${ing.product.name} - ${ing.grams}г`)
      .join('\n');

    const fullDescription = description 
      ? `Ингредиенты:\n${ingredientsList}\n\nОписание:\n${description}`
      : `Ингредиенты:\n${ingredientsList}`;

    // Convert ingredients to RecipeIngredientType format
    const ingredientsData: RecipeIngredientType[] = ingredients.map(ing => ({
      productId: ing.product.id,
      productName: ing.product.name,
      grams: ing.grams,
      calories: ing.product.calories,
      protein: ing.product.protein,
      fat: ing.product.fat,
      carbs: ing.product.carbs,
    }));

    // For grams-based recipes store per-100g values; for portion store absolute totals
    const savedCalories = servingType === 'grams' && totalGrams > 0
      ? Math.round((totals.calories / totalGrams) * 100)
      : Math.round(totals.calories);
    const savedProtein = servingType === 'grams' && totalGrams > 0
      ? Math.round((totals.protein / totalGrams) * 100 * 10) / 10
      : Math.round(totals.protein * 10) / 10;
    const savedFat = servingType === 'grams' && totalGrams > 0
      ? Math.round((totals.fat / totalGrams) * 100 * 10) / 10
      : Math.round(totals.fat * 10) / 10;
    const savedCarbs = servingType === 'grams' && totalGrams > 0
      ? Math.round((totals.carbs / totalGrams) * 100 * 10) / 10
      : Math.round(totals.carbs * 10) / 10;

    clearDraft();
    onSave({
      name: recipeName,
      calories: savedCalories,
      protein: savedProtein,
      fat: savedFat,
      carbs: savedCarbs,
      text: fullDescription,
      servingType,
      totalGrams: servingType === 'portion' ? totalGrams : undefined,
      ingredients: ingredientsData
    });
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setFilteredProducts([]);
  };

  return (
    <div className="space-y-6">
      {hasDraft && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-400">Есть несохранённый черновик</p>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={loadDraft} className="text-xs border-amber-500/30 text-amber-400 h-7">
              Восстановить
            </Button>
            <Button size="sm" variant="ghost" onClick={clearDraft} className="text-xs text-muted-foreground h-7">
              Отклонить
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="recipeName">Название блюда</Label>
        <Input
          id="recipeName"
          type="text"
          value={recipeName}
          onChange={(e) => setRecipeName(e.target.value)}
          placeholder="Например: Овощной салат"
          required
        />
      </div>

      <div className="space-y-4">
        <Label>Ингредиенты</Label>
        
        {/* Add ingredient form */}
        <Card className="p-4 border-border/50">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Поиск продукта..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Product search results */}
            {filteredProducts.length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-border/30 rounded-md">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => handleProductSelect(product)}
                    className="p-2 hover:bg-muted/50 cursor-pointer border-b border-border/20 last:border-b-0"
                  >
                    <div className="font-medium text-sm">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {product.calories} ккал | Б:{product.protein}г Ж:{product.fat}г У:{product.carbs}г
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* No results — offer to add product to database */}
            {searchQuery.trim() && !selectedProduct && filteredProducts.length === 0 && !loading && (
              <div className="border border-border/30 rounded-md p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Продукт не найден в базе</p>
                {!showAddProductForm ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setNewProductName(searchQuery.trim()); setShowAddProductForm(true); }}
                    className="w-full text-xs flex items-center gap-2 h-8"
                  >
                    <PackagePlus className="h-3 w-3" />
                    Добавить «{searchQuery}» в базу продуктов
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium">{newProductName} — КБЖУ на 100г</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" placeholder="Калории" value={newProductCalories} onChange={e => setNewProductCalories(e.target.value)} className="h-8 text-xs" />
                      <Input type="number" placeholder="Белки" value={newProductProtein} onChange={e => setNewProductProtein(e.target.value)} className="h-8 text-xs" />
                      <Input type="number" placeholder="Жиры" value={newProductFat} onChange={e => setNewProductFat(e.target.value)} className="h-8 text-xs" />
                      <Input type="number" placeholder="Углеводы" value={newProductCarbs} onChange={e => setNewProductCarbs(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveNewProduct}
                        disabled={savingProduct || !newProductCalories}
                        className="flex-1 text-xs bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-0 h-8"
                      >
                        {savingProduct ? 'Сохранение...' : 'Сохранить продукт'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => { setShowAddProductForm(false); setNewProductCalories(''); setNewProductProtein(''); setNewProductFat(''); setNewProductCarbs(''); }}
                        className="text-xs h-8"
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="Граммы"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  min="1"
                />
              </div>
              <Button
                onClick={handleAddIngredient}
                disabled={!selectedProduct || !grams || Number(grams) <= 0}
                className="bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-0 text-foreground hover:opacity-90 shadow-glow"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Ingredients list */}
        {ingredients.length > 0 && (
          <Card className="p-4 border-border/50">
            <div className="space-y-2">
              {ingredients.map((ingredient, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex-1">
                    <span className="font-medium">{ingredient.product.name}</span>
                    {editingGramsIndex === index ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          value={editingGramsValue}
                          onChange={(e) => setEditingGramsValue(e.target.value)}
                          className="w-20 h-8 text-sm"
                          min="1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveGrams(index);
                            if (e.key === 'Escape') handleCancelEditGrams();
                          }}
                        />
                        <span className="text-sm text-muted-foreground">г</span>
                        <Button
                          size="sm"
                          onClick={() => handleSaveGrams(index)}
                          className="h-8 w-8 p-0 bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] hover:opacity-90"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEditGrams}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-muted-foreground ml-2">{ingredient.grams}г</span>
                        <div className="text-xs text-muted-foreground">
                          {Math.round(ingredient.product.calories * ingredient.grams / 100)} ккал
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {editingGramsIndex !== index && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartEditGrams(index)}
                        className="text-muted-foreground hover:text-primary p-2"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveIngredient(index)}
                      className="text-muted-foreground hover:text-destructive p-2"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Totals */}
        {ingredients.length > 0 && (
          <Card className="p-4 border-border/50 bg-gradient-to-r from-[#0a0520]/10 to-[#1a0a3d]/10">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="h-4 w-4" />
              <span className="font-semibold">Итого КБЖУ</span>
            </div>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-lg font-bold">{Math.round(totals.calories)}</div>
                <div className="text-xs text-muted-foreground">ккал</div>
              </div>
              <div>
                <div className="text-lg font-bold">{Math.round(totals.protein * 10) / 10}г</div>
                <div className="text-xs text-muted-foreground">белки</div>
              </div>
              <div>
                <div className="text-lg font-bold">{Math.round(totals.fat * 10) / 10}г</div>
                <div className="text-xs text-muted-foreground">жиры</div>
              </div>
              <div>
                <div className="text-lg font-bold">{Math.round(totals.carbs * 10) / 10}г</div>
                <div className="text-xs text-muted-foreground">углеводы</div>
              </div>
            </div>
            {servingType === 'grams' && totalGrams > 0 && (
              <div className="mt-2 pt-2 border-t border-border/20 text-xs text-muted-foreground text-center">
                На 100г: {Math.round(totals.calories / totalGrams * 100)} ккал · Б {(totals.protein / totalGrams * 100).toFixed(1)} · Ж {(totals.fat / totalGrams * 100).toFixed(1)} · У {(totals.carbs / totalGrams * 100).toFixed(1)}
              </div>
            )}
          </Card>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Тип порции</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setServingType('grams')}
            className={`rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-smooth ${
              servingType === 'grams'
                ? 'border-primary bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] text-foreground'
                : 'border-border bg-background text-muted-foreground'
            }`}
          >
            ⚖️ По граммам
          </button>
          <button
            type="button"
            onClick={() => setServingType('portion')}
            className={`rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-smooth ${
              servingType === 'portion'
                ? 'border-primary bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] text-foreground'
                : 'border-border bg-background text-muted-foreground'
            }`}
          >
            🍽️ Порция
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Дополнительное описание (необязательно)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Способ приготовления, заметки..."
          rows={3}
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1 text-muted-foreground hover:text-primary"
        >
          Отмена
        </Button>
        <Button
          onClick={handleSaveRecipe}
          disabled={!recipeName.trim() || ingredients.length === 0}
          className="flex-1 bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-0 text-foreground hover:opacity-90 shadow-glow"
        >
          Сохранить блюдо
        </Button>
      </div>
    </div>
  );
};
