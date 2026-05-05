import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { collection, getDocs, getCountFromServer } from "firebase/firestore";
import { Shield, Users, Database, Activity } from "lucide-react";

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
          <Button onClick={loadStats} variant="outline" size="sm">
            🔄 Обновить статистику
          </Button>
        </Card>
      </section>
    </div>
  );
};

export default Admin;
