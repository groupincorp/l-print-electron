import { useState } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";

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
    <div className="flex items-center justify-center min-h-[60vh] bg-gradient-to-br from-emerald-50 to-white">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 w-full max-w-xs p-5 rounded-xl shadow-lg bg-white border border-emerald-100"
      >
        <div className="flex flex-col gap-1">
          <Label
            htmlFor="username"
            className="text-xs font-medium text-emerald-800 pl-1"
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
          className="w-full !bg-emerald-600 !h-8 text-sm mt-2 shadow-sm hover:!bg-emerald-700 transition"
        >
          Save
        </Button>
      </form>
    </div>
  );
}
