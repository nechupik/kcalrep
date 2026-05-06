import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalculatorForm } from "@/components/CalculatorForm";
import { ResultsCard } from "@/components/ResultsCard";
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
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { loadNorm, saveNorm } from "@/lib/storage";
import { loadUserSettings, saveUserSettings } from "@/lib/firestore";
import type { CalcInput, MacroResult } from "@/lib/nutrition";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";

const ADMIN_UID = "irXSByiUKYg9S5g3UXF5xSXHijC3";

const Profile = () => {
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);

  const [norm, setNorm] = useState<MacroResult | null>(null);
  const [draftResult, setDraftResult] = useState<MacroResult | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcVisible, setCalcVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activityEnabled, setActivityEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);

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
        if (settings) setActivityEnabled(settings.activityTrackingEnabled);
      }
    };
    
    loadNormData();
  }, [user, norm]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
    }
  }, [user]);

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
      setDraftResult(null);
      toast.message("Вы вышли из аккаунта");
    } catch (error: any) {
      toast.error(error.message || "Ошибка выхода");
    }
  };

  const handleCalculate = (res: MacroResult, _input: CalcInput) => {
    setDraftResult(res);
    toast.success("Norm calculated - save to apply");
  };

  const handleSaveNorm = async (result: MacroResult) => {
    saveNorm(result);
    setNorm(result);
    setDraftResult(null);
    setCalcVisible(false);
    setTimeout(() => setShowCalculator(false), 300);
    toast.success("Norm saved");
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
      });
      toast.success('Настройки сохранены');
    } catch (error) {
      toast.error('Ошибка сохранения настроек');
    } finally {
      setSavingSettings(false);
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
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] p-2.5 shadow-glow">
            <User className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Профиль</h1>
                      </div>
        </div>

        {/* Profile card */}
        {user && (
          <Card className="p-6 md:p-8 bg-card/80 backdrop-blur-sm border-border/50 shadow-soft mb-6">
            <div className="flex items-center gap-4 mb-px">
              <div className="h-12 w-12 rounded-full bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] flex items-center justify-center text-xl font-bold text-foreground shadow-glow">
                {(user.displayName || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold truncate">{user.displayName || "No name"}</div>
              </div>
            </div>

            <div className="mb-2">
              <div className="w-full flex justify-center gap-2">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Выйти
                </Button>
              </div>
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
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold">Моя норма КБЖУ</h2>
            </div>
            {!norm && (
              <p className="text-sm text-muted-foreground mb-5">
                Норма задаётся один раз при регистрации. Пересчитайте, если изменился вес, активность или цель.
              </p>
            )}

            {norm && !showCalculator && (
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
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Пересчитать норму
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {showCalculator && (
              <div
                style={{
                  opacity: calcVisible ? 1 : 0,
                  transform: calcVisible ? 'translateY(0)' : 'translateY(16px)',
                  transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <CalculatorForm
                  onCalculate={handleCalculate}
                  submitLabel={norm ? "Пересчитать норму" : "Рассчитать норму"}
                />
                {draftResult && (
                  <div
                    style={{
                      opacity: 1,
                      transform: 'translateY(0)',
                      transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <ResultsCard
                      result={draftResult}
                      onSave={() => handleSaveNorm(draftResult)}
                      saved={!!norm && norm.calories === draftResult.calories}
                    />
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Activity tracking settings for non-admin users */}
        {user && user.uid !== 'irXSByiUKYg9S5g3UXF5xSXHijC3' && (
          <Card className="p-5 md:p-6 bg-card/80 backdrop-blur-sm border-border/50 shadow-soft">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">⚙️</span>
              <h2 className="font-semibold">Настройки активности</h2>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium">Учитывать активность</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Если включено — дефицит считается с учётом шагов. Если выключено — только по съеденным калориям.
                </p>
              </div>
              <button
                onClick={() => setActivityEnabled(!activityEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  activityEnabled ? 'bg-gradient-to-r from-[#0a0520] to-[#1a0a3d]' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    activityEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <Button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="w-full bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-0 text-foreground hover:opacity-90"
            >
              Сохранить настройки
            </Button>
          </Card>
        )}

        {/* Login form */}
        {!user && (
          <Card className="p-6 md:p-8 bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] border-2 border-dashed border-primary/30">
            <div className="flex items-center gap-2 mb-4">
              <LogIn className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">{isLoginMode ? "Login" : "Registration"}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              {isLoginMode 
                ? "Log in to your account to sync data between devices."
                : "Create an account to save data and sync between devices."
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
              Login with Google
            </Button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {!isLoginMode && (
                <div className="space-y-2">
                  <Label htmlFor="register-name">Name</Label>
                  <Input
                    id="register-name"
                    type="text"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="What should we call you"
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
                <Label htmlFor="login-password">Password</Label>
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
                {isSubmitting ? "Loading..." : (isLoginMode ? "Login" : "Register")}
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
                {isLoginMode ? "No account? Register" : "Have account? Login"}
              </button>
            </div>
          </Card>
        )}

              </section>
      <div className="h-8" />
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
