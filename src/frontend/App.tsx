import { useMemo, useState } from "react";
import "./App.css";
import LoginForm from "./components/gui/login-form";
import { PrintQueue } from "./components/gui/print-queue";
import { ServerForm } from "./components/gui/server-form";
import { ThemeProvider } from "./context/theme-provider";

function App() {
  const localToken = useMemo(() => {
    return localStorage.getItem("token");
  }, []);
  const localServerEndpoint = useMemo(() => {
    return localStorage.getItem("server-endpoint");
  }, []);
  const [token, setToken] = useState<string | null>(localToken);

  let renderUI = <></>;

  if (!localServerEndpoint) {
    renderUI = <ServerForm onSave={() => window.location.reload()} />;
  } else {
    if (token) {
      renderUI = <PrintQueue token={token} />;
    } else {
      renderUI = <LoginForm onLogin={setToken} />;
    }
  }

  return (
    <ThemeProvider>
      <div className="w-full flex flex-1 p-4 overflow-hidden relative">
        {/* snip... */}
        {renderUI}
        {/* snip... */}
      </div>
    </ThemeProvider>
  );
}

export default App;
