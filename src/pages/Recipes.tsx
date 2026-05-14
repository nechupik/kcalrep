import { useState, useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { loadRecipes, saveRecipe, deleteRecipe, updateRecipe, type Recipe, type RecipeIngredient as RecipeIngredientType } from "@/lib/recipes";
import { loadProducts } from "@/lib/products";
import { RecipeFromIngredients } from "@/components/RecipeFromIngredients";
import { BookOpen, Search, Plus, Edit, Trash2, Calculator } from "lucide-react";

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} ${many}`;
  if (mod10 === 1) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

const Recipes = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [servingType, setServingType] = useState<'grams' | 'portion'>('grams');
  const [addMode, setAddMode] = useState<'manual' | 'ingredients'>('manual');
  const [formData, setFormData] = useState({
    name: "",
    calories: "",
    protein: "",
    fat: "",
    carbs: "",
    description: "",
  });
  const [deletedRecipe, setDeletedRecipe] = useState<Recipe | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [editingRecipeIngredients, setEditingRecipeIngredients] = useState<RecipeIngredientType[] | null>(null);
  const [animationState, setAnimationState] = useState<'enter' | 'exit' | null>(null);

  // Guard: if no user, don't render
  if (!user) {
    return null;
  }

  // Load user's recipes on component mount
  useEffect(() => {
    if (user) {
      loadUserRecipes();
    }
  }, [user]);

  const loadUserRecipes = async () => {
    setLoading(true);
    try {
      const userRecipes = await loadRecipes();
      setRecipes(userRecipes);
    } catch (error) {
      console.error("Error loading recipes:", error);
      toast.error("Ошибка загрузки рецептов");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      // Load all recipes and filter client-side
      const allRecipes = await loadRecipes();
      const filteredRecipes = allRecipes.filter(recipe => 
        recipe.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setRecipes(filteredRecipes);
    } catch (error) {
      console.error("Error searching:", error);
      toast.error("Ошибка поиска");
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecipe = () => {
    if (!user) return;
    
    setShowAddForm(true);
    setAddMode('manual');
  };

  // Control modal animation
  useEffect(() => {
    if (showAddForm) {
      setAnimationState('enter');
    } else {
      setAnimationState('exit');
      setTimeout(() => {
        setAnimationState(null);
      }, 650);
    }
  }, [showAddForm]);

  const handleAddRecipeFromIngredients = () => {
    if (!user) return;
    
    setShowAddForm(true);
    setAddMode('ingredients');
  };

  const handleSaveRecipe = async () => {
    if (!user || !formData.name.trim()) return;
    
    try {
      await saveRecipe({
        name: formData.name,
        calories: Number(formData.calories) || 0,
        protein: Number(formData.protein) || 0,
        fat: Number(formData.fat) || 0,
        carbs: Number(formData.carbs) || 0,
        text: formData.description || null,
        servingType,
      }, user.uid);
      
      toast.success(`Добавлено: ${formData.name}`);
      setFormData({ name: "", calories: "", protein: "", fat: "", carbs: "", description: "" });
      setShowAddForm(false);
      loadUserRecipes(); // Refresh list
    } catch (error) {
      console.error("Error saving recipe:", error);
      toast.error("Ошибка сохранения блюда");
    }
  };

  const handleEditRecipe = async (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setServingType(recipe.servingType || 'grams');
    
    // Check if recipe has structured ingredients (created from ingredients)
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      setEditingRecipeIngredients(recipe.ingredients);
      setAddMode('ingredients');
    } else {
      // Try to parse ingredients from text description for older recipes
      const parsedIngredients = await parseIngredientsFromText(recipe.text || "");
      if (parsedIngredients.length > 0) {
        setEditingRecipeIngredients(parsedIngredients);
        setAddMode('ingredients');
      } else {
        setEditingRecipeIngredients(null);
        setAddMode('manual');
        setFormData({
          name: recipe.name,
          calories: recipe.calories.toString(),
          protein: recipe.protein.toString(),
          fat: recipe.fat.toString(),
          carbs: recipe.carbs.toString(),
          description: recipe.text || "",
        });
      }
    }
    setShowAddForm(true);
  };

  // Helper function to parse ingredients from text description
  const parseIngredientsFromText = async (text: string): Promise<RecipeIngredientType[]> => {
    const ingredients: RecipeIngredientType[] = [];
    const lines = text.split('\n');
    
    // Load products to match names
    const products = await loadProducts();
    
    for (const line of lines) {
      // Match pattern like "Молоко Netto 1.5% - 200г"
      const match = line.match(/(.+?)\s*-\s*(\d+)\s*г/i);
      if (match) {
        const productName = match[1].trim();
        const grams = parseInt(match[2], 10);
        
        // Try to find the product in the database by name
        const product = products.find(p => p.name.toLowerCase() === productName.toLowerCase());
        
        if (product) {
          ingredients.push({
            productId: product.id,
            productName: product.name,
            grams: grams,
            calories: product.calories,
            protein: product.protein,
            fat: product.fat,
            carbs: product.carbs,
          });
        } else {
          // Create a placeholder ingredient that user will need to fix
          ingredients.push({
            productId: '',
            productName: productName,
            grams: grams,
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
          });
        }
      }
    }
    
    return ingredients;
  };

  const handleUpdateRecipe = async () => {
    if (!user || !editingRecipe) return;
    
    try {
      // If editing recipe with ingredients, use the ingredient-based update
      if (editingRecipeIngredients && editingRecipeIngredients.length > 0) {
        // Calculate totals from ingredients
        const totals = editingRecipeIngredients.reduce((acc, ing) => {
          const factor = ing.grams / 100;
          return {
            calories: acc.calories + (ing.calories * factor),
            protein: acc.protein + (ing.protein * factor),
            fat: acc.fat + (ing.fat * factor),
            carbs: acc.carbs + (ing.carbs * factor),
          };
        }, { calories: 0, protein: 0, fat: 0, carbs: 0 });

        const ingredientsList = editingRecipeIngredients
          .map(ing => `${ing.productName} - ${ing.grams}г`)
          .join('\n');

        await updateRecipe(editingRecipe.id!, {
          name: editingRecipe.name,
          calories: Math.round(totals.calories),
          protein: Math.round(totals.protein * 10) / 10,
          fat: Math.round(totals.fat * 10) / 10,
          carbs: Math.round(totals.carbs * 10) / 10,
          text: editingRecipe.text || `Ингредиенты:\n${ingredientsList}`,
          servingType: editingRecipe.servingType || 'grams',
          ingredients: editingRecipeIngredients,
        });
      } else {
        // Manual edit mode
        if (!formData.name.trim()) return;
        await updateRecipe(editingRecipe.id!, {
          name: formData.name,
          calories: Number(formData.calories) || 0,
          protein: Number(formData.protein) || 0,
          fat: Number(formData.fat) || 0,
          carbs: Number(formData.carbs) || 0,
          text: formData.description || null,
          servingType,
        });
      }
      
      toast.success(`Обновлено: ${editingRecipe.name}`);
      setEditingRecipe(null);
      setEditingRecipeIngredients(null);
      setFormData({ name: "", calories: "", protein: "", fat: "", carbs: "", description: "" });
      setShowAddForm(false);
      loadUserRecipes(); // Refresh list
    } catch (error) {
      console.error("Error updating recipe:", error);
      toast.error("Ошибка обновления блюда");
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!user) return;
    
    try {
      // Find recipe before deletion
      const recipeToDelete = recipes.find(r => r.id === recipeId);
      if (!recipeToDelete) return;
      
      // Remove from UI immediately
      setRecipes(prev => prev.filter(r => r.id !== recipeId));
      
      // Store deleted recipe for potential restoration
      setDeletedRecipe(recipeToDelete);
      
      // Show toast with undo option
      toast.success(`Блюдо "${recipeToDelete.name}" удалёно`, {
        action: {
          label: "Отменить",
          onClick: () => handleRestoreRecipe(recipeToDelete)
        },
        duration: 5000 // 5 seconds to undo
      });
      
      // Actually delete after delay
      setTimeout(async () => {
        try {
          await deleteRecipe(recipeId);
        } catch (error) {
          console.error("Error deleting recipe:", error);
          toast.error("Ошибка удаления блюда");
          // Restore recipe if deletion failed
          setRecipes(prev => [...prev, recipeToDelete]);
        }
      }, 5000);
    } catch (error) {
      console.error("Error deleting recipe:", error);
      toast.error("Ошибка удаления блюда");
    }
  };

  const handleRestoreRecipe = (recipe: Recipe) => {
    // Restore recipe to UI and cancel deletion
    setRecipes(prev => [...prev, recipe]);
    setDeletedRecipe(null);
    toast.info(`Блюдо "${recipe.name}" восстановлено`);
  };

  // Reset to first page when recipes change
  useEffect(() => {
    setCurrentPage(1);
  }, [recipes]);

  // Calculate pagination
  const totalPages = Math.ceil(recipes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRecipes = recipes.slice(startIndex, endIndex);

  // Pagination controls
  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const goToPreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const handleCancelEdit = () => {
    setEditingRecipe(null);
    setEditingRecipeIngredients(null);
    setServingType('grams');
    setAddMode('manual');
    setFormData({ name: "", calories: "", protein: "", fat: "", carbs: "", description: "" });
    setShowAddForm(false);
  };

  const handleSaveRecipeFromIngredients = async (recipeData: {
    name: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    text: string;
    servingType: 'grams' | 'portion';
    ingredients?: RecipeIngredientType[];
  }) => {
    if (!user) return;
    
    try {
      if (editingRecipe) {
        // Update existing recipe
        await updateRecipe(editingRecipe.id!, recipeData);
        toast.success(`Обновлено: ${recipeData.name}`);
      } else {
        // Create new recipe
        await saveRecipe(recipeData, user.uid);
        toast.success(`Добавлено: ${recipeData.name}`);
      }
      
      setShowAddForm(false);
      setAddMode('manual');
      setEditingRecipe(null);
      setEditingRecipeIngredients(null);
      loadUserRecipes(); // Refresh list
    } catch (error) {
      console.error("Error saving recipe:", error);
      toast.error("Ошибка сохранения блюда");
    }
  };

  // Truncate description for preview
  const truncateDescription = (description: string, maxLength: number = 100) => {
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength) + "...";
  };

  return (
    <div className="min-h-screen">
      <AppHeader />

      <section className="container max-w-3xl pt-6 pb-12">
        
        {/* Search bar */}
        <Card className="p-4 md:p-6 bg-card/80 backdrop-blur-sm border-border/50 shadow-soft mb-6">
          <div className="flex gap-2 mb-4 items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
              <Input
                id="search"
                type="text"
                placeholder="Поиск блюд..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-12 h-10"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] px-6 py-0 h-10 text-foreground font-bold text-lg shadow-glow hover:opacity-90 transition-smooth"
            >
              <span className="hidden sm:inline">Поиск</span>
              <span className="sm:hidden">Найти</span>
            </Button>
          </div>

        </Card>

        {/* Recipes list */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-soft mb-8">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Мои блюда</h2>
              <div className="text-sm text-muted-foreground">
                {pluralize(recipes.length, 'блюдо', 'блюда', 'блюд')}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Загрузка...</div>
              </div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Блюд пока нет</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Добавьте первое блюдо!
                </p>
                <Button
                  onClick={handleAddRecipe}
                  disabled={!user}
                  className="bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-0 text-foreground hover:opacity-90 shadow-glow"
                >
                  Создать блюдо
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Show current page recipes */}
                {currentRecipes.map((recipe) => (
                  <Card key={recipe.id} className="rounded-xl border border-border/50 bg-card/80 p-4 hover:bg-card transition-smooth">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg mb-2 break-words">{recipe.name}</h3>
                        
                        {/* KBJU pills */}
                        <div className="flex items-center gap-4 text-left">
                          <span className="text-xs md:text-sm font-medium">{recipe.calories} ккал</span>
                          <span className="text-xs md:text-sm font-medium">Б {recipe.protein}г</span>
                          <span className="text-xs md:text-sm font-medium">Ж {recipe.fat}г</span>
                          <span className="text-xs md:text-sm font-medium">У {recipe.carbs}г</span>
                        </div>

                        {/* Description preview */}
                        {recipe.text && (
                          <div className="text-sm text-muted-foreground">
                            {truncateDescription(recipe.text)}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-1 md:gap-2 items-center ml-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditRecipe(recipe)}
                          className="text-muted-foreground hover:text-primary p-2 md:p-2"
                        >
                          <Edit className="h-3 w-3 md:h-4 md:w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRecipe(recipe.id!)}
                          className="text-muted-foreground hover:text-destructive p-2 md:p-2"
                        >
                          <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
                
                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center pt-4 border-t border-border/30">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </Button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => goToPage(page)}
                            className={`h-8 w-8 p-0 ${
                              currentPage === page
                                ? "bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] text-foreground border-0"
                                : "border-border/50 hover:bg-muted/50"
                            }`}
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Add/Edit Recipe Modal */}
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div
              onClick={handleCancelEdit}
              className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${animationState === 'enter' ? 'overlay-enter' : animationState === 'exit' ? 'overlay-exit' : ''}`}
            />
            <div
              className={`relative w-full sm:max-w-2xl bg-background border border-border/50 rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto ${animationState === 'enter' ? 'modal-enter' : animationState === 'exit' ? 'modal-exit' : ''}`}
              style={{ transform: animationState === null ? 'translateY(100%)' : undefined }}
            >
              {editingRecipe ? (
                // Edit mode - show tabs if recipe has ingredients
                <>
                  {editingRecipeIngredients && editingRecipeIngredients.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-4 rounded-xl bg-muted/40 p-1">
                      <button
                        onClick={() => setAddMode('ingredients')}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-smooth ${
                          addMode === 'ingredients'
                            ? 'bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] text-primary-foreground shadow-glow'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Calculator className="h-4 w-4" />
                        Из ингредиентов
                      </button>
                      <button
                        onClick={() => setAddMode('manual')}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-smooth ${
                          addMode === 'manual'
                            ? 'bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] text-primary-foreground shadow-glow'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <BookOpen className="h-4 w-4" />
                        Вручную
                      </button>
                    </div>
                  )}
                  {addMode === 'ingredients' && editingRecipeIngredients && editingRecipeIngredients.length > 0 ? (
                    <RecipeFromIngredients
                      onSave={handleSaveRecipeFromIngredients}
                      onCancel={handleCancelEdit}
                      initialData={{
                        name: editingRecipe.name,
                        ingredients: editingRecipeIngredients,
                        description: editingRecipe.text?.replace(/Ингредиенты:.*?(\n\nОписание:|$)/s, '').trim() || '',
                        servingType: editingRecipe.servingType || 'grams'
                      }}
                    />
                  ) : (
                // Edit mode for manual recipes
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Название блюда</Label>
                    <Input
                      id="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Название блюда"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="calories">Калории (на 100г)</Label>
                      <Input
                        id="calories"
                        type="number"
                        value={formData.calories}
                        onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                        placeholder="0"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="protein">Белки (на 100г)</Label>
                      <Input
                        id="protein"
                        type="number"
                        step="0.1"
                        value={formData.protein}
                        onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                        placeholder="0"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fat">Жиры (на 100г)</Label>
                      <Input
                        id="fat"
                        type="number"
                        step="0.1"
                        value={formData.fat}
                        onChange={(e) => setFormData({ ...formData, fat: e.target.value })}
                        placeholder="0"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="carbs">Углеводы (на 100г)</Label>
                      <Input
                        id="carbs"
                        type="number"
                        step="0.1"
                        value={formData.carbs}
                        onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
                        placeholder="0"
                        required
                      />
                    </div>
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
                    <Label htmlFor="description">Описание блюда</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Напишите описание: ингредиенты, шаги, заметки..."
                      rows={6}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={handleCancelEdit}
                      className="flex-1 text-muted-foreground hover:text-primary"
                    >
                      Отмена
                    </Button>
                    <Button
                      onClick={handleUpdateRecipe}
                      disabled={!formData.name.trim()}
                      className="flex-1 bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-0 text-foreground hover:opacity-90 shadow-glow"
                    >
                      Обновить блюдо
                    </Button>
                  </div>
                </div>
                  )}
                </>
              ) : (
                // Add mode - show tabs to choose mode
                <>
                  <div className="grid grid-cols-2 gap-2 mb-4 rounded-xl bg-muted/40 p-1">
                    <button
                      onClick={() => setAddMode('manual')}
                      className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-smooth ${
                        addMode === 'manual'
                          ? 'bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] text-primary-foreground shadow-glow'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <BookOpen className="h-4 w-4" />
                      Вручную
                    </button>
                    <button
                      onClick={() => setAddMode('ingredients')}
                      className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-smooth ${
                        addMode === 'ingredients'
                          ? 'bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] text-primary-foreground shadow-glow'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Calculator className="h-4 w-4" />
                      Из ингредиентов
                    </button>
                  </div>
                  {addMode === 'ingredients' ? (
                    <RecipeFromIngredients
                      onSave={handleSaveRecipeFromIngredients}
                      onCancel={handleCancelEdit}
                      initialData={undefined}
                    />
                  ) : (
                    // Add manual mode
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Название блюда</Label>
                        <Input
                          id="name"
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Название блюда"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="calories">Калории (на 100г)</Label>
                          <Input
                            id="calories"
                            type="number"
                            value={formData.calories}
                            onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                            placeholder="0"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="protein">Белки (на 100г)</Label>
                          <Input
                            id="protein"
                            type="number"
                            step="0.1"
                            value={formData.protein}
                            onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                            placeholder="0"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fat">Жиры (на 100г)</Label>
                          <Input
                            id="fat"
                            type="number"
                            step="0.1"
                            value={formData.fat}
                            onChange={(e) => setFormData({ ...formData, fat: e.target.value })}
                            placeholder="0"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="carbs">Углеводы (на 100г)</Label>
                          <Input
                            id="carbs"
                            type="number"
                            step="0.1"
                            value={formData.carbs}
                            onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
                            placeholder="0"
                            required
                          />
                        </div>
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
                        <Label htmlFor="description">Описание блюда</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Напишите описание: ингредиенты, шаги, заметки..."
                          rows={6}
                        />
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button
                          variant="outline"
                          onClick={handleCancelEdit}
                          className="flex-1 text-muted-foreground hover:text-primary"
                        >
                          Отмена
                        </Button>
                        <Button
                          onClick={handleSaveRecipe}
                          disabled={!formData.name.trim()}
                          className="flex-1 bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-0 text-foreground hover:opacity-90 shadow-glow"
                        >
                          Сохранить блюдо
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Add button fixed at bottom center */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-auto z-40">
        <Button
          onClick={handleAddRecipe}
          disabled={!user}
          className="rounded-2xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] px-12 py-6 text-foreground font-bold text-xl shadow-glow hover:opacity-90 transition-smooth"
        >
          Создать
        </Button>
      </div>
      <div className="h-20" />
    </div>
  );
};

export default Recipes;
