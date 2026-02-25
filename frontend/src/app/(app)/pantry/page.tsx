"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounce";
import {
  useBulkDeletePantryItems,
  useDeletePantryItem,
  usePantryItems,
  usePantrySearch,
  usePantrySummary,
  useUpdatePantryItem,
} from "@/hooks/use-pantry";
import { useCurrentUser } from "@/hooks/use-user";
import type { PantryItem } from "@/types/api";
import { Camera, CheckSquare, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AddItemDialog } from "./_components/add-item-dialog";
import { BulkActionBar } from "./_components/bulk-action-bar";
import { CategoryGroup } from "./_components/category-group";
import { DeleteConfirmDialog } from "./_components/delete-confirm-dialog";
import { EditItemSheet } from "./_components/edit-item-sheet";
import { PantryFilters, type PantryFilter } from "./_components/pantry-filters";
import { PantrySearch } from "./_components/pantry-search";

type GroupedItems = {
  categoryName: string;
  categoryIcon: string | null;
  items: PantryItem[];
};

function groupByCategory(items: PantryItem[]): GroupedItems[] {
  const groups = new Map<string, GroupedItems>();

  for (const item of items) {
    const name = item.ingredient.category_name ?? "Uncategorized";
    const icon = item.ingredient.category_icon;

    if (!groups.has(name)) {
      groups.set(name, { categoryName: name, categoryIcon: icon, items: [] });
    }
    groups.get(name)!.items.push(item);
  }

  // Sort groups alphabetically, items within group by expiry date (nulls last)
  const sorted = Array.from(groups.values()).sort((a, b) =>
    a.categoryName.localeCompare(b.categoryName),
  );

  for (const group of sorted) {
    group.items.sort((a, b) => {
      if (!a.expiry_date && !b.expiry_date) return 0;
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return a.expiry_date.localeCompare(b.expiry_date);
    });
  }

  return sorted;
}

function mergeItems(clientItems: PantryItem[], serverItems: PantryItem[]): PantryItem[] {
  const seen = new Set(clientItems.map((item) => item.id));
  const merged = [...clientItems];
  for (const item of serverItems) {
    if (!seen.has(item.id)) {
      merged.push(item);
    }
  }
  return merged;
}

