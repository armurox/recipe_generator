"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-50 mx-auto max-w-md bg-amber-500 px-4 py-2">
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-white">
        <WifiOff className="h-4 w-4" />
        You&apos;re offline — some features are unavailable
      </div>
    </div>
  );
}
