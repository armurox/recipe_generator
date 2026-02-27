import { describe, expect, it } from "vitest";
import { getAccessToken, setAccessToken } from "@/lib/auth-token";

describe("auth-token", () => {
  it("returns null by default", () => {
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it("stores and retrieves a token", () => {
    setAccessToken("my-jwt-token");
    expect(getAccessToken()).toBe("my-jwt-token");
  });

  it("clears the token", () => {
    setAccessToken("some-token");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });
});
