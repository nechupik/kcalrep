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
      toast.error("Failed to load recipes");
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
      toast.error("Search failed");
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
      
      toast.success(`Added: ${formData.name}`);
      setFormData({ name: "", calories: 0, protein: 0, fat: 0, carbs: 0, description: "" });
      setShowAddForm(false);
      loadUserRecipes(); // Refresh list
    } catch (error) {
      console.error("Error saving recipe:", error);
      toast.error("Failed to save recipe");
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
        createdAt: editingRecipe.createdAt,
      });
      
      toast.success(`Updated: ${formData.name}`);
      setEditingRecipe(null);
      setFormData({ name: "", calories: 0, protein: 0, fat: 0, carbs: 0, description: "" });
      setShowAddForm(false);
      loadUserRecipes(); // Refresh list
    } catch (error) {
      console.error("Error updating recipe:", error);
      toast.error("Failed to update recipe");
    }
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!user) return;
    
    try {
      await deleteRecipe(user.uid, recipeId);
      toast.success("Recipe deleted");
      loadUserRecipes(); // Refresh list
    } catch (error) {
      console.error("Error deleting recipe:", error);
      toast.error("Failed to delete recipe");
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
            <h1 className="text-2xl md:text-3xl font-bold">My Recipes</h1>
            <p className="text-sm text-muted-foreground">
              Manage your recipe collection
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
                placeholder="Search recipes..."
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
              Search
            </Button>
          </div>

          <Button
            onClick={handleAddRecipe}
            disabled={!user}
            className="bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow px-4 md:px-6"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add Recipe</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </Card>

        {/* Recipes list */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-soft mb-8">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Your Recipes</h2>
              <div className="text-sm text-muted-foreground">
                {recipes.length} recipes • KBJU per 100g shown
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading...</div>
              </div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No recipes yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your first recipe!
                </p>
                <Button
                  onClick={handleAddRecipe}
                  disabled={!user}
                  className="bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Recipe
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
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {editingRecipe ? "Edit Recipe" : "Add Recipe"}
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
                  <Label htmlFor="name">Recipe Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Recipe name"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calories">Calories (per 100g)</Label>
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
                    <Label htmlFor="protein">Protein (per 100g)</Label>
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
                    <Label htmlFor="fat">Fat (per 100g)</Label>
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
                    <Label htmlFor="carbs">Carbs (per 100g)</Label>
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
                  <Label htmlFor="description">Recipe Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Write your recipe here: ingredients, steps, notes..."
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
                  Cancel
                </Button>
                <Button
                  onClick={editingRecipe ? handleUpdateRecipe : handleSaveRecipe}
                  disabled={!formData.name.trim()}
                  className="flex-1 bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow"
                >
                  {editingRecipe ? "Update Recipe" : "Save Recipe"}
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
