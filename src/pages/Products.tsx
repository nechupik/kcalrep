import { useState, useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { loadProducts, saveProduct, updateProduct, deleteProduct, type Product } from "@/lib/products";
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
    calories: "",
    protein: "",
    fat: "",
    carbs: "",
  });
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [deletedProduct, setDeletedProduct] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;


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
    setLoadingError(null);
    
    // Set up timeout fallback
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setLoadingError("Не удалось загрузить продукты. Проверьте подключение.");
      toast.error("Не удалось загрузить продукты. Проверьте подключение.");
    }, 8000);
    
    try {
      const userProducts = await loadProducts();
      clearTimeout(timeoutId);
      setProducts(userProducts);
      setLoadingError(null);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Error loading products:", error);
      toast.error("Ошибка загрузки продуктов");
      setLoadingError("Ошибка загрузки продуктов");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      // Load all products and filter client-side
      const allProducts = await loadProducts();
      const filteredProducts = allProducts.filter(product => 
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setProducts(filteredProducts);
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
      await saveProduct({
        name: formData.name,
        calories: Number(formData.calories) || 0,
        protein: Number(formData.protein) || 0,
        fat: Number(formData.fat) || 0,
        carbs: Number(formData.carbs) || 0,
      }, user.uid);
      
      toast.success(`Добавлено: ${formData.name}`);
      setFormData({ name: "", calories: "", protein: "", fat: "", carbs: "" });
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
        const productId = await saveProduct({
          name: product.name,
          calories: product.calories,
          protein: product.protein,
          fat: product.fat,
          carbs: product.carbs,
        }, user.uid);
        
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
      calories: product.calories.toString(),
      protein: product.protein.toString(),
      fat: product.fat.toString(),
      carbs: product.carbs.toString(),
    });
    setShowAddForm(true);
  };

  const handleUpdateProduct = async () => {
    if (!user || !editingProduct || !formData.name.trim()) return;
    
    try {
      // Update existing product
      if (editingProduct.id) {
        await updateProduct(editingProduct.id, {
          name: formData.name,
          calories: Number(formData.calories) || 0,
          protein: Number(formData.protein) || 0,
          fat: Number(formData.fat) || 0,
          carbs: Number(formData.carbs) || 0,
        });
      } else {
        // Create new product if no ID exists
        await saveProduct({
          name: formData.name,
          calories: Number(formData.calories) || 0,
          protein: Number(formData.protein) || 0,
          fat: Number(formData.fat) || 0,
          carbs: Number(formData.carbs) || 0,
        }, user.uid);
      }
      
      toast.success(`Обновлено: ${formData.name}`);
      setEditingProduct(null);
      setFormData({ name: "", calories: "", protein: "", fat: "", carbs: "" });
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
      // Find the product before deletion
      const productToDelete = products.find(p => p.id === productId);
      if (!productToDelete) return;
      
      // Remove from UI immediately
      setProducts(prev => prev.filter(p => p.id !== productId));
      
      // Store deleted product for potential restoration
      setDeletedProduct(productToDelete);
      
      // Show toast with undo option
      toast.success(`Продукт "${productToDelete.name}" удалён`, {
        action: {
          label: "Отменить",
          onClick: () => handleRestoreProduct(productToDelete)
        },
        duration: 5000 // 5 seconds to undo
      });
      
      // Actually delete after delay
      setTimeout(async () => {
        try {
          await deleteProduct(productId);
        } catch (error) {
          console.error("Error deleting product:", error);
          toast.error("Ошибка удаления продукта");
          // Restore product if deletion failed
          setProducts(prev => [...prev, productToDelete]);
        }
      }, 5000);
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Ошибка удаления продукта");
    }
  };

  const handleRestoreProduct = (product: Product) => {
    // Restore product to UI and cancel deletion
    setProducts(prev => [...prev, product]);
    setDeletedProduct(null);
    toast.info(`Продукт "${product.name}" восстановлен`);
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setFormData({ name: "", calories: "", protein: "", fat: "", carbs: "" });
    setShowAddForm(false);
  };

  // Reset to first page when products change
  useEffect(() => {
    setCurrentPage(1);
  }, [products]);

  // Calculate pagination
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = products.slice(startIndex, endIndex);

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

  return (
    <div className="min-h-screen">
      <AppHeader />

      <section className="container max-w-3xl pt-6 pb-12">
        
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
              className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] px-8 py-4 text-foreground font-bold text-lg shadow-glow hover:opacity-90 transition-smooth"
            >
              Поиск
            </Button>
          </div>

          <Button
            onClick={handleAddProduct}
            disabled={!user}
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] px-8 py-4 text-foreground font-bold text-lg shadow-glow hover:opacity-90 transition-smooth"
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
              <h2 className="text-lg font-semibold">Продукты</h2>
              <div className="text-sm text-muted-foreground">
                {pluralize(products.length, 'продукт', 'продукта', 'продуктов')}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Загрузка...</div>
              </div>
            ) : loadingError ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-destructive">Ошибка загрузки</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {loadingError}
                </p>
                <Button
                  onClick={loadUserProducts}
                  disabled={!user}
                  className="bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-0 text-foreground hover:opacity-90 shadow-glow"
                >
                  Попробовать снова
                </Button>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Продуктов пока нет</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  У вас пока нет продуктов. Нажмите «Добавить», чтобы создать первый.
                </p>
                <Button
                  onClick={handleAddProduct}
                  disabled={!user}
                  className="bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-0 text-foreground hover:opacity-90 shadow-glow"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить продукт
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Show current page products */}
                {currentProducts.map((product) => (
                  <Card key={product.id} className="rounded-xl border border-border/50 bg-card/80 p-4 hover:bg-card transition-smooth">
                    <div className="flex flex-col w-full">
                      <div className="flex items-center justify-between w-full">
                        <h3 className="font-semibold text-base break-words">{product.name}</h3>
                        <div className="flex gap-1 md:gap-2 items-center ml-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditProduct(product)}
                            className="text-muted-foreground hover:text-primary p-2 md:p-2"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-muted-foreground hover:text-destructive p-2 md:p-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-left mt-2">
                        <span className="text-xs md:text-sm font-medium">{product.calories} ккал</span>
                        <span className="text-xs md:text-sm font-medium">Б {product.protein}г</span>
                        <span className="text-xs md:text-sm font-medium">Ж {product.fat}г</span>
                        <span className="text-xs md:text-sm font-medium">У {product.carbs}г</span>
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
                <div className="space-y-1">
                  <Label htmlFor="name" className="block text-left">Название продукта</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Название продукта"
                    required
                    className="w-full"
                    style={{ marginLeft: '0', paddingLeft: '12px' }}
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
                  className="flex-1 bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-0 text-foreground hover:opacity-90 shadow-glow"
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
