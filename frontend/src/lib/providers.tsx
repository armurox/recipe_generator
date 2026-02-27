"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { makeQueryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toaster } from "sonner";

const ReactQueryDevtools =
  process.env.NODE_ENV === "development"
    ? dynamic(
        () => import("@tanstack/react-query-devtools").then((mod) => mod.ReactQueryDevtools),
        { ssr: false },
      )
    : () => null;

function QueryProvider({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const router = useRouter();
  const [queryClient] = useState(() =>
    makeQueryClient(() => {
      signOut().then(() => router.push("/login"));
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryProvider>
        {children}
        <Toaster position="top-center" richColors />
      </QueryProvider>
    </AuthProvider>
  );
}