export default function PantryPage() {
  const [filter, setFilter] = useState<PantryFilter>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const { data: user } = useCurrentUser();

  // Selection mode state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Add item dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Edit item sheet state
  const [editItem, setEditItem] = useState<PantryItem | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const updatePantryItem = useUpdatePantryItem();
  const deletePantryItem = useDeletePantryItem();
  const bulkDeletePantryItems = useBulkDeletePantryItems();

  const queryFilters = useMemo(() => {
    if (filter === "available") return { status: "available" };
    if (filter === "expiring") return { status: "available", expiring_within: 3 };
    if (filter === "expired") return { status: "expired" };
    return {};
  }, [filter]);

  const { data, isLoading, isPlaceholderData } = usePantryItems(queryFilters);
  const { data: summary } = usePantrySummary();
  const { data: serverSearchData, isLoading: isSearching } = usePantrySearch(
    debouncedSearch,
    queryFilters,
  );

  const isActiveSearch = search.trim().length > 0;

  // Client-side instant filter on currently loaded items
  const clientFiltered = useMemo(() => {
    const items = data?.items ?? [];
    if (!isActiveSearch) return items;
    const q = search.toLowerCase();
    return items.filter((item) => item.ingredient.name.toLowerCase().includes(q));
  }, [data?.items, search, isActiveSearch]);

  // Merge client-side results with server results (server may have items from other pages)
  const displayItems = useMemo(() => {
    if (!isActiveSearch) return clientFiltered;
    const serverItems = serverSearchData?.items ?? [];
    return mergeItems(clientFiltered, serverItems);
  }, [isActiveSearch, clientFiltered, serverSearchData?.items]);

  const groups = useMemo(() => groupByCategory(displayItems), [displayItems]);

  // Show skeleton when: initial load, OR client-side search found nothing and server is still searching
  const showSearchSkeleton =
    isActiveSearch && clientFiltered.length === 0 && isSearching && debouncedSearch.length > 0;
  const showSkeleton = isLoading || showSearchSkeleton;

  const initial =
    user?.display_name?.charAt(0).toUpperCase() ?? user?.email?.charAt(0).toUpperCase() ?? "?";

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(displayItems.map((item) => item.id)));
  }, [displayItems]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectMode(false);
  }, []);

  const handleQuantityChange = useCallback(
    (id: string, newQuantity: number) => {
      updatePantryItem.mutate(
        { id, data: { quantity: newQuantity } },
        { onError: () => toast.error("Failed to update quantity") },
      );
    },
    [updatePantryItem],
  );

  // Single item delete — opens confirmation dialog
  function handleDeleteItem(id: string) {
    setPendingDeleteId(id);
    setDeleteDialogOpen(true);
  }

  // Bulk delete — opens confirmation dialog
  function handleBulkDelete() {
    setPendingDeleteId(null);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (pendingDeleteId) {
      // Single delete
      try {
        await deletePantryItem.mutateAsync(pendingDeleteId);
        toast.success("Item deleted");
      } catch {
        toast.error("Failed to delete item");
      }
    } else {
      // Bulk delete
      const ids = Array.from(selectedIds);
      try {
        const result = await bulkDeletePantryItems.mutateAsync(ids);
        toast.success(
          `${result.deleted_count} ${result.deleted_count === 1 ? "item" : "items"} deleted`,
        );
        setSelectedIds(new Set());
        setIsSelectMode(false);
      } catch {
        toast.error("Failed to delete items");
      }
    }
    setDeleteDialogOpen(false);
    setPendingDeleteId(null);
  }

  const handleEditItem = useCallback((item: PantryItem) => {
    setEditItem(item);
    setEditSheetOpen(true);
  }, []);

  const isDeleting = deletePantryItem.isPending || bulkDeletePantryItems.isPending;
  const deleteCount = pendingDeleteId ? 1 : selectedIds.size;

  return (
    <div>
      <div className="flex items-center justify-between px-5 pb-4 pt-3">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900">Pantry</h1>
          {summary ? (
            <>
              <p className="mt-0.5 text-sm text-gray-500">
                {summary.total_available} {summary.total_available === 1 ? "item" : "items"}{" "}
                available for use
              </p>
              {summary.total_expiring_soon > 0 && (
                <p className="text-sm text-orange-500">
                  {summary.total_expiring_soon} expiring soon
                </p>
              )}
            </>
          ) : (
            <p className="mt-0.5 text-sm text-gray-500">Loading...</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAddDialogOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-green-700 text-white"
          >
            <Plus className="h-5 w-5" />
          </button>
          {displayItems.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (isSelectMode) {
                  deselectAll();
                } else {
                  setIsSelectMode(true);
                }
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                isSelectMode ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
              }`}
            >
              <CheckSquare className="h-4.5 w-4.5" />
            </button>
          )}
          <Link
            href="/settings"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600 text-base font-semibold text-white"
          >
            {initial}
          </Link>
        </div>
      </div>

      <div className={`px-5 ${isSelectMode ? "pb-36" : "pb-24"}`}>
        <PantrySearch value={search} onChange={setSearch} />
        <PantryFilters active={filter} onChange={setFilter} />

        {showSkeleton ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <Skeleton className="mb-2 h-5 w-32" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="mb-3 text-5xl">📦</div>
            <h2 className="mb-2 text-lg font-semibold">
              {isActiveSearch ? "No items found" : "Your pantry is empty"}
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              {isActiveSearch
                ? `No items matching "${search}"`
                : "Scan a receipt to start tracking your groceries"}
            </p>
            {!isActiveSearch && (
              <Link
                href="/scan"
                className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-6 py-3 text-sm font-semibold text-white"
              >
                <Camera className="h-4 w-4" />
                Scan Receipt
              </Link>
            )}
          </div>
        ) : (
          <div
            className={
              isPlaceholderData || isSearching
                ? "opacity-50 transition-opacity"
                : "transition-opacity"
            }
          >
            {groups.map((group) => (
              <CategoryGroup
                key={group.categoryName}
                categoryName={group.categoryName}
                categoryIcon={group.categoryIcon}
                items={group.items}
                isSelectMode={isSelectMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onDeleteItem={handleDeleteItem}
                onQuantityChange={handleQuantityChange}
                onEditItem={handleEditItem}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bulk action bar — shown when in select mode */}
      {isSelectMode && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={displayItems.length}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          onDelete={handleBulkDelete}
          isDeleting={bulkDeletePantryItems.isPending}
        />
      )}

      {/* Confirmation dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemCount={deleteCount}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Add item dialog */}
      <AddItemDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />

      {/* Edit item sheet */}
      <EditItemSheet item={editItem} open={editSheetOpen} onOpenChange={setEditSheetOpen} />
    </div>
  );
}
