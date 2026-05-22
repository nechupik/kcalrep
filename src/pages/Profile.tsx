import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalculatorForm } from "@/components/CalculatorForm";
import { SimpleCalculatorForm } from "@/components/SimpleCalculatorForm";
import { ResultsCard } from "@/components/ResultsCard";
import { EditProfileDataModal } from "@/components/EditProfileDataModal";
import {
  User,
  LogIn,
  LogOut,
  Save,
  ShieldCheck,
  Calculator,
  CheckCircle2,
  RotateCcw,
  Shield,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { loadNorm, saveNorm } from "@/lib/storage";
import { loadUserSettings, saveUserSettings, loadFullNormData, loadWeight, loadActivityRange } from "@/lib/firestore";
import { loadBodyComposition } from "@/lib/metabolic-firestore";
import type { CalcInput, MacroResult } from "@/lib/nutrition";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { calculateMacros, calculateMacrosWithWatchTDEE } from "@/lib/nutrition";

const ADMIN_UID = "irXSByiUKYg9S5g3UXF5xSXHijC3";

const Profile = () => {
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);

  const [norm, setNorm] = useState<MacroResult | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcVisible, setCalcVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activityEnabled, setActivityEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualCalories, setManualCalories] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [storedProfileData, setStoredProfileData] = useState<any>(null);
  const [deficitPercent, setDeficitPercent] = useState(10);
  const [adminRecalculating, setAdminRecalculating] = useState(false);
  const [avgWatchCalories, setAvgWatchCalories] = useState<number | null>(null);

  useEffect(() => {
    const loadNormData = async () => {
      const n = await loadNorm();
      setNorm(n);
      // Si no hay norma pero hay usuario, mostrar calculadora
      if (user && !n) {
        setShowCalculator(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setCalcVisible(true));
        });
      }

      // Load user settings
      if (user) {
        const settings = await loadUserSettings(user.uid);
        if (settings) {
          setActivityEnabled(settings.activityTrackingEnabled ?? true);
          setDeficitPercent(settings.deficitPercent ?? 10);
        }

        // Load stored profile data (gender, age, height)
        const profileData = await loadFullNormData(user.uid);
        setStoredProfileData(profileData);
      }
    };

    loadNormData();
  }, [user]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
    }
  }, [user]);

  useEffect(() => {
    if (manualMode && norm) {
      setManualCalories(String(norm.calories));
      setManualProtein(String(norm.protein));
      setManualFat(String(norm.fat));
      setManualCarbs(String(norm.carbs));
    }
  }, [manualMode]);

  const handleSave = () => {
    // Profile data is now managed by Firebase Auth
    toast.success("Профиль сохранён");
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      if (isLoginMode) {
        await signInWithEmail(loginEmail, loginPassword);
        toast.success("Добро пожаловать!");
      } else {
        if (!registerName.trim()) {
          toast.error("Введите ваше имя");
          setIsSubmitting(false);
          return;
        }
        await signUpWithEmail(loginEmail, loginPassword, registerName.trim());
        toast.success(`Добро пожаловать, ${registerName}!`);
      }
      setLoginEmail("");
      setLoginPassword("");
      setRegisterName("");
    } catch (error: any) {
      toast.error(error.message || "Ошибка авторизации");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      toast.success("Добро пожаловать!");
    } catch (error: any) {
      toast.error(error.message || "Ошибка входа через Google");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setShowCalculator(false);
      toast.message("Вы вышли из аккаунта");
    } catch (error: any) {
      toast.error(error.message || "Ошибка выхода");
    }
  };

  const handleCalculate = async (res: MacroResult, _input: CalcInput) => {
  try {
    await saveNorm(res, {
      gender: storedProfileData?.gender || _input.gender,
      height: storedProfileData?.height || _input.height,
      age: storedProfileData?.age || _input.age,
      goal: _input.goal,
    });
    setNorm(res);
    setCalcVisible(false);
    setTimeout(() => setShowCalculator(false), 300);
    toast.success('Норма пересчитана и сохранена');
  } catch (error) {
    console.error('handleCalculate error:', error);
    toast.error('Ошибка сохранения нормы');
  }
};

  const handleProfileDataSave = (newNorm: MacroResult) => {
    setNorm(newNorm);
    // Reload stored profile data
    if (user) {
      loadFullNormData(user.uid).then(setStoredProfileData);
    }
  };


  const handleCloseCalc = () => {
    setCalcVisible(false);
    setTimeout(() => setShowCalculator(false), 300);
  };

  const handleSaveName = async () => {
    if (!auth.currentUser) return;
    try {
      await updateProfile(auth.currentUser, { displayName });
      toast.success('Имя обновлено');
    } catch (error) {
      toast.error('Ошибка сохранения имени');
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    setSavingSettings(true);
    try {
      await saveUserSettings(user.uid, {
        activityTrackingEnabled: activityEnabled,
        deficitPercent,
      });
      toast.success('Настройки сохранены');
    } catch (error) {
      toast.error('Ошибка сохранения настроек');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAdminWatchRecalculate = async () => {
    if (!user || !storedProfileData) return;
    setAdminRecalculating(true);
    try {
      const today = new Date();
      const endDate = today.toISOString().split('T')[0];
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 6);
      const startDateStr = startDate.toISOString().split('T')[0];

      const activityEntries = await loadActivityRange(user.uid, startDateStr, endDate);
      const avg = activityEntries.length > 0
        ? Math.round(activityEntries.reduce((sum, e) => sum + e.caloriesBurned, 0) / activityEntries.length)
        : 0;
      setAvgWatchCalories(avg);

      const [weightEntries, latestBodyComp] = await Promise.all([
        loadWeight(user.uid, 1),
        loadBodyComposition(user.uid, 1),
      ]);
      const weight = weightEntries.length > 0 ? weightEntries[0].weight : 80;

      const latestComp = latestBodyComp.length > 0 ? latestBodyComp[0] : null;
      const bmrFromScale = latestComp?.bmrFromScale && latestComp.bmrFromScale > 0
        ? latestComp.bmrFromScale
        : null;
      const bodyFatPercent = latestComp?.bodyFatPercent ?? undefined;
      const lbmKg = latestComp?.lbmKg ?? undefined;
      // BMR priority: scale → Katch-McArdle (via LBM or bodyFat) → Mifflin
      const lbmForBmr = (lbmKg != null && lbmKg > 0)
        ? lbmKg
        : (bodyFatPercent != null ? weight * (1 - bodyFatPercent / 100) : null);
      const bmr = bmrFromScale
        ?? (lbmForBmr != null ? 370 + 21.6 * lbmForBmr : null)
        ?? (storedProfileData.gender === 'male'
          ? 10 * weight + 6.25 * storedProfileData.height - 5 * storedProfileData.age + 5
          : 10 * weight + 6.25 * storedProfileData.height - 5 * storedProfileData.age - 161);

      const newNorm = calculateMacrosWithWatchTDEE(
        bmr,
        avg,
        deficitPercent,
        weight,
        storedProfileData.gender,
        storedProfileData.height,
        bodyFatPercent,
        lbmKg
      );

      await saveNorm(newNorm, {
        gender: storedProfileData.gender,
        height: storedProfileData.height,
        age: storedProfileData.age,
        goal: storedProfileData.goal || 'lose',
      });
      await saveUserSettings(user.uid, { activityTrackingEnabled: activityEnabled, deficitPercent });
      setNorm(newNorm);
      toast.success(`Норма пересчитана: ${newNorm.calories} ккал (${activityEntries.length} дн. Apple Watch, ср. ${avg} ккал)`);
    } catch (error) {
      console.error(error);
      toast.error('Ошибка пересчёта');
    } finally {
      setAdminRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <section className="container max-w-3xl pt-6 pb-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-muted-foreground">Загрузка...</div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />

      <section className="container max-w-3xl pt-6 pb-12">
        
        {/* Profile card */}
        {user && (
          <Card className="p-6 md:p-8 bg-card/80 backdrop-blur-sm border-border/50 shadow-soft mb-6">
            <div className="flex items-center gap-4 mb-2.5">
              <div className="h-12 w-12 rounded-full bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] flex items-center justify-center text-xl font-bold text-foreground shadow-glow">
                {(user.displayName || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold truncate">{user.displayName || "No name"}</div>
              </div>
              {user && user.uid === ADMIN_UID && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/admin")}
                  className="text-muted-foreground hover:text-primary"
                >
                  <Shield className="h-4 w-4 mr-1" />
                  Админ
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Имя</Label>
              <div className="flex gap-2">
                <Input
                  id="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Введите ваше имя"
                />
                <Button
                  onClick={handleSaveName}
                  size="sm"
                  className="px-3"
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>

                      </Card>
        )}

        {/* KBJU norm section */}
        {user && (
          <Card className="p-6 md:p-8 bg-card/80 backdrop-blur-sm border-border/50 shadow-soft mb-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold">Моя норма</h2>
              {storedProfileData && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEditProfileModal(true)}
                  className="text-muted-foreground hover:text-primary"
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Изменить данные
                </Button>
              )}
            </div>
            {!norm && (
              <p className="text-sm text-muted-foreground mb-5">
                Норма задаётся один раз при регистрации. Пересчитайте, если изменился вес, активность или цель.
              </p>
            )}

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setManualMode(false)}
                className={`flex-1 rounded-xl py-2 text-sm font-medium transition-smooth border justify-center whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:opacity-90 transition-all duration-2000 ease-in-out ${
                  !manualMode
                    ? 'bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] text-foreground border-transparent shadow-glow'
                    : 'border-border/50 text-muted-foreground bg-background hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                Калькулятор
              </button>
              <button
                onClick={() => setManualMode(true)}
                className={`flex-1 rounded-xl py-2 text-sm font-medium transition-smooth border justify-center whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:opacity-90 transition-all duration-2000 ease-in-out ${
                  manualMode
                    ? 'bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] text-foreground border-transparent shadow-glow'
                    : 'border-border/50 text-muted-foreground bg-background hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                Ввести вручную
              </button>
            </div>

            {manualMode && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Калории (ккал)</Label>
                    <Input
                      type="number"
                      placeholder="например: 2000"
                      value={manualCalories}
                      onChange={e => setManualCalories(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Белки (г)</Label>
                    <Input
                      type="number"
                      placeholder="например: 150"
                      value={manualProtein}
                      onChange={e => setManualProtein(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Жиры (г)</Label>
                    <Input
                      type="number"
                      placeholder="например: 70"
                      value={manualFat}
                      onChange={e => setManualFat(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Углеводы (г)</Label>
                    <Input
                      type="number"
                      placeholder="например: 180"
                      value={manualCarbs}
                      onChange={e => setManualCarbs(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    if (!manualCalories || !manualProtein || !manualFat || !manualCarbs) {
                      toast.error('Заполните все поля');
                      return;
                    }
                    const manualNorm = {
                      calories: Number(manualCalories),
                      protein: Number(manualProtein),
                      fat: Number(manualFat),
                      carbs: Number(manualCarbs),
                      bmr: Number(manualCalories),
                      tdee: Number(manualCalories),
                      activityFactor: 1.2,
                      activityLabel: 'sedentary' as const,
                      goalMultiplier: 1.0,
                      gender: 'male' as const,
                      height: 0,
                      age: 0,
                      goal: 'maintain' as const,
                    };
                    await saveNorm(manualNorm);
                    setNorm(manualNorm);
                    toast.success('Норма КБЖУ сохранена');
                  }}
                  className="w-full bg-gradient-to-r from-[#4C1D95] to-[#7C3AED] border-0 text-white hover:opacity-90"
                >
                  Сохранить норму
                </Button>
              </div>
            )}

            {!manualMode && norm && !showCalculator && (
              <div
                style={{
                  opacity: norm ? 1 : 0,
                  transform: norm ? 'translateY(0)' : 'translateY(16px)',
                  transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <div className="rounded-2xl bg-gradient-sunset-soft border border-primary/20 p-5 mb-4">
                  <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-macro-protein" />
                    Норма задана
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
                    <NormStat label="КАЛОРИИ" value={`${norm.calories}`} unit="ккал" colorClass="text-macro-calories" />
                    <NormStat label="БЕЛКИ" value={`${norm.protein}`} unit="г" colorClass="text-macro-protein" />
                    <NormStat label="ЖИРЫ" value={`${norm.fat}`} unit="г" colorClass="text-macro-fat" />
                    <NormStat label="УГЛЕВОДЫ" value={`${norm.carbs}`} unit="г" colorClass="text-macro-carbs" />
                  </div>

                  {/* Deficit slider — visible for all users */}
                  <div className="mb-4 pt-3 border-t border-border/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Дефицит калорий</span>
                      <span className="text-sm font-bold">{deficitPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={15}
                      step={1}
                      value={deficitPercent}
                      onChange={(e) => setDeficitPercent(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-foreground"
                      style={{ background: 'linear-gradient(to right, #0a0520 0%, #1a0a3d 100%)' }}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                      <span>10%</span>
                      <span>15%</span>
                    </div>
                  </div>

                  {/* Apple Watch recalculation — admin only */}
                  {user?.uid === ADMIN_UID && (
                    <div className="mb-4 p-3 rounded-xl bg-muted/20 border border-border/30">
                      <div className="text-xs font-medium mb-0.5">Apple Watch норма</div>
                      <div className="text-xs text-muted-foreground mb-3">
                        TDEE = BMR + средняя активность за 7 дней
                        {avgWatchCalories !== null && (
                          <span className="ml-1 text-foreground font-medium">(ср. {avgWatchCalories} ккал/день)</span>
                        )}
                      </div>
                      <Button
                        onClick={handleAdminWatchRecalculate}
                        disabled={adminRecalculating}
                        className="w-full flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] text-foreground font-semibold shadow-glow hover:opacity-90"
                      >
                        {adminRecalculating ? 'Пересчитываю...' : 'Пересчитать с Apple Watch'}
                      </Button>
                    </div>
                  )}

                  <div className="flex justify-center items-center">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCalculator(true);
                        requestAnimationFrame(() => {
                          requestAnimationFrame(() => setCalcVisible(true));
                        });
                      }}
                      className="w-full flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] px-8 py-4 text-foreground font-bold text-lg shadow-glow hover:opacity-90 transition-all duration-2000 ease-in-out"
                    >
                      Пересчитать норму
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!manualMode && showCalculator && (
              <div
                style={{
                  opacity: calcVisible ? 1 : 0,
                  transform: calcVisible ? 'translateY(0)' : 'translateY(16px)',
                  transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {storedProfileData ? (
                  <SimpleCalculatorForm
                    onCalculate={handleCalculate}
                    submitLabel={norm ? "Пересчитать норму" : "Рассчитать норму"}
                    gender={storedProfileData.gender}
                    age={storedProfileData.age}
                    height={storedProfileData.height}
                    userId={user!.uid}
                  />
                ) : (
                  <CalculatorForm
                    onCalculate={handleCalculate}
                    submitLabel={norm ? "Пересчитать норму" : "Рассчитать норму"}
                  />
                )}
              </div>
            )}

            {!manualMode && !norm && (
              <div
                style={{
                  opacity: calcVisible ? 1 : 0,
                  transform: calcVisible ? 'translateY(0)' : 'translateY(16px)',
                  transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <CalculatorForm
                  onCalculate={handleCalculate}
                  submitLabel="Рассчитать норму"
                />
              </div>
            )}
          </Card>
        )}


        {/* Login form */}
        {!user && (
          <Card className="p-6 md:p-8 bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-2 border-dashed border-primary/30">
            <div className="flex items-center gap-2 mb-4">
              <LogIn className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">{isLoginMode ? "Войти" : "Регистрация"}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              {isLoginMode 
                ? "Войдите в аккаунт для синхронизации данных."
                : "Создайте аккаунт для сохранения данных."
              }
            </p>
            
            {/* Google login button */}
            <Button
              type="button"
              size="lg"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full mb-4 bg-white border-2 border-border/50 text-foreground hover:bg-gray-50"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Войти через Google
            </Button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">или</span>
              </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {!isLoginMode && (
                <div className="space-y-2">
                  <Label htmlFor="register-name">Имя</Label>
                  <Input
                    id="register-name"
                    type="text"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="Ваше имя"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Пароль</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="********"
                  required
                  minLength={6}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-0 text-foreground hover:opacity-90 shadow-glow"
              >
                {isSubmitting ? "Загрузка..." : (isLoginMode ? "Войти" : "Зарегистрироваться")}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  setLoginEmail("");
                  setLoginPassword("");
                  setRegisterName("");
                }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isLoginMode ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
              </button>
            </div>
          </Card>
        )}

              </section>
      <div className="h-8" />

      {user && (
        <EditProfileDataModal
          isOpen={showEditProfileModal}
          onClose={() => setShowEditProfileModal(false)}
          onSave={handleProfileDataSave}
          userId={user.uid}
        />
      )}
    </div>
  );
};

const NormStat = ({
  label,
  value,
  unit,
  colorClass,
}: {
  label: string;
  value: string;
  unit: string;
  colorClass: string;
}) => (
  <div>
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
      {label}
    </div>
    <div className="flex items-baseline gap-1">
      <span className={`text-xl font-bold ${colorClass}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{unit}</span>
    </div>
  </div>
);

export default Profile;
