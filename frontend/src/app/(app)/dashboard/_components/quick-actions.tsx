import { Camera, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

export function QuickActions() {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3">
      <Link href="/scan" className="rounded-xl bg-white p-4 text-center shadow-sm">
        <div className="mb-2 text-3xl">
          <Camera className="mx-auto h-7 w-7 text-green-700" />
        </div>
        <div className="text-[13px] font-medium text-gray-900">Scan Receipt</div>
      </Link>
      <Link href="/recipes" className="rounded-xl bg-white p-4 text-center shadow-sm">
        <div className="mb-2 text-3xl">
          <UtensilsCrossed className="mx-auto h-7 w-7 text-green-700" />
        </div>
        <div className="text-[13px] font-medium text-gray-900">Find Recipes</div>
      </Link>
    </div>
  );
}
