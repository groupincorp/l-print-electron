import { useEffect, useState } from "react";
import "./App.css";
import LoginForm from "./components/gui/login-form";
import { PrintQueue } from "./components/gui/print-queue";
import { ServerForm } from "./components/gui/server-form";

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
      } catch (error) {
        console.error("Failed to load stored data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredData();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full flex flex-1 p-4 overflow-hidden relative items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  let renderUI = <></>;

  if (!serverEndpoint) {
    renderUI = <ServerForm onSave={() => window.location.reload()} />;
  } else {
    if (token) {
      renderUI = (
        <div>
          <PrintQueue token={token} />
        </div>
      );
    } else {
      renderUI = <LoginForm onLogin={setToken} />;
    }
  }

  return (
    <div className="w-full flex flex-1 p-4 overflow-hidden relative">
      {/* snip... */}
      {renderUI}
      {/* snip... */}
    </div>
  );
}

export default App;
