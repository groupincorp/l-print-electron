import { requestDatabase } from "@/server/request-api";
import { Trash } from "lucide-react";
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
    <div
      onClick={handleDelete}
      className="bg-red-500 text-white p-2 cursor-pointer rounded"
    >
      <Trash className="h-4 w-4" />
    </div>
  );
}
