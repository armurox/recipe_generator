"use client";

import { BottomNav } from "@/components/bottom-nav";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace("/login");
    }
  }, [session, isLoading, router]);

  if (isLoading) {
    return (
      <div className="mx-auto min-h-dvh max-w-md bg-bg p-5">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-3 h-24 w-full rounded-xl" />
        <Skeleton className="mb-3 h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-bg pb-24">
      {children}
      <BottomNav />
    </div>
  );
}
