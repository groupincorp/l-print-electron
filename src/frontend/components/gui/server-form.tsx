import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RefreshCw, Save, Server } from "lucide-react";
import { useToast } from "../ui/toast";

interface Props {
  onSave?: () => void;
}

export function ServerForm({ onSave }: Props) {
  const [endpoint, setEndpoint] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    const loadEndpoint = async () => {
      try {
        const storedEndpoint = localStorage.getItem("server-endpoint");
        setEndpoint(storedEndpoint || "");
      } catch (error) {
        console.error("Failed to load server endpoint:", error);
        showError("Configuration Error", "Failed to load saved configuration");
      } finally {
        setIsLoading(false);
      }
    };

    loadEndpoint();
  }, [showError]);

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!endpoint.trim()) {
      showError("Validation Error", "Please enter a server endpoint");
      return;
    }

    if (!validateUrl(endpoint.trim())) {
      showError(
        "Invalid URL",
        "Please enter a valid URL (e.g., https://example.com)",
      );
      return;
    }

    setIsSaving(true);

    try {
      localStorage.setItem("server-endpoint", endpoint.trim());
      showSuccess(
        "Configuration Saved",
        "Server endpoint updated successfully",
      );

      // Small delay to show success message
      setTimeout(() => {
        onSave?.();
      }, 1500);
    } catch (error) {
      console.error("Failed to save server endpoint:", error);
      showError("Save Failed", "Failed to save server configuration");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/20 dark:to-background">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/20 dark:to-background">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 w-full max-w-md p-6 rounded-xl shadow-lg bg-card border border-emerald-200 dark:border-emerald-800"
      >
        <div className="text-center mb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Server className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
            <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
              Server Configuration
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure the backend server endpoint
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="server-endpoint"
            className="text-sm font-medium text-emerald-800 dark:text-emerald-300"
          >
            Server Endpoint
          </Label>
          <Input
            id="server-endpoint"
            type="url"
            placeholder="https://api.example.com"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            autoComplete="url"
            className="text-sm px-3 py-2 focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <Button
          type="submit"
          disabled={isSaving || !endpoint.trim()}
          className="w-full h-10 text-sm mt-2 shadow-sm transition !bg-emerald-600 hover:!bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white"
        >
          {isSaving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
