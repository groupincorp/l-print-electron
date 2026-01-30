import * as React from "react";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning" | "info";
  duration?: number;
  onClose?: () => void;
}

interface ToastContextType {
  toasts: ToastProps[];
  addToast: (toast: Omit<ToastProps, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(
  undefined,
);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  // Helper functions for common toast scenarios
  const showError = React.useCallback(
    (title: string, description?: string, duration?: number) => {
      context.addToast({
        title,
        description,
        variant: "error",
        duration: duration ?? 8000, // Longer duration for errors
      });
    },
    [context],
  );

  const showSuccess = React.useCallback(
    (title: string, description?: string, duration?: number) => {
      context.addToast({
        title,
        description,
        variant: "success",
        duration: duration ?? 4000,
      });
    },
    [context],
  );

  const showWarning = React.useCallback(
    (title: string, description?: string, duration?: number) => {
      context.addToast({
        title,
        description,
        variant: "warning",
        duration: duration ?? 6000,
      });
    },
    [context],
  );

  const showInfo = React.useCallback(
    (title: string, description?: string, duration?: number) => {
      context.addToast({
        title,
        description,
        variant: "info",
        duration: duration ?? 5000,
      });
    },
    [context],
  );

  return {
    ...context,
    showError,
    showSuccess,
    showWarning,
    showInfo,
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const addToast = React.useCallback((toast: Omit<ToastProps, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto remove after duration
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

function ToastViewport() {
  const { toasts } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
}

function Toast({
  id,
  title,
  description,
  variant = "default",
  onClose,
}: ToastProps) {
  const { removeToast } = useToast();

  const handleClose = () => {
    removeToast(id);
    onClose?.();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300";
      case "error":
        return "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300";
      case "warning":
        return "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950/30 dark:border-yellow-800 dark:text-yellow-300";
      case "info":
        return "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300";
      default:
        return "bg-background border-border text-foreground shadow-lg";
    }
  };

  const getIcon = () => {
    switch (variant) {
      case "success":
        return <CheckCircle className="h-4 w-4" />;
      case "error":
        return <XCircle className="h-4 w-4" />;
      case "warning":
        return <AlertCircle className="h-4 w-4" />;
      case "info":
        return <Info className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex w-full items-center gap-3 rounded-lg border p-4 shadow-sm transition-all animate-in fade-in slide-in-from-right-5",
        getVariantStyles(),
      )}
    >
      {getIcon()}
      <div className="flex-1 space-y-1">
        {title && <div className="text-sm font-semibold">{title}</div>}
        {description && <div className="text-sm opacity-90">{description}</div>}
      </div>
      <button
        onClick={handleClose}
        className="absolute top-2 right-2 rounded-md p-1 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>
    </div>
  );
}

export { Toast };
