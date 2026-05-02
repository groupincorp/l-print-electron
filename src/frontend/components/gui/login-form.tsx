import React, { useState } from "react";
import { requestDatabase } from "../../server/request-api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RefreshCw, LogIn, ChevronDown } from "lucide-react";
import { useToast } from "../ui/toast";

const LoginForm = (props: { onLogin: (token: string) => void }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [printerName, setPrinterName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPrinter, setShowPrinter] = useState(false);
  const { showError, showSuccess } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Simple validation example
    if (!username.trim() || !password.trim()) {
      showError("Validation Error", "Please enter both username and password.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await requestDatabase("/api/auth/login", "POST", {
        username: username.trim(),
        password,
      });

      const typedResponse = response as { token: string };
      console.log("Login successful, received token:", typedResponse.token);
      console.log("Printer Name:", printerName.trim());
      localStorage.setItem("token", typedResponse.token);
      localStorage.setItem("printer_name", printerName.trim());
      showSuccess(
        "Login Successful",
        `Welcome back, ${username}! ${printerName ? `Your printer: ${printerName}` : ""}`,
      );

      // Small delay to show success message
      setTimeout(() => {
        props.onLogin(typedResponse.token);
      }, 1500);
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Login failed. Please check your credentials and try again.";
      showError("Login Failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] bg-gradient-to-br from-emerald-50 to-white">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 w-full max-w-xs p-5 rounded-xl shadow-lg bg-white border border-emerald-100"
      >
        <h2 className="text-lg font-bold text-emerald-700 text-center mb-2 tracking-tight">
          Sign in
        </h2>
        <div className="flex flex-col gap-1">
          <Label
            htmlFor="username"
            className="text-xs font-medium text-emerald-800 pl-1"
          >
            Username
          </Label>
          <Input
            id="username"
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="text-sm px-2 py-1.5 focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label
            htmlFor="password"
            className="text-xs font-medium text-emerald-800 pl-1"
          >
            Password
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="text-sm px-2 py-1.5 focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setShowPrinter((v) => !v)}
            className="flex items-center gap-1 w-fit text-xs font-medium text-emerald-800 pl-1 hover:text-emerald-600 transition-colors"
          >
            <ChevronDown
              className="h-3.5 w-3.5 transition-transform duration-300"
              style={{
                transform: showPrinter ? "rotate(0deg)" : "rotate(-90deg)",
              }}
            />
            <span className="text-xs">Printer Name (Optional)</span>
            <span
              className="ml-1 text-emerald-500 font-normal truncate max-w-[120px] transition-all duration-300"
              style={{
                opacity: !showPrinter && printerName ? 1 : 0,
                maxWidth: !showPrinter && printerName ? "120px" : "0px",
              }}
            >
              {printerName}
            </span>
          </button>
          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{
              maxHeight: showPrinter ? "60px" : "0px",
              opacity: showPrinter ? 1 : 0,
            }}
          >
            <Input
              id="printerName"
              type="text"
              placeholder="Enter your printer name"
              value={printerName}
              onChange={(e) => setPrinterName(e.target.value)}
              autoComplete="off"
              className="text-sm px-2 py-1.5 focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={isLoading || !username.trim() || !password.trim()}
          className="w-full h-9 text-sm mt-3 shadow-sm transition !bg-emerald-600 hover:!bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4 mr-2" />
              Login
            </>
          )}
        </Button>
        <Button
          type="button"
          variant={"outline"}
          size={"sm"}
          className="text-sm"
          onClick={async () => {
            localStorage.removeItem("token");
            localStorage.removeItem("server-endpoint");
            window.location.reload();
          }}
        >
          Cannot login? Go to back
        </Button>
      </form>
    </div>
  );
};

export default LoginForm;
