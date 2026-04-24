import { useState, useEffect, useRef } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { loadProducts, saveProduct, searchProducts, deleteProduct, type Product } from "@/lib/products";
import { searchByBarcode, searchByName } from "@/lib/openFoodFacts";
import { Package, Search, Plus, Edit, Trash2, Camera } from "lucide-react";

// TypeScript declaration for BarcodeDetector
declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
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

  // Barcode scanner state
  const [barcode, setBarcode] = useState("");
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [cameraSupported, setCameraSupported] = useState(true);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;

    setLoading(true);
    try {
      // Search in user's products first
      const userProducts = await searchProducts(user.uid, searchQuery);
      
      // Then search Open Food Facts API
      const offResults = await searchByName(searchQuery);
      
      // Combine results with user products first
      const allResults = [
        ...userProducts.map(p => ({ ...p, source: 'manual' as const })),
        ...offResults.map(p => ({ ...p, source: 'open_food_facts' as const })),
      ];
      
      setProducts(allResults);
    } catch (error) {
      console.error("Error searching:", error);
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCameraCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      // Check if BarcodeDetector is supported
      if (!('BarcodeDetector' in window)) {
        setCameraSupported(false);
        toast.error("Barcode scanning not supported on this device. Use manual barcode input.");
        return;
      }

      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const img = new Image();
      img.src = URL.createObjectURL(file);
      
      img.onload = async () => {
        try {
          const barcodes = await detector.detect(img);
          if (barcodes.length > 0) {
            const detectedBarcode = barcodes[0].rawValue;
            setBarcode(detectedBarcode);
            
            // Search for product with detected barcode
            const result = await searchByBarcode(detectedBarcode);
            if (result) {
              setScannedProduct(result);
              toast.success(`Barcode detected: ${detectedBarcode}`);
            } else {
              toast.error("Product not found for this barcode");
            }
          } else {
            toast.error("No barcode detected in image");
          }
        } catch (error) {
          console.error("Error detecting barcode:", error);
          toast.error("Failed to detect barcode");
        }
      };
    } catch (error) {
      console.error("Error processing image:", error);
      toast.error("Failed to process image");
    }
  };

  const handleBarcodeScan = async () => {
    if (!user) return;
    
    try {
      // Check if product exists in user's database first
      const userProducts = await loadProducts(user.uid);
      const existingProduct = userProducts.find(p => p.barcode === barcode);
      
      if (existingProduct) {
        toast.success("Product already exists in your database");
        return;
      }

      // Simple barcode input without external libraries
      setBarcode(barcode);
      toast.success(`Scanning barcode: ${barcode}`);
    } catch (error) {
      console.error("Error scanning barcode:", error);
      toast.error("Failed to scan barcode");
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
      
      toast.success(`Added: ${formData.name}`);
      setFormData({ name: "", calories: 0, protein: 0, fat: 0, carbs: 0 });
      setShowAddForm(false);
      loadUserProducts(); // Refresh list
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Failed to save product");
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
        toast.error("Failed to save product");
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
      
      toast.success(`Updated: ${formData.name}`);
      setEditingProduct(null);
      setFormData({ name: "", calories: 0, protein: 0, fat: 0, carbs: 0 });
      setShowAddForm(false);
      loadUserProducts(); // Refresh list
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Failed to update product");
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!user) return;
    
    try {
      await deleteProduct(user.uid, productId);
      toast.success("Product deleted");
      loadUserProducts(); // Refresh list
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product");
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
            <h1 className="text-2xl md:text-3xl font-bold">Products</h1>
            <p className="text-sm text-muted-foreground">
              Manage your product database and search Open Food Facts
            </p>
          </div>
        </div>

        {/* Search bar */}
        <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50 shadow-soft mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading}
              className="bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow"
            >
              Search
            </Button>
          </div>

          {/* Barcode scanner */}
          <div className="flex gap-2">
            <div className="relative">
              <Input
                type="text"
                placeholder="Enter barcode..."
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="pl-10 pr-4"
              />
            </div>
            <Button
              onClick={() => cameraInputRef.current?.click()}
              disabled={!user}
              className="bg-white border-2 border-border/50 text-foreground hover:bg-gray-50"
            >
              <Camera className="h-4 w-4 mr-2" />
              Scan Barcode
            </Button>
            <Button
              onClick={handleBarcodeScan}
              disabled={!user}
              className="bg-white border-2 border-border/50 text-foreground hover:bg-gray-50"
            >
              Search Barcode
            </Button>
            <Button
              onClick={handleAddProduct}
              disabled={!user}
              className="bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>

          {/* Hidden file input for camera */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            style={{ display: 'none' }}
            onChange={handleCameraCapture}
          />

          {/* Product preview */}
          {scannedProduct && (
            <Card className="mt-4 p-4 bg-card/80 border-border/50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-base mb-1">{scannedProduct.name}</h3>
                  {scannedProduct.brand && (
                    <div className="text-sm text-muted-foreground mb-3">{scannedProduct.brand}</div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-3 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-calories))' }}>
                      <span>🔥</span>
                      <span>{scannedProduct.calories} ккал</span>
                    </div>
                    <div className="flex items-center gap-1 px-3 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-protein))' }}>
                      <span>Б</span>
                      <span>{scannedProduct.protein}г</span>
                    </div>
                    <div className="flex items-center gap-1 px-3 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-fat))' }}>
                      <span>Ж</span>
                      <span>{scannedProduct.fat}г</span>
                    </div>
                    <div className="flex items-center gap-1 px-3 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-carbs))' }}>
                      <span>У</span>
                      <span>{scannedProduct.carbs}г</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      saveProduct(user.uid, {
                        ...scannedProduct,
                        source: 'manual',
                        verified: false,
                      });
                      setScannedProduct(null);
                      toast.success(`Saved: ${scannedProduct.name}`);
                      loadUserProducts();
                    }}
                    className="bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow"
                  >
                    Save to my products
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setScannedProduct(null)}
                    className="text-muted-foreground hover:text-primary"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </Card>

        {/* Products list */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-soft">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Your Products</h2>
              <div className="text-sm text-muted-foreground">
                {products.length} products • KBJU per 100g shown
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading...</div>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No products yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your first product or search the Open Food Facts database
                </p>
                <Button
                  onClick={handleAddProduct}
                  disabled={!user}
                  className="bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {products.map((product, index) => (
                  <Card key={product.id || product.barcode || index} className="relative rounded-xl border border-border/50 bg-card/80 p-4 hover:bg-card transition-smooth">
                    {/* Source badge */}
                    <div className="absolute top-3 left-3">
                      {product.source === 'open_food_facts' && (
                        <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          Open Food Facts
                        </span>
                      )}
                      {product.source === 'manual' && (
                        <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Manual
                        </span>
                      )}
                      {product.source === 'edited' && (
                        <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                          Edited
                        </span>
                      )}
                    </div>

                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-base mb-1">{product.name}</h3>
                        {product.brand && (
                          <div className="text-sm text-muted-foreground mb-3">{product.brand}</div>
                        )}
                        
                        {/* Macro badges row */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 px-3 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-calories))' }}>
                            <span>🔥</span>
                            <span>{product.calories} ккал</span>
                          </div>
                          <div className="flex items-center gap-1 px-3 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-protein))' }}>
                            <span>Б</span>
                            <span>{product.protein}г</span>
                          </div>
                          <div className="flex items-center gap-1 px-3 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-fat))' }}>
                            <span>Ж</span>
                            <span>{product.fat}г</span>
                          </div>
                          <div className="flex items-center gap-1 px-3 py-2 rounded-full text-white text-sm font-medium" style={{ backgroundColor: 'hsl(var(--macro-carbs))' }}>
                            <span>У</span>
                            <span>{product.carbs}г</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 items-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditProduct(product)}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
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
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {editingProduct ? "Edit Product" : "Add Product"}
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
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Product name"
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
                  onClick={editingProduct ? handleUpdateProduct : handleSaveProduct}
                  disabled={!formData.name.trim()}
                  className="flex-1 bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow"
                >
                  {editingProduct ? "Update Product" : "Save Product"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Products;
