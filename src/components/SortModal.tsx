import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { loadCategories, saveCategory, type Category } from '@/lib/categories';
import { toast } from 'sonner';

interface SortModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategorySelect: (categoryId: string | null) => void;
  selectedCategory: string | null;
}

const ADMIN_USER_ID = 'irXSByiUKYg9S5g3UXF5xSXHijC3';

export const SortModal = ({ isOpen, onClose, onCategorySelect, selectedCategory }: SortModalProps) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const isAdmin = user?.uid === ADMIN_USER_ID;

  useEffect(() => {
    if (isOpen) {
      loadCategoriesList();
    }
  }, [isOpen]);

  const loadCategoriesList = async () => {
    setLoading(true);
    try {
      const cats = await loadCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Ошибка загрузки категорий');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !user) return;

    try {
      await saveCategory({ name: newCategoryName.trim() }, user.uid);
      toast.success('Категория создана');
      setNewCategoryName('');
      setShowCreateForm(false);
      loadCategoriesList();
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Ошибка создания категории');
    }
  };

  const handleCategoryClick = (categoryId: string | null) => {
    onCategorySelect(categoryId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 650ms cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      />

      {/* Modal panel */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '512px',
          background: 'hsl(var(--background))',
          border: '1px solid hsl(var(--border) / 0.5)',
          borderRadius: '24px 24px 0 0',
          padding: '24px',
          maxHeight: '90vh',
          overflowY: 'auto',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 650ms cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">Сортировка</h2>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-muted/50 transition-smooth">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Categories list */}
        <div className="space-y-2">
          <button
            onClick={() => handleCategoryClick(null)}
            className={`w-full text-left rounded-xl px-4 py-3 transition-smooth flex items-center justify-between ${
              selectedCategory === null
                ? 'bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] text-primary-foreground shadow-glow'
                : 'bg-muted/40 hover:bg-muted/60'
            }`}
          >
            <span className="font-medium">Все продукты</span>
            {selectedCategory === null && (
              <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center">
                <div className="h-2.5 w-2.5 rounded-full bg-white" />
              </div>
            )}
          </button>

          {loading ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Загрузка...
            </div>
          ) : (
            categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className={`w-full text-left rounded-xl px-4 py-3 transition-smooth flex items-center justify-between ${
                  selectedCategory === category.id
                    ? 'bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] text-primary-foreground shadow-glow'
                    : 'bg-muted/40 hover:bg-muted/60'
                }`}
              >
                <span className="font-medium">{category.name}</span>
                {selectedCategory === category.id && (
                  <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Create category form (admin only) */}
        {isAdmin && (
          <div className="mt-6 pt-4 border-t border-border/50">
            {!showCreateForm ? (
              <Button
                onClick={() => setShowCreateForm(true)}
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Создать категорию
              </Button>
            ) : (
              <div className="space-y-3">
                <Label htmlFor="newCategory">Название категории</Label>
                <Input
                  id="newCategory"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Например: Молочные продукты"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateCategory()}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateCategory}
                    disabled={!newCategoryName.trim()}
                    className="flex-1 bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] border-0 text-primary-foreground hover:opacity-90"
                  >
                    Создать
                  </Button>
                  <Button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewCategoryName('');
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
