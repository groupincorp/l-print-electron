import { useEffect, useState } from "react";
import "./App.css";
import LoginForm from "./components/gui/login-form";
import { ServerForm } from "./components/gui/server-form";
import { AppShell } from "./components/layout/app-shell";
import { ToastProvider } from "./components/ui/toast";
import { ThemeProvider } from "./context/theme-provider";

function App() {
  const [token, setToken] = useState<string | null>(null);
  const [serverEndpoint, setServerEndpoint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const storedToken = localStorage.getItem("token");
        const storedEndpoint = localStorage.getItem("server-endpoint");
        setToken(storedToken);
        setServerEndpoint(storedEndpoint);

        if (backend.tokenChanged) {
          await backend.tokenChanged(storedToken, storedEndpoint);
        }

        if (backend.setSocketConfig) {
          await backend.setSocketConfig({
            authEnabled:
              localStorage.getItem("socket-auth-enabled") === "true",
            token: localStorage.getItem("socket-token") || "",
          });
        }
      } catch (error) {
        console.error("Failed to load stored data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredData();
  }, []);

  const handleTokenChange = async (newToken: string | null) => {
    setToken(newToken);

    // Notify main process about token change
    if (backend.tokenChanged) {
      try {
        await backend.tokenChanged(newToken, serverEndpoint);
      } catch (error) {
        console.error(
          "Failed to notify main process about token change:",
          error,
        );
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] font-medium">
            Starting Printer Manager…
          </span>
        </div>
      </div>
    );
  }

  if (!serverEndpoint) {
    return (
      <ToastProvider>
        <ThemeProvider>
          <ServerForm onSave={() => window.location.reload()} />
        </ThemeProvider>
      </ToastProvider>
    );
  }

  if (!token) {
    return (
      <ToastProvider>
        <ThemeProvider>
          <LoginForm onLogin={handleTokenChange} />
        </ThemeProvider>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <ThemeProvider>
        <AppShell token={token} />
      </ThemeProvider>
    </ToastProvider>
  );
}

export default App;
