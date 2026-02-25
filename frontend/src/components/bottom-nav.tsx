"use client";

import { BookOpen, Camera, Home, Package, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isScan?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/pantry", label: "Pantry", icon: Package },
  { href: "/scan", label: "Scan", icon: Camera, isScan: true },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 items-end justify-around border-t border-gray-100 bg-white pb-7 pt-2">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;

        if (item.isScan) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1"
            >
              <div className="-mt-5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-green-700 shadow-[0_4px_12px_rgba(45,106,79,0.3)]">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <span className="text-[11px] font-medium text-gray-500">{item.label}</span>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 text-[11px] font-medium",
              isActive ? "text-green-700" : "text-gray-500",
            )}
          >
            <Icon className="h-6 w-6" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
