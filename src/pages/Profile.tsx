import { useEffect, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { loadNorm, saveNorm } from "@/lib/storage";
import type { CalcInput, MacroResult } from "@/lib/nutrition";

const Profile = () => {
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut } = useAuth();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);

  const [norm, setNorm] = useState<MacroResult | null>(null);
  const [draftResult, setDraftResult] = useState<MacroResult | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadNormData = async () => {
      const n = await loadNorm();
      setNorm(n);
      // Si no hay norma pero hay usuario, mostrar calculadora
      if (user && !n) setShowCalculator(true);
    };
    
    loadNormData();
  }, [user, norm]);

  const handleSave = () => {
    // Profile data is now managed by Firebase Auth
    toast.success("Profile saved");
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      if (isLoginMode) {
        await signInWithEmail(loginEmail, loginPassword);
        toast.success("Welcome!");
      } else {
        if (!registerName.trim()) {
          toast.error("Please enter your name");
          setIsSubmitting(false);
          return;
        }
        await signUpWithEmail(loginEmail, loginPassword, registerName.trim());
        toast.success(`Welcome, ${registerName}!`);
      }
      setLoginEmail("");
      setLoginPassword("");
      setRegisterName("");
    } catch (error: any) {
      toast.error(error.message || "Authentication error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      toast.success("Welcome!");
    } catch (error: any) {
      toast.error(error.message || "Google sign-in error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setShowCalculator(false);
      setDraftResult(null);
      toast.message("You have logged out");
    } catch (error: any) {
      toast.error(error.message || "Logout error");
    }
  };

  const handleCalculate = (res: MacroResult, _input: CalcInput) => {
    setDraftResult(res);
    toast.success("Norm calculated - save to apply");
  };

  const handleSaveNorm = () => {
    if (!draftResult) return;
    saveNorm(draftResult);
    setNorm(draftResult);
    setDraftResult(null);
    setShowCalculator(false);
    toast.success("Norm saved");
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <section className="container max-w-3xl pt-6 pb-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-muted-foreground">Loading...</div>
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
          <div className="rounded-xl bg-gradient-sunset p-2.5 shadow-glow">
            <User className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Profile</h1>
            <p className="text-sm text-muted-foreground">
              Manage your account and KBJU norm
            </p>
          </div>
        </div>

        {/* Profile card */}
        {user && (
          <Card className="p-6 md:p-8 bg-card/80 backdrop-blur-sm border-border/50 shadow-soft mb-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-16 w-16 rounded-full bg-gradient-sunset flex items-center justify-center text-2xl font-bold text-primary-foreground shadow-glow">
                {(user.displayName || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-bold truncate">{user.displayName || "No name"}</div>
                <div className="text-sm text-muted-foreground truncate">
                  {user.email || "Not logged in"}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="ml-auto text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={user.displayName || ""}
                  disabled
                  placeholder="Name from Firebase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user.email || ""}
                  disabled
                  placeholder="Email from Firebase"
                />
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Profile managed via Firebase Auth
            </div>
          </Card>
        )}

        {/* KBJU norm section */}
        {user && (
          <Card className="p-6 md:p-8 bg-card/80 backdrop-blur-sm border-border/50 shadow-soft mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">My KBJU Norm</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Norm is set once during registration. Recalculate it if weight, activity, or goal has changed.
            </p>

            {norm && !showCalculator && (
              <div className="rounded-2xl bg-gradient-sunset-soft border border-primary/20 p-5 mb-4">
                <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-macro-protein" />
                  Norm set
                </div>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <NormStat label="Calories" value={`${norm.calories}`} unit="kcal" colorClass="text-macro-calories" />
                  <NormStat label="Protein" value={`${norm.protein}`} unit="g" colorClass="text-macro-protein" />
                  <NormStat label="Fat" value={`${norm.fat}`} unit="g" colorClass="text-macro-fat" />
                  <NormStat label="Carbs" value={`${norm.carbs}`} unit="g" colorClass="text-macro-carbs" />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowCalculator(true)}
                  className="border-primary/30 hover:bg-gradient-sunset-soft hover:border-primary"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Recalculate norm
                </Button>
              </div>
            )}

            {showCalculator && (
              <div className="space-y-4">
                <CalculatorForm
                  onCalculate={handleCalculate}
                  submitLabel={norm ? "Recalculate" : "Calculate norm"}
                />
                {draftResult && (
                  <ResultsCard
                    result={draftResult}
                    onSave={handleSaveNorm}
                    saved={!!norm && norm.calories === draftResult.calories}
                  />
                )}
                {norm && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowCalculator(false);
                      setDraftResult(null);
                    }}
                    className="text-muted-foreground"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Login form */}
        {!user && (
          <Card className="p-6 md:p-8 bg-gradient-sunset-soft border-2 border-dashed border-primary/30">
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
                className="w-full bg-gradient-sunset border-0 text-primary-foreground hover:opacity-90 shadow-glow"
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

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-border/50 bg-card/40 p-4 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 mt-0.5 text-tertiary shrink-0" />
          <p>
            {user 
              ? "Data syncs via Firebase and is available on all devices."
              : "Data is stored locally. Log in to sync between devices."
            }
          </p>
        </div>
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
