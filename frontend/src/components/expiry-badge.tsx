"use client";

import { cn } from "@/lib/utils";

type ExpiryBadgeProps = {
  expiryDate: string | null;
  showDate?: boolean;
};

function getExpiryInfo(expiryDate: string | null): {
  label: string;
  color: "expired" | "soon" | "ok";
  dateStr: string | null;
} {
  if (!expiryDate) {
    return { label: "No expiry", color: "ok", dateStr: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate + "T00:00:00");
  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const dateStr = expiry.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(expiry.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });

  if (diffDays < 0) {
    return { label: "Expired", color: "expired", dateStr };
  }
  if (diffDays === 0) {
    return { label: "Today", color: "expired", dateStr };
  }
  if (diffDays === 1) {
    return { label: "Expiring tomorrow", color: "soon", dateStr };
  }
  if (diffDays <= 3) {
    return { label: `Expiring in ${diffDays} days`, color: "soon", dateStr };
  }
  if (diffDays <= 30) {
    return { label: `${diffDays} days`, color: "ok", dateStr };
  }
  return { label: `${diffDays} days`, color: "ok", dateStr };
}

const colorClasses = {
  expired: "text-red-500",
  soon: "text-orange-500",
  ok: "text-green-600",
};

export function ExpiryBadge({ expiryDate, showDate = false }: ExpiryBadgeProps) {
  const { label, color, dateStr } = getExpiryInfo(expiryDate);

  return (
    <div className="text-right">
      <span className={cn("text-xs font-medium", colorClasses[color])}>{label}</span>
      {showDate && dateStr && <div className="mt-0.5 text-[11px] text-gray-500">{dateStr}</div>}
    </div>
  );
}
