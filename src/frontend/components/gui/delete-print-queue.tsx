import { requestDatabase } from "@/server/request-api";
import { Trash2 } from "lucide-react";
import { useCallback } from "react";
import type { table_print_queue } from "./print-queue";

export function DeletePrintQueue({
  print,
  onDeleted,
}: {
  print: table_print_queue;
  onDeleted?: () => void;
}) {
  const handleDelete = useCallback(() => {
    const id = String(print.id)
      .split(",")
      .map((x) => Number(x));
    requestDatabase("/api/print-queue/delete", "DELETE", {
      ids: [...id],
    }).then(() => {
      onDeleted?.();
    });
  }, [print, onDeleted]);

  return (
    <button
      onClick={handleDelete}
      title="Remove job"
      className="flex items-center justify-center w-6 h-6 rounded text-muted-foreground hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
