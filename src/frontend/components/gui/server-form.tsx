import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface Props {
  onSave?: () => void;
}

export function ServerForm({ onSave }: Props) {
  const [endpoint, setEndpoint] = useState(
    localStorage.getItem("server-endpoint") || ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("server-endpoint", endpoint);
    onSave?.();
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/20 dark:to-background">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 w-full max-w-xs p-5 rounded-xl shadow-lg bg-card border border-emerald-100 dark:border-emerald-800"
      >
        <h2 className="text-lg font-bold text-emerald-700 dark:text-emerald-400 text-center mb-2 tracking-tight">
          Server Configuration
        </h2>
        <div className="flex flex-col gap-1">
          <Label
            htmlFor="username"
            className="text-xs font-medium text-emerald-800 dark:text-emerald-400 pl-1"
          >
            Server Endpoint
          </Label>
          <Input
            id="server-endpoint"
            type="url"
            placeholder="https://example.com"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            autoComplete="username"
            className="text-sm px-2 py-1.5 focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <Button
          type="submit"
          className="w-full h-8 text-sm mt-2 shadow-sm transition bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
        >
          Save
        </Button>
      </form>
    </div>
  );
}
