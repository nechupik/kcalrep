import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { loadNorm } from "@/lib/storage";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const normCheckedRef = useRef(false);

  useEffect(() => {
    const check = async () => {
      if (loading) return;
      if (!user) {
        normCheckedRef.current = false;
        navigate("/auth");
        return;
      }
      if (location.pathname !== "/onboarding") {
        if (!normCheckedRef.current) {
          try {
            const norm = await loadNorm();
            if (!norm) {
              navigate("/onboarding");
              return;
            }
            normCheckedRef.current = true;
          } catch {
            setChecking(false);
            return;
          }
        }
      }
      setChecking(false);
    };
    check();
  }, [user, loading, navigate, location.pathname]);

  if (loading || checking) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return <>{children}</>;
};
