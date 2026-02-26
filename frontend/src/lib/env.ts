function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill in the values.`,
    );
  }
  return value;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  NEXT_PUBLIC_API_URL: requireEnv("NEXT_PUBLIC_API_URL"),
} as const;
