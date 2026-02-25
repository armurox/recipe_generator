"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 text-5xl">😕</div>
      <h1 className="mb-2 text-xl font-bold text-gray-900">Something went wrong</h1>
      <p className="mb-6 text-sm text-gray-500">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button onClick={reset} className="rounded-xl bg-green-700 px-6 hover:bg-green-700/90">
        Try again
      </Button>
    </div>
  );
}
