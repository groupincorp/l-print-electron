import React, { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { requestDatabase } from "../../server/request-api";

const LoginForm = (props: { onLogin: (token: string) => void }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple validation example
    if (!username || !password) {
      setError("Please enter both username and password.");
      return;
    }
    setError("");
    // TODO: Add login logic here
    requestDatabase("/api/auth/login", "POST", {
      username,
      password,
    })
      .then((response) => {
        const typedResponse = response as { token: string };
        localStorage.setItem("token", typedResponse.token);
        props.onLogin(typedResponse.token);
        alert(`Logging in as ${username}`);
      })
      .catch((error) => {
        console.error(error);
        setError("Login failed. Please try again.");
      });
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
        {error && (
          <div className="text-red-500 text-xs text-center mt-1">{error}</div>
        )}
        <Button
          type="submit"
          className="w-full !bg-emerald-600 !h-8 text-sm mt-2 shadow-sm hover:!bg-emerald-700 transition"
        >
          Login
        </Button>
      </form>
    </div>
  );
};

export default LoginForm;
