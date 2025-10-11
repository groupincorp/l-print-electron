import { useMemo, useState } from "react";
import "./App.css";
import LoginForm from "./components/gui/login-form";
import { PrintQueue } from "./components/gui/print-queue";
import { ServerForm } from "./components/gui/server-form";

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
