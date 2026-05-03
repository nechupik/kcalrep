import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { loadNorm } from "@/lib/storage";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      if (loading) return;
      if (!user) {
        navigate("/auth");
        return;
      }
      if (location.pathname !== "/onboarding") {
        const norm = await loadNorm();
        if (!norm) {
          navigate("/onboarding");
          return;
        }
      }
      setChecking(false);
    };
    check();
  }, [user, loading, navigate, location.pathname]);

  if (loading || checking) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted-foreground">Загрузка...</div>
    </div>
  );

  return <>{children}</>;
};
