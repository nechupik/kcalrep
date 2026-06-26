import { useState } from "react";
import { Flame, BarChart3, User, Home, Package, BookOpen, X, LogOut, Weight, Heart } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const baseLinks = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/body", label: "Тело", icon: Weight },
  { to: "/stats", label: "Статистика", icon: BarChart3 },
  { to: "/profile", label: "Профиль", icon: User },
  { to: "/products", label: "Продукты", icon: Package },
  { to: "/recipes", label: "Блюда", icon: BookOpen },
];

const cycleLink = { to: "/cycle", label: "Цикл", icon: Heart };

export const AppHeader = () => {
  const { user, signOut, userGender } = useAuth();
  const links = userGender === 'female'
    ? [...baseLinks.slice(0, 2), cycleLink, ...baseLinks.slice(2)]
    : baseLinks;
  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    try {
      await signOut();
      setIsOpen(false);
      setShowLogoutConfirm(false);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleLogoutCancel = () => {
    setShowLogoutConfirm(false);
  };

  // Get current tab name based on location
  const getCurrentTabName = () => {
    const currentLink = links.find(link => link.to === location.pathname);
    return currentLink ? currentLink.label : "LoviEat";
  };

  return (
    <>
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/40 px-[14px] py-[10px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] p-2 shadow-glow">
            <img src="/logo-512x512.png" alt="LoviEat" className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg tracking-tight">
            {getCurrentTabName()}
          </span>
        </div>

        {user && (
          <button 
            onClick={() => setIsOpen(true)} 
            className="flex flex-col gap-1.5 p-2"
          >
            <span className="block w-5 h-0.5 bg-foreground" />
            <span className="block w-5 h-0.5 bg-foreground" />
            <span className="block w-5 h-0.5 bg-foreground" />
          </button>
        )}
      </header>

      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)} 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" 
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-52 max-w-[72rem] bg-background/95 backdrop-blur-md border-l border-border/40 z-50 transform transition-transform ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ transitionDuration: '600ms' }}
      >
        <div className="pt-4 pl-[15px] pr-6 pb-6 flex flex-col h-full">
          <nav className="space-y-2 flex-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 pl-[5px] pr-[5px] py-3 rounded-lg text-base font-medium transition-colors ${
                    isActive
                      ? "bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] text-foreground shadow-glow"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`
                }
              >
                <l.icon className="h-5 w-5 flex-shrink-0" />
                <span>{l.label}</span>
              </NavLink>
            ))}
          </nav>
          <button
            onClick={handleLogoutClick}
            className="flex items-center gap-3 pl-[5px] pr-[5px] py-3 rounded-lg text-base font-medium text-muted-foreground hover:text-destructive hover:bg-muted/50 transition-colors mt-4"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span>Выйти</span>
          </button>
        </div>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border border-border/50 rounded-2xl shadow-2xl p-6 w-80 mx-4">
            <h3 className="text-lg font-semibold mb-2">Подтверждение выхода</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Вы уверены, что хотите выйти из аккаунта?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleLogoutCancel}
                className="flex-1 px-4 py-2 rounded-lg border border-border/50 text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleLogoutConfirm}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-[#0a0520] to-[#1a0a3d] text-foreground hover:opacity-90 transition-colors"
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
