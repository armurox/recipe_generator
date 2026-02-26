import { ApiError } from "@/lib/api-error";
import { setAccessToken } from "@/lib/auth-token";
import { server } from "@/test/mocks/server";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";

// Import apiClient after env is set (setup.ts sets NEXT_PUBLIC_API_URL)
const { apiClient } = await import("@/lib/api");

const API_URL = "http://localhost:8000/api/v1";

describe("apiClient", () => {
  afterEach(() => {
    setAccessToken(null);
  });

  it("sends Authorization header when token is set", async () => {
    let capturedAuth: string | null = null;
    server.use(
      http.get(`${API_URL}/me`, ({ request }) => {
        capturedAuth = request.headers.get("Authorization");
        return HttpResponse.json({ id: "1" });
      }),
    );

    setAccessToken("test-token-123");
    await apiClient.get("/me");
    expect(capturedAuth).toBe("Bearer test-token-123");
  });

  it("does not send Authorization header when no token", async () => {
    let capturedAuth: string | null = "initial";
    server.use(
      http.get(`${API_URL}/me`, ({ request }) => {
        capturedAuth = request.headers.get("Authorization");
        return HttpResponse.json({ id: "1" });
      }),
    );

    setAccessToken(null);
    await apiClient.get("/me");
    expect(capturedAuth).toBeNull();
  });

  it("parses JSON error response into ApiError", async () => {
    server.use(
      http.get(`${API_URL}/me`, () =>
        HttpResponse.json({ detail: "Not authenticated" }, { status: 401 }),
      ),
    );

    await expect(apiClient.get("/me")).rejects.toThrow(ApiError);
    try {
      await apiClient.get("/me");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(401);
      expect((err as ApiError).detail).toBe("Not authenticated");
    }
  });

  it("handles non-JSON error gracefully", async () => {
    server.use(
      http.get(`${API_URL}/me`, () => new HttpResponse("Internal Server Error", { status: 500 })),
    );

    try {
      await apiClient.get("/me");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(500);
      expect((err as ApiError).detail).toBe("An unexpected error occurred");
    }
  });

  it("returns undefined for 204 No Content", async () => {
    server.use(http.delete(`${API_URL}/pantry/123`, () => new HttpResponse(null, { status: 204 })));

    const result = await apiClient.delete("/pantry/123");
    expect(result).toBeUndefined();
  });

  it("sends POST body as JSON", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(`${API_URL}/pantry/`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ item: {}, created: true }, { status: 201 });
      }),
    );

    await apiClient.post("/pantry/", { ingredient_name: "Eggs" });
    expect(capturedBody).toEqual({ ingredient_name: "Eggs" });
  });

  it("sends PATCH body as JSON", async () => {
    let capturedBody: unknown = null;
    server.use(
      http.patch(`${API_URL}/pantry/abc`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: "abc" });
      }),
    );

    await apiClient.patch("/pantry/abc", { quantity: 5 });
    expect(capturedBody).toEqual({ quantity: 5 });
  });
});
