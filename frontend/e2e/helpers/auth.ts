import type { Page } from "@playwright/test";

const SUPABASE_URL = "https://jyubxcugxmtdsemfjucq.supabase.co";

const fakeUser = {
  id: "e2e-user-uuid",
  aud: "authenticated",
  role: "authenticated",
  email: "e2e@example.com",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { display_name: "E2E User" },
  identities: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function makeFakeJwt(): string {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: fakeUser.id,
    aud: "authenticated",
    role: "authenticated",
    email: fakeUser.email,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };

  const toBase64Url = (obj: object) => {
    const json = JSON.stringify(obj);
    return btoa(json)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };

  return `${toBase64Url(header)}.${toBase64Url(payload)}.fake_signature`;
}

export async function setFakeAuth(page: Page) {
  const accessToken = makeFakeJwt();
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;

  // Intercept all Supabase auth API calls to return our fake session
  await page.route(`${SUPABASE_URL}/auth/v1/**`, (route) => {
    const url = route.request().url();

    const session = {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: expiresAt,
      refresh_token: "fake-refresh-token",
      user: fakeUser,
    };

    if (url.includes("/logout") || url.includes("/signout")) {
      return route.fulfill({ status: 204 });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(session),
    });
  });

  // Write to the storage key that @supabase/ssr reads from cookies
  // The createBrowserClient reads using CookieAuthStorageAdapter which
  // reads from document.cookie. We set the cookie in the correct format.
  const cookieName = "sb-jyubxcugxmtdsemfjucq-auth-token";

  const sessionValue = JSON.stringify({
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: "fake-refresh-token",
    user: fakeUser,
  });

  // Set cookie via addInitScript to ensure it's available before any JS runs
  await page.addInitScript(
    ({ name, value }) => {
      document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=3600`;
      // Also set localStorage as a backup
      localStorage.setItem(name, value);
    },
    { name: cookieName, value: sessionValue },
  );
}
