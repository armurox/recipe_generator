import { ApiError } from "@/lib/api-error";
import { MutationCache, QueryClient } from "@tanstack/react-query";

export function makeQueryClient(onUnauthorized: () => void): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000, // 2 minutes
        retry: 1,
      },
    },
    mutationCache: new MutationCache({
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) {
          onUnauthorized();
        }
      },
    }),
  });
}
