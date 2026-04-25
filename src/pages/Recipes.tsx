import { useState, useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { loadRecipes, saveRecipe, searchRecipes, deleteRecipe, updateRecipe, type Recipe } from "@/lib/recipes";
import { BookOpen, Search, Plus, Edit, Trash2 } from "lucide-react";

const Recipes = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    description: "",
  });

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
      const userRecipes = await loadRecipes(user.uid);
      setRecipes(userRecipes);
    } catch (error) {
      console.error("Error loading recipes:", error);
      toast.error("Ошибка загрузки рецептов");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;

    setLoading(true);
    try {
      const searchResults = await searchRecipes(user.uid, searchQuery);
      setRecipes(searchResults);
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
  };

  const handleSaveRecipe = async () => {
    if (!user || !formData.name.trim()) return;
    
    try {
      await saveRecipe(user.uid, {
        name: formData.name,
        calories: formData.calories,
        protein: formData.protein,
        fat: formData.fat,
        carbs: formData.carbs,
        description: formData.description,
      });
      
      toast.success(`Добавлено: ${formData.name}`);
      setFormData({ name: "", calories: 0, protein: 0, fat: 0, carbs: 0, description: "" });
      setShowAddForm(false);
      loadUserRecipes(); // Refresh list
    } catch (error) {
      console.error("Error saving recipe:", error);
      toast.error("Ошибка сохранения рецепта");
    }
  };

  const handleEditRecipe = async (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setFormData({
      name: recipe.name,
      calories: recipe.calories,
      protein: recipe.protein,
      fat: recipe.fat,
      carbs: recipe.carbs,
      description: recipe.description,
    });
    setShowAddForm(true);
  };

  const handleUpdateRecipe = async () => {
    if (!user || !editingRecipe || !formData.name.trim()) return;
    
    try {
      await updateRecipe(user.uid, editingRecipe.id!, {
        name: formData.name,
        calories: formData.calories,
        protein: formData.protein,
        fat: formData.fat,
        carbs: formData.carbs,
        description: formData.description,
        updatedAt: Date.now(),
      });
      
      toast.success(`Обновлено: ${formData.name}`);
      setEditingRecipe(null);
      setFormData({ name: "", calories: 0, protein: 0, fat: 0, carbs: 0, description: "" });
      setShowAddForm(false);
      loadUserRecipes(); // Refresh list
    } catch (error) {
      console.error("Error updating recipe:", error);
      toast.error("Ошибка обновления рецепта");
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!user) return;
    
    try {
      await deleteRecipe(user.uid, recipeId);
      toast.success("Рецепт удалён");
      loadUserRecipes(); // Refresh list
    } catch (error) {
      console.error("Error deleting recipe:", error);
      toast.error("Ошибка удаления рецепта");
    }
  };

  const handleCancelEdit = () => {
    setEditingRecipe(null);
    setFormData({ name: "", calories: 0, protein: 0, fat: 0, carbs: 0, description: "" });
    setShowAddForm(false);
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
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl bg-gradient-sunset p-2.5 shadow-glow">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Мои рецепты</h1>
            <p className="text-sm text-muted-foreground">
              Сохраняйте рецепты с КБЖУ
            </p>
          </div>
        </div>

        {/* Search bar */}
        <Card className="p-4 md:p-6 bg-card/80 backdrop-blur-sm border-border/50 shadow-soft mb-6">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Поиск рецептов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow px-4 md:px-6"
            >
              Поиск
            </Button>
          </div>

          <Button
            onClick={handleAddRecipe}
            disabled={!user}
            className="bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow px-4 md:px-6"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Добавить рецепт</span>
            <span className="sm:hidden">Добавить</span>
          </Button>
        </Card>

        {/* Recipes list */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-soft mb-8">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Мои рецепты</h2>
              <div className="text-sm text-muted-foreground">
                {recipes.length} рецептов · КБЖУ на 100г
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Загрузка...</div>
              </div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Рецептов пока нет</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Добавьте первый рецепт!
                </p>
                <Button
                  onClick={handleAddRecipe}
                  disabled={!user}
                  className="bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить рецепт
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recipes.map((recipe) => (
                  <Card key={recipe.id} className="rounded-xl border border-border/50 bg-card/80 p-4 hover:bg-card transition-smooth">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg mb-2 break-words">{recipe.name}</h3>
                        
                        {/* KBJU pills */}
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <div className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-2 rounded-full text-white text-xs md:text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-calories))' }}>
                            <span>🔥</span>
                            <span>{recipe.calories} ккал</span>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-2 rounded-full text-white text-xs md:text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-protein))' }}>
                            <span>Б</span>
                            <span>{recipe.protein}г</span>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-2 rounded-full text-white text-xs md:text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-fat))' }}>
                            <span>Ж</span>
                            <span>{recipe.fat}г</span>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-2 rounded-full text-white text-xs md:text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-carbs))' }}>
                            <span>У</span>
                            <span>{recipe.carbs}г</span>
                          </div>
                        </div>

                        {/* Description preview */}
                        {recipe.description && (
                          <div className="text-sm text-muted-foreground">
                            {truncateDescription(recipe.description)}
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
              </div>
            )}
          </div>
        </Card>

        {/* Add/Edit Recipe Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-border/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {editingRecipe ? "Редактировать рецепт" : "Добавить рецепт"}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="text-muted-foreground hover:text-primary"
                >
                  ×
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название рецепта</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Название рецепта"
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
                      onChange={(e) => setFormData({ ...formData, calories: Number(e.target.value) })}
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
                      onChange={(e) => setFormData({ ...formData, protein: Number(e.target.value) })}
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
                      onChange={(e) => setFormData({ ...formData, fat: Number(e.target.value) })}
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
                      onChange={(e) => setFormData({ ...formData, carbs: Number(e.target.value) })}
                      placeholder="0"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Текст рецепта</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Напишите рецепт: ингредиенты, шаги, заметки..."
                    rows={6}
                  />
                </div>
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
                  onClick={editingRecipe ? handleUpdateRecipe : handleSaveRecipe}
                  disabled={!formData.name.trim()}
                  className="flex-1 bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow"
                >
                  {editingRecipe ? "Обновить рецепт" : "Сохранить рецепт"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Recipes;
