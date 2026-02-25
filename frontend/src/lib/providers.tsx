"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { makeQueryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toaster } from "sonner";

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
