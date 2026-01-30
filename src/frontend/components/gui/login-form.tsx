import React, { useState } from "react";
import { requestDatabase } from "../../server/request-api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RefreshCw, LogIn } from "lucide-react";
import { useToast } from "../ui/toast";

const LoginForm = (props: { onLogin: (token: string) => void }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
      localStorage.setItem("token", typedResponse.token);
      showSuccess("Login Successful", `Welcome back, ${username}!`);

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
