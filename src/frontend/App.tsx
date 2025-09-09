import { useMemo, useState } from "react";
import "./App.css";
import LoginForm from "./components/gui/login-form";
import { PrintQueue } from "./components/gui/print-queue";

function App() {
  const localToken = useMemo(() => {
    return localStorage.getItem("token");
  }, []);
  const [token, setToken] = useState<string | null>(localToken);

  return (
    <div className="w-full flex flex-1 p-4 overflow-hidden relative">
      {/* snip... */}
      {token ? <PrintQueue token={token} /> : <LoginForm onLogin={setToken} />}
      {/* snip... */}
    </div>
  );
}

export default App;
