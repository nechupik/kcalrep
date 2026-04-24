import React, { createContext, useContext, useEffect, useState } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { 
  signInWithEmail, 
  signUpWithEmail, 
  signInWithGoogle, 
  signOutUser, 
  onAuthStateChangedCallback 
} from "@/lib/auth";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<FirebaseUser>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<FirebaseUser>;
  signInWithGoogle: () => Promise<FirebaseUser>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChangedCallback((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSignInWithEmail = async (email: string, password: string) => {
    const user = await signInWithEmail(email, password);
    return user;
  };

  const handleSignUpWithEmail = async (email: string, password: string, name: string) => {
    const user = await signUpWithEmail(email, password, name);
    return user;
  };

  const handleSignInWithGoogle = async () => {
    const user = await signInWithGoogle();
    return user;
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithEmail: handleSignInWithEmail,
    signUpWithEmail: handleSignUpWithEmail,
    signInWithGoogle: handleSignInWithGoogle,
    signOut: handleSignOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
