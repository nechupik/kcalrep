import { Flame, BarChart3, User, Home, Package, BookOpen } from "lucide-react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/stats", label: "Статистика", icon: BarChart3 },
  { to: "/profile", label: "Профиль", icon: User },
  { to: "/products", label: "Продукты", icon: Package },
  { to: "/recipes", label: "Рецепты", icon: BookOpen },
];

export const AppHeader = () => {
  return (
    <header className="container py-5 flex items-center justify-between gap-4">
      <NavLink to="/" className="flex items-center gap-2.5">
        <div className="rounded-xl bg-gradient-sunset p-2 shadow-glow">
          <Flame className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-bold text-lg tracking-tight">
          Lovi<span className="text-gradient-sunset">Eat</span>
        </span>
      </NavLink>

      <nav className="flex items-center gap-1 rounded-full border border-border/60 bg-card/60 backdrop-blur p-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-1.5 rounded-full px-2 sm:px-4 py-1.5 text-sm font-medium transition-smooth ${
                isActive
                  ? "bg-gradient-sunset text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            <l.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{l.label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
};
