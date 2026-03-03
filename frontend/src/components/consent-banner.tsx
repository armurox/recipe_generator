"use client";

import { useCurrentUser, useUpdateUser } from "@/hooks/use-user";
import { MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Module-level flag to prevent double-firing the auto-apply effect
let pendingConsentApplied = false;

export function ConsentBanner() {
  const { data: user, isLoading } = useCurrentUser();
  const updateUser = useUpdateUser();
  const [dismissed, setDismissed] = useState(false);

  // Auto-apply pending consent from login/register checkbox.
  // After mutation succeeds, useUpdateUser's onSuccess updates the user cache,
  // which makes user.feedback_consent === true and hides the banner naturally.
  useEffect(() => {
    if (!user || user.feedback_consent || pendingConsentApplied) return;

    const pending = localStorage.getItem("pantrychef_pending_feedback_consent");
    if (pending) {
      localStorage.removeItem("pantrychef_pending_feedback_consent");
      pendingConsentApplied = true;
      updateUser.mutate(
        { feedback_consent: true },
        {
          onError: () => toast.error("Failed to save feedback preference"),
        },
      );
    }
  }, [user, updateUser]);

  if (isLoading || !user || user.feedback_consent || dismissed) return null;

  function handleOptIn() {
    updateUser.mutate(
      { feedback_consent: true },
      {
        onError: () => toast.error("Failed to save feedback preference"),
      },
    );
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-50 mx-auto max-w-md bg-green-50 px-4 py-2.5">
      <div className="flex items-start gap-2.5">
        <MessageCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-700" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug text-green-800">
            Help us improve PantryChef! Opt in to receive occasional feedback requests.
          </p>
          <button
            type="button"
            onClick={handleOptIn}
            disabled={updateUser.isPending}
            className="mt-1.5 rounded-md bg-green-700 px-3 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-green-800 disabled:opacity-50"
          >
            {updateUser.isPending ? "Saving..." : "Opt In"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 p-0.5 text-green-600 transition-colors hover:text-green-800"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
