import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { loadNorm } from "@/lib/storage";

// Every route mounts its own ProtectedRoute, so this lives at module level to survive navigation: the saved-norm
// check then runs once per session instead of on every tab switch (each run is a Firestore round trip that can stall).
const normVerifiedFor = new Set<string>();

// Don't hold the whole app hostage to a slow request: let the user in and re-check on the next navigation.
const NORM_CHECK_TIMEOUT_MS = 5000;

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(!user || !normVerifiedFor.has(user.uid));

  useEffect(() => {
    const check = async () => {
      if (loading) return;
      if (!user) {
        normVerifiedFor.clear();
        navigate("/auth");
        return;
      }
      if (location.pathname !== "/onboarding" && !normVerifiedFor.has(user.uid)) {
        try {
          const norm = await Promise.race([
            loadNorm(),
            new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), NORM_CHECK_TIMEOUT_MS)),
          ]);
          if (norm === null) {
            navigate("/onboarding");
            return;
          }
          if (norm !== "timeout") normVerifiedFor.add(user.uid);
        } catch {
          // Couldn't check: let the user in rather than blocking the app.
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
