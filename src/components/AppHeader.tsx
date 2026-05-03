import { useState } from "react";
import { Flame, BarChart3, User, Home, Package, BookOpen, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const links = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/stats", label: "Статистика", icon: BarChart3 },
  { to: "/profile", label: "Профиль", icon: User },
  { to: "/products", label: "Продукты", icon: Package },
  { to: "/recipes", label: "Рецепты", icon: BookOpen },
];

export const AppHeader = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/40 px-4 py-3 flex items-center justify-between gap-4">
        <NavLink to="/" className="flex items-center gap-2.5">
          <div className="rounded-xl bg-gradient-sunset p-2 shadow-glow">
            <Flame className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">
            Lovi<span className="text-gradient-sunset">Eat</span>
          </span>
        </NavLink>

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
        className={`fixed top-0 right-0 h-full w-72 max-w-[72rem] bg-background/95 backdrop-blur-md border-l border-border/40 z-50 transform transition-transform ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ transitionDuration: '600ms' }}
      >
        <div className="p-6">
          <div className="flex justify-end">
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-lg hover:bg-muted/80 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="space-y-2">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                    isActive
                      ? "bg-gradient-sunset text-primary-foreground shadow-glow"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`
                }
              >
                <l.icon className="h-5 w-5 flex-shrink-0" />
                <span>{l.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
};
