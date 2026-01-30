export async function requestDatabase<ResponseType = unknown>(
  url: string,
  method: "GET" | "POST" | "DELETE" | "PUT" = "GET",
  body?: unknown,
): Promise<ResponseType> {
  const token = localStorage.getItem("token");
  const endpoint = localStorage.getItem("server-endpoint");

  if (!endpoint) {
    throw new Error(
      "Server endpoint not configured. Please check your settings.",
    );
  }

  try {
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

    if (!raw.ok) {
      // Handle different HTTP error status codes
      switch (raw.status) {
        case 401:
          throw new Error(
            "Authentication failed. Please check your credentials.",
          );
        case 403:
          throw new Error(
            "Access denied. You don't have permission for this action.",
          );
        case 404:
          throw new Error(
            "Resource not found. Please check the server configuration.",
          );
        case 500:
          throw new Error("Server error. Please try again later.");
        case 503:
          throw new Error(
            "Server temporarily unavailable. Please try again later.",
          );
        default:
          throw new Error(
            `Request failed with status ${raw.status}: ${raw.statusText}`,
          );
      }
    }

    // Check if response has content
    const contentType = raw.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const json = await raw.json();
      return json as ResponseType;
    } else {
      // Handle non-JSON responses
      const text = await raw.text();
      return text as ResponseType;
    }
  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof Error) {
      throw error;
    }

    // Handle network errors
    throw new Error(
      "Network error. Please check your internet connection and server settings.",
    );
  }
}
