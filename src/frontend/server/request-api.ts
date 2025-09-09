const endpoint = "https://0cmdr7x3-3000.asse.devtunnels.ms";

export async function requestDatabase<ResponseType = unknown>(
  url: string,
  method: "GET" | "POST" | "DELETE" | "PUT" = "GET",
  body?: unknown
): Promise<ResponseType> {
  const token = localStorage.getItem("token");
  const raw = await fetch(`${endpoint}${url}`, {
    method,
    headers: token
      ? {
          "Content-Type": method !== "GET" ? "application/json" : "",
          Authorization: `Bearer ${token ? token || "" : ""}`,
        }
      : {
          "Content-Type": method !== "GET" ? "application/json" : "",
        },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await raw.json();

  return json as ResponseType;
}
