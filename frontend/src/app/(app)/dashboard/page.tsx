"use client";

import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="px-5 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900">Home</h1>
          <p className="text-sm text-gray-500">Welcome back{user?.email ? `, ${user.email}` : ""}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-sm font-semibold text-white"
        >
          {user?.email?.charAt(0).toUpperCase() ?? "?"}
        </button>
      </div>
      <div className="rounded-xl bg-white p-6 text-center shadow-sm">
        <p className="text-lg font-medium text-gray-700">Dashboard</p>
        <p className="mt-1 text-sm text-gray-500">Coming in step 7a</p>
      </div>
    </div>
  );
}
