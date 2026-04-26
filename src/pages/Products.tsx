import { useState, useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { loadProducts, saveProduct, searchProducts, deleteProduct, type Product } from "@/lib/products";
import { Package, Search, Plus, Edit, Trash2 } from "lucide-react";

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} ${many}`;
  if (mod10 === 1) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

const Products = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  });


  // Guard: if no user, don't render
  if (!user) {
    return null;
  }

  // Load user's products on component mount
  useEffect(() => {
    if (user) {
      loadUserProducts();
    }
  }, [user]);

  const loadUserProducts = async () => {
    setLoading(true);
    try {
      const userProducts = await loadProducts(user.uid);
      setProducts(userProducts);
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Ошибка загрузки продуктов");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;

    setLoading(true);
    try {
      // Search in user's products only
      const userProducts = await searchProducts(user.uid, searchQuery);
      setProducts(userProducts);
    } catch (error) {
      console.error("Error searching:", error);
      toast.error("Ошибка поиска");
    } finally {
      setLoading(false);
    }
  };


  const handleAddProduct = () => {
    if (!user) return;
    
    setShowAddForm(true);
  };

  const handleSaveProduct = async () => {
    if (!user || !formData.name.trim()) return;
    
    try {
      await saveProduct(user.uid, {
        id: undefined, // Let Firestore generate ID
        name: formData.name,
        calories: formData.calories,
        protein: formData.protein,
        fat: formData.fat,
        carbs: formData.carbs,
        source: 'manual',
        verified: false,
      });
      
      toast.success(`Добавлено: ${formData.name}`);
      setFormData({ name: "", calories: 0, protein: 0, fat: 0, carbs: 0 });
      setShowAddForm(false);
      loadUserProducts(); // Refresh list
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Ошибка сохранения продукта");
    }
  };

  const handleEditProduct = async (product: Product) => {
    // If product doesn't have an ID (came from OFF API), save it first
    if (!product.id && user) {
      try {
        const productId = await saveProduct(user.uid, {
          id: undefined, // Let Firestore generate ID
          name: product.name,
          brand: product.brand,
          calories: product.calories,
          protein: product.protein,
          fat: product.fat,
          carbs: product.carbs,
          source: 'manual',
          verified: false,
        });
        
        // Update product with the new ID
        product = { ...product, id: productId };
      } catch (error) {
        console.error("Error saving product before edit:", error);
        toast.error("Ошибка сохранения продукта");
        return;
      }
    }
    
    setEditingProduct(product);
    setFormData({
      name: product.name,
      calories: product.calories,
      protein: product.protein,
      fat: product.fat,
      carbs: product.carbs,
    });
    setShowAddForm(true);
  };

  const handleUpdateProduct = async () => {
    if (!user || !editingProduct || !formData.name.trim()) return;
    
    try {
      // Generate ID if product doesn't have one (came from OFF API)
      const productId = editingProduct.id || crypto.randomUUID();
      
      await saveProduct(user.uid, {
        id: productId,
        name: formData.name,
        calories: formData.calories,
        protein: formData.protein,
        fat: formData.fat,
        carbs: formData.carbs,
        source: 'edited',
        verified: false,
      });
      
      toast.success(`Обновлено: ${formData.name}`);
      setEditingProduct(null);
      setFormData({ name: "", calories: 0, protein: 0, fat: 0, carbs: 0 });
      setShowAddForm(false);
      loadUserProducts(); // Refresh list
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Ошибка обновления продукта");
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!user) return;
    
    try {
      await deleteProduct(user.uid, productId);
      toast.success("Продукт удалён");
      loadUserProducts(); // Refresh list
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Ошибка удаления продукта");
    }
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setFormData({ name: "", calories: 0, protein: 0, fat: 0, carbs: 0 });
    setShowAddForm(false);
  };

  return (
    <div className="min-h-screen">
      <AppHeader />

      <section className="container max-w-3xl pt-6 pb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl bg-gradient-sunset p-2.5 shadow-glow">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Мои продукты</h1>
            <p className="text-sm text-muted-foreground">
              Управляйте базой продуктов
            </p>
          </div>
        </div>

        {/* Search bar */}
        <Card className="p-4 md:p-6 bg-card/80 backdrop-blur-sm border-border/50 shadow-soft mb-6">
          {/* Main search */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Поиск продуктов..."
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
            onClick={handleAddProduct}
            disabled={!user}
            className="bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow px-4 md:px-6"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Добавить продукт</span>
            <span className="sm:hidden">Добавить</span>
          </Button>

        </Card>

        {/* Products list */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-soft mb-8">
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Мои продукты</h2>
              <div className="text-sm text-muted-foreground">
                {pluralize(products.length, 'продукт', 'продукта', 'продуктов')} · КБЖУ на 100г
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Загрузка...</div>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Продуктов пока нет</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Добавьте первый продукт
                </p>
                <Button
                  onClick={handleAddProduct}
                  disabled={!user}
                  className="bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить продукт
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {products.map((product) => (
                  <Card key={product.id} className="rounded-xl border border-border/50 bg-card/80 p-4 hover:bg-card transition-smooth">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base mb-1 break-words">{product.name}</h3>
                        
                        {/* Macro badges row */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-2 rounded-full text-white text-xs md:text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-calories))' }}>
                            <span>🔥</span>
                            <span>{product.calories} ккал</span>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-2 rounded-full text-white text-xs md:text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-protein))' }}>
                            <span>Б</span>
                            <span>{product.protein}г</span>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-2 rounded-full text-white text-xs md:text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-fat))' }}>
                            <span>Ж</span>
                            <span>{product.fat}г</span>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-2 rounded-full text-white text-xs md:text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-carbs))' }}>
                            <span>У</span>
                            <span>{product.carbs}г</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-1 md:gap-2 items-center ml-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditProduct(product)}
                          className="text-muted-foreground hover:text-primary p-2 md:p-2"
                        >
                          <Edit className="h-3 w-3 md:h-4 md:w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteProduct(product.id)}
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

        {/* Add/Edit Product Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-lg shadow-xl p-6 w-full max-w-md border border-border/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {editingProduct ? "Редактировать продукт" : "Добавить продукт"}
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
                  <Label htmlFor="name">Название продукта</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Название продукта"
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
                  onClick={editingProduct ? handleUpdateProduct : handleSaveProduct}
                  disabled={!formData.name.trim()}
                  className="flex-1 bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow"
                >
                  {editingProduct ? "Обновить продукт" : "Сохранить продукт"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
      <div className="h-8" />
    </div>
  );
};

export default Products;
