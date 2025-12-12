import React, { createContext, useEffect, useState } from "react";
import { electronStore } from "../lib/electron-store";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Export the context separately for use in the hook
export { ThemeContext };

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from store on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedTheme = await electronStore.getItem("theme") as Theme;
        setTheme(storedTheme || "system");
      } catch (error) {
        console.error("Failed to load theme:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  const [actualTheme, setActualTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = window.document.documentElement;

    const updateActualTheme = () => {
      let newTheme: "light" | "dark";

      if (theme === "system") {
        newTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      } else {
        newTheme = theme;
      }

      setActualTheme(newTheme);
      root.classList.remove("light", "dark");
      root.classList.add(newTheme);
    };

    updateActualTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        updateActualTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  useEffect(() => {
    if (!isLoading) {
      electronStore.setItem("theme", theme);
    }
  }, [theme, isLoading]);

  if (isLoading) {
    return null; // or a loading spinner
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, actualTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
