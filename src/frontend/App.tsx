import { useEffect, useState } from "react";
import "./App.css";
import LoginForm from "./components/gui/login-form";
import { PrintQueue } from "./components/gui/print-queue";
import { ServerForm } from "./components/gui/server-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { PrintSocket } from "./components/gui/print-socket";
import { RefreshCw } from "lucide-react";
import { ToastProvider } from "./components/ui/toast";

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
          await backend.tokenChanged(storedToken);
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
        await backend.tokenChanged(newToken);
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
      <div className="w-full flex flex-1 p-4 overflow-hidden relative items-center justify-center min-h-screen">
        <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="text-lg font-medium">Loading application...</span>
        </div>
      </div>
    );
  }

  let renderUI = <></>;

  if (!serverEndpoint) {
    renderUI = <ServerForm onSave={() => window.location.reload()} />;
  } else {
    if (token) {
      renderUI = (
        <div className="w-full">
          <Tabs defaultValue="queue" className="w-full">
            <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto mb-6">
              <TabsTrigger value="queue" className="flex items-center gap-2">
                <span>Print Queue</span>
              </TabsTrigger>
              <TabsTrigger value="socket" className="flex items-center gap-2">
                <span>Socket Monitor</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="queue" className="mt-0">
              <PrintQueue token={token} />
            </TabsContent>
            <TabsContent value="socket" className="mt-0">
              <PrintSocket />
            </TabsContent>
          </Tabs>
        </div>
      );
    } else {
      renderUI = <LoginForm onLogin={handleTokenChange} />;
    }
  }

  return (
    <ToastProvider>
      <div className="w-full flex flex-1 p-4 overflow-hidden relative">
        {renderUI}
      </div>
    </ToastProvider>
  );
}

export default App;
