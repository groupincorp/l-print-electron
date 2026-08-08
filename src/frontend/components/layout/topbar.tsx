import { Moon, Sun, Monitor, Bell } from "lucide-react";
import { useTheme } from "@/context/theme-context";
import type { AppPage } from "./sidebar";
import { Logout } from "@/components/gui/logout";

const PAGE_TITLES: Record<AppPage, { title: string; subtitle: string }> = {
  queue: { title: "Dashboard", subtitle: "Real-time printer queue & status" },
  socket: {
    title: "Socket Monitor",
    subtitle: "Live connection logs & events",
  },
  printers: {
    title: "Printers",
    subtitle: "System printer connection status",
  },
  settings: {
    title: "Settings",
    subtitle: "Server configuration & preferences",
  },
};

interface TopbarProps {
  activePage: AppPage;
  isConnected?: boolean;
  username?: string;
}

export function Topbar({ activePage, isConnected = false }: TopbarProps) {
  const { theme, setTheme } = useTheme();

  const page = PAGE_TITLES[activePage];

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-card border-b border-border flex-shrink-0">
      {/* Left: page title */}
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold text-foreground leading-tight">
          {page.title}
        </h1>
        <p className="text-[12px] text-muted-foreground leading-tight hidden sm:block">
          {page.subtitle}
        </p>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Connection status */}
        <div
          className={`
            hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border
            ${
              isConnected
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"
            }
          `}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            }`}
          />
          {isConnected ? "Connected" : "Connecting…"}
        </div>

        {/* Notifications stub */}
        <button className="relative flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <Bell className="w-4 h-4" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={cycleTheme}
          title={`Theme: ${theme}`}
          className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <ThemeIcon className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* Logout */}
        <Logout />
      </div>
    </header>
  );
}
