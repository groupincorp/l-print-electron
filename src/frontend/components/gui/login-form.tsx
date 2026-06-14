import React, { useState } from "react";
import { requestDatabase } from "../../server/request-api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Loader2,
  LogIn,
  Printer,
  Eye,
  EyeOff,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { useToast } from "../ui/toast";

const LoginForm = (props: { onLogin: (token: string) => void }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [printerName, setPrinterName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrinter, setShowPrinter] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const { showSuccess } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!username.trim() || !password.trim()) {
      setErrorMsg("Please enter both username and password.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await requestDatabase("/api/auth/login", "POST", {
        username: username.trim(),
        password,
      });

      const typedResponse = response as { token: string };
      if (rememberLogin) {
        localStorage.setItem("token", typedResponse.token);
      }
      localStorage.setItem("printer_name", printerName.trim());
      showSuccess(
        "Login Successful",
        `Welcome back, ${username}!${printerName ? ` · Printer: ${printerName}` : ""}`,
      );

      setTimeout(() => {
        props.onLogin(typedResponse.token);
      }, 1200);
    } catch (error) {
      console.error("Login error:", error);
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Login failed. Please check your credentials.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/25">
            <Printer className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight mb-1">
            Printer Manager
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Restaurant POS · Sign in to continue
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-[15px] font-semibold text-foreground mb-5">
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error banner */}
            {errorMsg && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800">
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-destructive leading-snug">
                  {errorMsg}
                </p>
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <Label
                htmlFor="username"
                className="text-[13px] font-medium text-foreground"
              >
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrorMsg("");
                }}
                autoComplete="username"
                className="h-9 text-[13px]"
                autoFocus
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-[13px] font-medium text-foreground"
              >
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg("");
                  }}
                  autoComplete="current-password"
                  className="h-9 text-[13px] pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Printer name (optional, collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setShowPrinter((v) => !v)}
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    showPrinter ? "rotate-0" : "-rotate-90"
                  }`}
                />
                Printer Name
                <span className="text-[11px] text-muted-foreground/70">
                  (optional)
                </span>
                {!showPrinter && printerName && (
                  <span className="text-primary font-medium ml-1 truncate max-w-[100px]">
                    {printerName}
                  </span>
                )}
              </button>
              <div
                className="overflow-hidden transition-all duration-200"
                style={{
                  maxHeight: showPrinter ? "56px" : "0px",
                  opacity: showPrinter ? 1 : 0,
                }}
              >
                <Input
                  id="printerName"
                  type="text"
                  placeholder="e.g. Kitchen Printer"
                  value={printerName}
                  onChange={(e) => setPrinterName(e.target.value)}
                  autoComplete="off"
                  className="h-9 text-[13px] mt-2"
                />
              </div>
            </div>

            {/* Remember login */}
            <label
              htmlFor="remember"
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <input
                id="remember"
                type="checkbox"
                checked={rememberLogin}
                onChange={(e) => setRememberLogin(e.target.checked)}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
              <span className="text-[13px] text-muted-foreground select-none">
                Remember me on this device
              </span>
            </label>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading || !username.trim() || !password.trim()}
              className="w-full h-9 text-[13px] gap-1.5 mt-1"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {isLoading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </div>

        {/* Back link */}
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("server-endpoint");
              window.location.reload();
            }}
            className="text-[12px] text-muted-foreground hover:text-foreground hover:underline transition-colors"
          >
            ← Change server configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
