"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser, useUpdateUser } from "@/hooks/use-user";
import { useAuth } from "@/lib/auth-context";
import { Check, ChevronRight, LogOut, Minus, Plus, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const DIETARY_OPTIONS = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "gluten free", label: "Gluten Free" },
  { value: "ketogenic", label: "Ketogenic" },
  { value: "paleo", label: "Paleo" },
  { value: "whole30", label: "Whole30" },
  { value: "primal", label: "Primal" },
  { value: "lacto-vegetarian", label: "Lacto-Vegetarian" },
  { value: "ovo-vegetarian", label: "Ovo-Vegetarian" },
  { value: "pescetarian", label: "Pescetarian" },
];

function ProfileSection() {
  const { data: user, isLoading } = useCurrentUser();
  const updateUser = useUpdateUser();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");

  function startEditing() {
    setName(user?.display_name ?? "");
    setEditingName(true);
  }

  function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === user?.display_name) {
      setEditingName(false);
      return;
    }
    updateUser.mutate(
      { display_name: trimmed },
      {
        onSuccess: () => {
          setEditingName(false);
          toast.success("Name updated");
        },
        onError: () => toast.error("Failed to update name"),
      },
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <User size={22} className="text-green-700" />
        </div>
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                autoFocus
                className="h-8 w-full rounded-lg border border-gray-200 px-2.5 text-[15px] outline-none focus:border-green-500"
              />
              <button
                type="button"
                onClick={saveName}
                disabled={updateUser.isPending}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-green-700 text-white"
              >
                <Check size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-gray-900">
                  {user?.display_name || "Set your name"}
                </p>
                <p className="truncate text-[13px] text-gray-500">{user?.email}</p>
              </div>
              <ChevronRight size={16} className="flex-shrink-0 text-gray-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DietaryPrefsSection() {
  const { data: user, isLoading } = useCurrentUser();
  const updateUser = useUpdateUser();

  const currentPrefs = user?.dietary_prefs ?? [];

  function togglePref(value: string) {
    const updated = currentPrefs.includes(value)
      ? currentPrefs.filter((p) => p !== value)
      : [...currentPrefs, value];

    updateUser.mutate(
      { dietary_prefs: updated },
      { onError: () => toast.error("Failed to update preferences") },
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl bg-white px-4 py-4 shadow-sm">
        <Skeleton className="mb-3 h-4 w-40" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white px-4 py-4 shadow-sm">
      <h3 className="mb-1 text-[15px] font-semibold text-gray-900">Dietary Preferences</h3>
      <p className="mb-3 text-[13px] text-gray-500">
        Applied automatically to recipe suggestions and search
      </p>
      <div className="flex flex-wrap gap-2">
        {DIETARY_OPTIONS.map((opt) => {
          const active = currentPrefs.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => togglePref(opt.value)}
              disabled={updateUser.isPending}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                active ? "bg-green-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HouseholdSection() {
  const { data: user, isLoading } = useCurrentUser();
  const updateUser = useUpdateUser();

  const size = user?.household_size ?? 1;

  function updateSize(delta: number) {
    const newSize = Math.max(1, Math.min(20, size + delta));
    if (newSize === size) return;
    updateUser.mutate(
      { household_size: newSize },
      { onError: () => toast.error("Failed to update household size") },
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl bg-white px-4 py-4 shadow-sm">
        <Skeleton className="mb-3 h-4 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white px-4 py-4 shadow-sm">
      <h3 className="mb-1 text-[15px] font-semibold text-gray-900">Household Size</h3>
      <p className="mb-3 text-[13px] text-gray-500">Used for recipe serving suggestions</p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => updateSize(-1)}
          disabled={size <= 1 || updateUser.isPending}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200 disabled:opacity-40"
        >
          <Minus size={16} />
        </button>
        <span className="min-w-[2ch] text-center text-lg font-semibold">{size}</span>
        <button
          type="button"
          onClick={() => updateSize(1)}
          disabled={size >= 20 || updateUser.isPending}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200 disabled:opacity-40"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

function SignOutButton() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      await signOut();
      router.replace("/login");
    } catch {
      toast.error("Failed to sign out");
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-[15px] font-semibold text-red-500 shadow-sm transition-colors hover:bg-red-50"
    >
      <LogOut size={18} />
      {pending ? "Signing out..." : "Sign Out"}
    </button>
  );
}

export default function SettingsPage() {
  return (
    <div className="px-5 pb-8 pt-4">
      <h1 className="mb-4 text-[28px] font-bold text-gray-900">Settings</h1>
      <div className="space-y-4">
        <ProfileSection />
        <DietaryPrefsSection />
        <HouseholdSection />
        <SignOutButton />
      </div>
    </div>
  );
}
