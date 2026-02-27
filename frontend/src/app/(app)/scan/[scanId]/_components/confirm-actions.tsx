"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { Loader2 } from "lucide-react";

type ConfirmActionsProps = {
  onConfirm: () => void;
  onDiscard: () => void;
  isConfirming: boolean;
  isDiscarding: boolean;
  itemCount: number;
};

export function ConfirmActions({
  onConfirm,
  onDiscard,
  isConfirming,
  isDiscarding,
  itemCount,
}: ConfirmActionsProps) {
  const isOnline = useOnlineStatus();
  const busy = isConfirming || isDiscarding;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy || itemCount === 0 || !isOnline}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-6 py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
      >
        {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
        Confirm & Add to Pantry
      </button>
      <button
        type="button"
        onClick={onDiscard}
        disabled={busy || !isOnline}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-gray-300 px-6 py-3 text-[15px] font-semibold text-gray-700 disabled:opacity-50"
      >
        {isDiscarding && <Loader2 className="h-4 w-4 animate-spin" />}
        Discard Scan
      </button>
    </div>
  );
}
