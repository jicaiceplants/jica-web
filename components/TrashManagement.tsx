"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataService } from "@/lib/dataService";
import { formatManilaDateTime } from "@/lib/dateUtils";
import ConfirmModal from "@/components/ConfirmModal";
import {
  Trash2,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert
} from "lucide-react";

interface TrashItem {
  id: string;
  entity_type: string;
  display_name: string;
  deleted_at?: string;
  deleted_by?: string;
  days_left: number;
}

export function TrashManagement() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<TrashItem | null>(null);

  const currentUser = DataService.getCurrentUser();
  const isOwner = currentUser?.role === "Owner";

  const loadTrash = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const list = await DataService.fetchTrashItems();
      setItems(list || []);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTrash(false);
  }, [loadTrash]);

  const handleRestore = async (item: TrashItem) => {
    setBanner(null);
    const res = await DataService.restoreTrashItem(
      item.entity_type,
      item.id,
      currentUser?.name || "Staff"
    );
    if (res.success) {
      setItems(prev => prev.filter(i => !(i.id === item.id && i.entity_type === item.entity_type)));
      setBanner({ type: "success", text: `Restored "${item.display_name}".` });
    } else {
      setBanner({ type: "error", text: res.message });
    }
  };

  const handleConfirmPurge = async () => {
    if (!confirmPurge) return;
    const item = confirmPurge;
    setConfirmPurge(null);
    setBanner(null);

    const res = await DataService.deleteForeverTrashItem(
      item.entity_type,
      item.id,
      currentUser?.id || ""
    );

    if (res.success) {
      setItems(prev => prev.filter(i => !(i.id === item.id && i.entity_type === item.entity_type)));
      setBanner({ type: "success", text: `Permanently purged "${item.display_name}".` });
    } else {
      setBanner({ type: "error", text: res.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            <span>30-Day Soft Delete & Recovery Archive ({items.length})</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Deleted records stay recoverable here while protecting historical receipts from accidental data loss.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadTrash(true)}
          disabled={isRefreshing}
          className="min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh Archive</span>
        </button>
      </div>

      {banner && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
            banner.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
          }`}
        >
          {banner.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {!isOwner && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            You can restore records, while permanent database purging requires an Owner account.
          </span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading Trash Archive...</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Trash Archive is empty.
          </div>
        ) : (
          <div className="overflow-x-auto scroll-touch">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase font-bold">
                <tr>
                  <th className="px-4 py-3">Record</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Deleted By</th>
                  <th className="px-4 py-3">Deleted At</th>
                  <th className="px-4 py-3">Retention</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {items.map(item => (
                  <tr
                    key={`${item.entity_type}-${item.id}`}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30"
                  >
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                      {item.display_name}
                    </td>
                    <td className="px-4 py-3 uppercase font-mono text-[11px] text-slate-500">
                      {item.entity_type}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {item.deleted_by || "Staff"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatManilaDateTime(item.deleted_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-bold text-[11px]">
                        {item.days_left}d left
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleRestore(item)}
                          className="min-h-[44px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Restore</span>
                        </button>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => setConfirmPurge(item)}
                            className="min-h-[44px] px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Purge</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(confirmPurge)}
        title="Permanently Delete Record?"
        message={`This will permanently purge "${confirmPurge?.display_name}" (${confirmPurge?.entity_type}) from PostgreSQL. Historical links cannot be undone.`}
        onConfirm={handleConfirmPurge}
        onCancel={() => setConfirmPurge(null)}
      />
    </div>
  );
}

export default TrashManagement;
