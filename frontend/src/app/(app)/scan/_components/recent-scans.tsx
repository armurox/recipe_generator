"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRecentScans } from "@/hooks/use-receipts";
import Link from "next/link";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusBadge(status: string) {
  if (status === "confirmed") {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-700">
        Confirmed
      </Badge>
    );
  }
  if (status === "completed") {
    return (
      <Badge variant="secondary" className="bg-blue-100 text-blue-700">
        Pending Review
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-600">
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
      Processing
    </Badge>
  );
}

export function RecentScans() {
  const { data, isLoading } = useRecentScans();
  const scans = data?.items ?? [];

  if (isLoading) {
    return (
      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-gray-900">Recent Scans</h2>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (scans.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-[15px] font-semibold text-gray-900">Recent Scans</h2>
      <div className="rounded-xl bg-white shadow-sm">
        {scans.map((scan) => (
          <Link
            key={scan.id}
            href={
              scan.status === "completed" || scan.status === "confirmed" ? `/scan/${scan.id}` : "#"
            }
            className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-lg">
              🧾
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-medium text-gray-900">
                {scan.store_name || "Unknown Store"}
              </div>
              <div className="text-[13px] text-gray-500">
                {scan.item_count} items · {formatDate(scan.scanned_at)}
              </div>
            </div>
            <div>{statusBadge(scan.status)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
