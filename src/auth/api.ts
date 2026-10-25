export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, credentials: "same-origin" });
  } catch (error) {
    console.error("FarmBridge API request could not reach the server.", error);
    throw new ApiError("Could not reach the FarmBridge server. Start it with npm.cmd run dev.", "SERVER_UNAVAILABLE", 0);
  }

  if (response.status === 204) return undefined as T;
  let data: { error?: string; code?: string } & T;
  try {
    data = await response.json() as { error?: string; code?: string } & T;
  } catch (error) {
    console.error("FarmBridge API returned an invalid response.", error);
    throw new ApiError("The server returned an invalid response. Please try again.", "INVALID_RESPONSE", response.status);
  }
  if (!response.ok) {
    throw new ApiError(data.error || "The request could not be completed.", data.code || "REQUEST_FAILED", response.status);
  }
  return data;
}
