import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { db } from "@/lib/firebase";
import { collection, getDocs, getCountFromServer } from "firebase/firestore";
import { 
  deleteAllDiaryEntries, 
  deleteAllProducts, 
  deleteAllRecipes, 
  deleteAllWeight, 
  deleteAllNormData, 
  deleteAllActivityData 
} from "@/lib/firestore";
import { Shield, Users, Database, Activity, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const ADMIN_UID = "irXSByiUKYg9S5g3UXF5xSXHijC3";

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDiaryEntries: 0,
    totalProducts: 0,
    totalRecipes: 0,
  });
  const [firebaseStatus, setFirebaseStatus] = useState<"checking" | "online" | "offline">("checking");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { navigate("/"); return; }
    if (user.uid !== ADMIN_UID) { navigate("/"); return; }
    loadStats();
  }, [user]);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Check Firebase connectivity
      const usersCol = collection(db, "users");
      const usersSnap = await getDocs(usersCol);
      setFirebaseStatus("online");

      let totalDiary = 0;
      let totalProducts = 0;
      let totalRecipes = 0;

      for (const userDoc of usersSnap.docs) {
        const diarySnap = await getCountFromServer(collection(db, "users", userDoc.id, "diary"));
        const productsSnap = await getCountFromServer(collection(db, "users", userDoc.id, "products"));
        const recipesSnap = await getCountFromServer(collection(db, "users", userDoc.id, "recipes"));
        totalDiary += diarySnap.data().count;
        totalProducts += productsSnap.data().count;
        totalRecipes += recipesSnap.data().count;
      }

      setStats({
        totalUsers: usersSnap.size,
        totalDiaryEntries: totalDiary,
        totalProducts: totalProducts,
        totalRecipes: totalRecipes,
      });
    } catch (error) {
      console.error("Admin stats error:", error);
      setFirebaseStatus("offline");
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteAllDiaryEntries = async () => {
    setDeleting('diary');
    try {
      console.log('Starting deleteAllDiaryEntries...');
      console.log('Current user:', user);
      const result = await deleteAllDiaryEntries();
      console.log('Delete result:', result);
      if (result.error) {
        toast.error(`Ошибка удаления записей дневника: ${result.error}`);
      } else {
        toast.success(`Удалено ${result.deleted} записей из дневников всех пользователей`);
        await loadStats();
      }
    } catch (error) {
      console.error('Exception in handleDeleteAllDiaryEntries:', error);
      toast.error('Ошибка при удалении записей дневника');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAllProducts = async () => {
    setDeleting('products');
    try {
      const result = await deleteAllProducts();
      if (result.error) {
        toast.error(`Ошибка удаления продуктов: ${result.error}`);
      } else {
        toast.success(`Удалено ${result.deleted} продуктов всех пользователей`);
        await loadStats();
      }
    } catch (error) {
      toast.error('Ошибка при удалении продуктов');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAllRecipes = async () => {
    setDeleting('recipes');
    try {
      const result = await deleteAllRecipes();
      if (result.error) {
        toast.error(`Ошибка удаления рецептов: ${result.error}`);
      } else {
        toast.success(`Удалено ${result.deleted} рецептов всех пользователей`);
        await loadStats();
      }
    } catch (error) {
      toast.error('Ошибка при удалении рецептов');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAllWeight = async () => {
    setDeleting('weight');
    try {
      const result = await deleteAllWeight();
      if (result.error) {
        toast.error(`Ошибка удаления записей веса: ${result.error}`);
      } else {
        toast.success(`Удалено ${result.deleted} записей веса всех пользователей`);
        await loadStats();
      }
    } catch (error) {
      toast.error('Ошибка при удалении записей веса');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAllNorms = async () => {
    setDeleting('norms');
    try {
      const result = await deleteAllNormData();
      if (result.error) {
        toast.error(`Ошибка удаления норм КБЖУ: ${result.error}`);
      } else {
        toast.success(`Удалено ${result.deleted} норм КБЖУ всех пользователей`);
        await loadStats();
      }
    } catch (error) {
      toast.error('Ошибка при удалении норм КБЖУ');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAllActivity = async () => {
    setDeleting('activity');
    try {
      const result = await deleteAllActivityData();
      if (result.error) {
        toast.error(`Ошибка удаления данных активности: ${result.error}`);
      } else {
        toast.success(`Удалено ${result.deleted} записей активности всех пользователей`);
        await loadStats();
      }
    } catch (error) {
      toast.error('Ошибка при удалении данных активности');
    } finally {
      setDeleting(null);
    }
  };

if (!user || user.uid !== ADMIN_UID) return null;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <section className="container max-w-3xl pt-6 pb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] p-2.5 shadow-glow">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Админ-панель</h1>
            <p className="text-sm text-muted-foreground">Только для администратора</p>
          </div>
        </div>

        {/* Firebase Status */}
        <Card className="p-5 bg-card/80 border-border/50 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Статус сервисов</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${
              firebaseStatus === "online" ? "bg-green-500" :
              firebaseStatus === "offline" ? "bg-red-500" : "bg-yellow-500"
            }`} />
            <span className="text-sm">
              Firebase Firestore: {
                firebaseStatus === "online" ? "онлайн" :
                firebaseStatus === "offline" ? "недоступен" : "проверка..."
              }
            </span>
          </div>
        </Card>

        {/* Stats */}
        <Card className="p-5 bg-card/80 border-border/50 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Статистика базы данных</h2>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Пользователей", value: stats.totalUsers, icon: "👤" },
                { label: "Записей в дневнике", value: stats.totalDiaryEntries, icon: "📝" },
                { label: "Продуктов", value: stats.totalProducts, icon: "📦" },
                { label: "Рецептов", value: stats.totalRecipes, icon: "📖" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-muted/40 p-4">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Actions */}
        <Card className="p-5 bg-card/80 border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Действия</h2>
          </div>
          <div className="space-y-3">
            <Button onClick={loadStats} variant="outline" size="sm" className="w-full justify-start">
              🔄 Обновить статистику
            </Button>
            
            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h3 className="font-semibold text-destructive">Опасные действия</h3>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {/* Delete Diary Entries */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      disabled={deleting === 'diary'}
                      className="w-full justify-start"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleting === 'diary' ? 'Удаление...' : 'Удалить все записи дневников'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить все записи дневников?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Это действие безвозвратно удалит все записи дневников ({stats.totalDiaryEntries} шт.) всех пользователей системы.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAllDiaryEntries} className="bg-destructive text-destructive-foreground">
                        Удалить всё
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Delete Products */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      disabled={deleting === 'products'}
                      className="w-full justify-start"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleting === 'products' ? 'Удаление...' : 'Удалить все продукты'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить все продукты?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Это действие безвозвратно удалит все продукты ({stats.totalProducts} шт.) всех пользователей системы.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAllProducts} className="bg-destructive text-destructive-foreground">
                        Удалить всё
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Delete Recipes */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      disabled={deleting === 'recipes'}
                      className="w-full justify-start"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleting === 'recipes' ? 'Удаление...' : 'Удалить все рецепты'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить все рецепты?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Это действие безвозвратно удалит все рецепты ({stats.totalRecipes} шт.) всех пользователей системы.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAllRecipes} className="bg-destructive text-destructive-foreground">
                        Удалить всё
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Delete Weight */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      disabled={deleting === 'weight'}
                      className="w-full justify-start"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleting === 'weight' ? 'Удаление...' : 'Удалить все записи веса'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить все записи веса?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Это действие безвозвратно удалит все записи веса всех пользователей системы.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAllWeight} className="bg-destructive text-destructive-foreground">
                        Удалить всё
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Delete Norms */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      disabled={deleting === 'norms'}
                      className="w-full justify-start"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleting === 'norms' ? 'Удаление...' : 'Удалить все нормы КБЖУ'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить все нормы КБЖУ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Это действие безвозвратно удалит все нормы КБЖУ всех пользователей системы. Пользователям придется заново рассчитывать свои нормы.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAllNorms} className="bg-destructive text-destructive-foreground">
                        Удалить всё
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Delete Activity */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      disabled={deleting === 'activity'}
                      className="w-full justify-start"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deleting === 'activity' ? 'Удаление...' : 'Удалить все данные активности'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить все данные активности?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Это действие безвозвратно удалит все данные активности (шаги, калории) всех пользователей системы.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAllActivity} className="bg-destructive text-destructive-foreground">
                        Удалить всё
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default Admin;
