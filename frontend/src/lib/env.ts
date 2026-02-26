// Use literal process.env.NEXT_PUBLIC_* access so webpack/Next.js can inline
// values into the client bundle. Dynamic access (process.env[name]) won't be
// replaced and will be undefined in the browser.

function assertDefined(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill in the values.`,
    );
  }
  return value;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: assertDefined(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: assertDefined(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  NEXT_PUBLIC_API_URL: assertDefined("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL),
} as const;
