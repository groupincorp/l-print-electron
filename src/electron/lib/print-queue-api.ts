// Minimal REST client for l-pos, usable from the Electron main process.
// The renderer already has its own authenticated fetch helper
// (src/frontend/server/request-api.ts) for the polling queue UI, but that
// can't be reached from here - main process code (socket.ts) needs to call
// l-pos directly right after a WS-pushed kitchen ticket finishes printing,
// with no renderer/IPC round trip in between.

let cachedServerEndpoint: string | null = null;
let cachedToken: string | null = null;

/** Called whenever the renderer's login token or server endpoint changes. */
export function setPrintQueueCredentials(
  serverEndpoint: string | null,
  token: string | null,
) {
  cachedServerEndpoint = serverEndpoint ? serverEndpoint.replace(/\/+$/, "") : null;
  cachedToken = token;
}

/**
 * Archive-and-remove print_queue row(s) after a direct WS-pushed print
 * succeeded, mirroring the delete the polling queue already performs after
 * a successful print. `ids` is normally one row (ITEM-mode ticket), but a
 * "group_by: TABLE" ticket merges several rows into one printed ticket, so
 * its queueId arrives as a comma-joined list - accept either shape here
 * rather than making every caller split it first. Best-effort: if this
 * fails, the row(s) simply stay queued and the 10s poller reprints them -
 * a rare duplicate ticket is an acceptable fallback, not a new failure mode.
 */
export async function deletePrintQueueRows(
  ids: number | number[],
): Promise<void> {
  if (!cachedServerEndpoint || !cachedToken) return;
  const idList = Array.isArray(ids) ? ids : [ids];
  if (idList.length === 0) return;
  try {
    await fetch(`${cachedServerEndpoint}/api/print-queue/delete`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cachedToken}`,
      },
      body: JSON.stringify({ ids: idList }),
    });
  } catch (err) {
    console.error(`Failed to delete print_queue row(s) ${idList.join(",")}:`, err);
  }
}
