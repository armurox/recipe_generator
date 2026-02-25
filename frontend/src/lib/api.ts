import { ApiError } from "@/lib/api-error";
import { createClient } from "@/lib/supabase";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = "An unexpected error occurred";
    try {
      const body = await response.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      // response body wasn't JSON
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers,
    });
    return handleResponse<T>(response);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(response);
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse<T>(response);
  },

  async delete<T = void>(path: string): Promise<T> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "DELETE",
      headers,
    });
    return handleResponse<T>(response);
  },
};
