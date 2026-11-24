"use client";

import { useState, useEffect } from "react";
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  Clock, 
  User, 
  FileText, 
  CreditCard, 
  Package, 
  Truck, 
  MapPin, 
  Users, 
  RefreshCw, 
  ShieldAlert, 
  CheckCircle2, 
  Info,
  Search,
  Filter
} from "lucide-react";
import { DataService } from "@/lib/dataService";
import { Role } from "@/lib/types";

export interface TrashItem {
  id: string;
  entity_type: string;
  display_name: string;
  deleted_at: string;
  deleted_by: string;
  days_left: number;
  raw_data?: Record<string, any>;
}

type CategoryTab = "ALL" | "load_slips" | "invoices" | "products" | "trucks" | "delivery_hubs" | "user_accounts";

export default function TrashManagement() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<CategoryTab>("ALL");
  const [statusNotification, setStatusNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Modal state for permanent deletion
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<TrashItem | null>(null);
  const [isDeletingForever, setIsDeletingForever] = useState(false);
  const [adminRoleConfirm, setAdminRoleConfirm] = useState(false);

  // Current logged in user (default Dino Trocino / Owner)
  const currentUser = DataService.getCurrentUser();

  const loadTrash = async () => {
    setIsLoading(true);
    try {
      const data = await DataService.fetchTrashItems();
      setItems(data);
    } catch (e: any) {
      console.error("Error loading trash items:", e);
      setStatusNotification({ type: "error", message: "Failed to load trash items from database." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const handleRestore = async (item: TrashItem) => {
    try {
      const res = await DataService.restoreTrashItem(item.entity_type, item.id, currentUser.name);
      if (res.success) {
        setStatusNotification({
          type: "success",
          message: `Successfully restored "${item.display_name}" (${getEntityTypeLabel(item.entity_type)}) back to active operations.`
        });
        setItems(prev => prev.filter(i => !(i.id === item.id && i.entity_type === item.entity_type)));
      } else {
        setStatusNotification({ type: "error", message: res.message || "Failed to restore item." });
      }
    } catch (err: any) {
      setStatusNotification({ type: "error", message: err.message || "Network error while restoring." });
    }
  };

  const handleOpenPermanentDelete = (item: TrashItem) => {
    if (currentUser.role !== "Owner") {
      setStatusNotification({
        type: "error",
        message: "Permanent deletion is strictly restricted to the Owner role. Staff members can only restore items."
      });
      return;
    }
    setPermanentDeleteTarget(item);
    setAdminRoleConfirm(false);
  };

  const handleConfirmPermanentDelete = async () => {
    if (!permanentDeleteTarget) return;
    setIsDeletingForever(true);
    try {
      const res = await DataService.deleteForeverTrashItem(
        permanentDeleteTarget.entity_type,
        permanentDeleteTarget.id,
        currentUser.id
      );
      if (res.success) {
        setStatusNotification({
          type: "info",
          message: `"${permanentDeleteTarget.display_name}" was permanently purged from the database.`
        });
        setItems(prev => prev.filter(i => !(i.id === permanentDeleteTarget.id && i.entity_type === permanentDeleteTarget.entity_type)));
        setPermanentDeleteTarget(null);
      } else {
        setStatusNotification({ type: "error", message: res.message || "Failed to permanently delete item." });
      }
    } catch (err: any) {
      setStatusNotification({ type: "error", message: err.message || "Network error." });
    } finally {
      setIsDeletingForever(false);
    }
  };

  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case "load_slips": return "Load Slip";
      case "invoices": return "Invoice";
      case "products": return "Product";
      case "trucks": return "Truck";
      case "delivery_hubs": return "Location Hub";
      case "customers": return "Customer";
      case "user_accounts": return "User Account";
      default: return type;
    }
  };

  const getEntityTypeIcon = (type: string) => {
    switch (type) {
      case "load_slips": return <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case "invoices": return <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case "products": return <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case "trucks": return <Truck className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case "delivery_hubs": return <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case "customers": return <Users className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
      case "user_accounts": return <Users className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      default: return <Trash2 className="w-4 h-4 text-gray-500" />;
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "load_slips": return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "invoices": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "products": return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "trucks": return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "delivery_hubs": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
      case "customers": return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800";
      case "user_accounts": return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200";
    }
  };

  const formatManilaDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  const filteredItems = items.filter(item => {
    if (selectedTab !== "ALL" && item.entity_type !== selectedTab) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.display_name.toLowerCase().includes(q);
      const matchUser = item.deleted_by.toLowerCase().includes(q);
      const matchType = item.entity_type.toLowerCase().includes(q);
      return matchName || matchUser || matchType;
    }
    return true;
  });

  const getTabCount = (tab: CategoryTab) => {
    if (tab === "ALL") return items.length;
    return items.filter(i => i.entity_type === tab).length;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center border border-rose-200 dark:border-rose-800">
            <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              Trash / Recently Deleted
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300">
                30-Day Recovery Vault
              </span>
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Soft-deleted records are preserved for 30 days. You can safely restore them back into live operations at any time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadTrash}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusNotification && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold ${
          statusNotification.type === "success" 
            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-900 dark:text-emerald-300"
            : statusNotification.type === "error"
            ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-900 dark:text-rose-300"
            : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 text-blue-900 dark:text-blue-300"
        }`}>
          <div className="flex items-center gap-2">
            {statusNotification.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {statusNotification.type === "error" && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            {statusNotification.type === "info" && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
            <span>{statusNotification.message}</span>
          </div>
          <button 
            onClick={() => setStatusNotification(null)}
            className="text-gray-400 hover:text-gray-600 text-base font-black px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Category Tabs & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "ALL" as CategoryTab, label: "All Items" },
            { id: "load_slips" as CategoryTab, label: "Load Slips" },
            { id: "invoices" as CategoryTab, label: "Invoices" },
            { id: "products" as CategoryTab, label: "Products" },
            { id: "trucks" as CategoryTab, label: "Trucks" },
            { id: "delivery_hubs" as CategoryTab, label: "Location Hubs" },
            { id: "user_accounts" as CategoryTab, label: "Accounts" }
          ].map(tab => {
            const count = getTabCount(tab.id);
            const isActive = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive 
                    ? "bg-[#00875A] text-white shadow-sm" 
                    : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  isActive ? "bg-white/30 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search deleted items by name, ID, or deleted by..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00875A]"
          />
        </div>
      </div>

      {/* Trash Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#00875A] animate-spin mx-auto" />
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Loading trash records from database...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-black text-gray-900 dark:text-white">Trash is Clean</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              {searchQuery ? "No deleted items match your search filter." : "No records currently in the 30-day trash vault. All active data is live and healthy."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="py-3.5 px-4">Item & Identifier</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Deleted By</th>
                  <th className="py-3.5 px-4">Deletion Date</th>
                  <th className="py-3.5 px-4">Grace Period</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
                {filteredItems.map((item) => {
                  const daysLeft = item.days_left ?? 30;
                  const isExpiringSoon = daysLeft <= 3;
                  const isMidGrace = daysLeft <= 10 && daysLeft > 3;

                  return (
                    <tr 
                      key={`${item.entity_type}-${item.id}`}
                      className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Name / Identifier */}
                      <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 shrink-0">
                            {getEntityTypeIcon(item.entity_type)}
                          </div>
                          <div>
                            <span className="block">{item.display_name}</span>
                            <span className="text-[10px] text-gray-400 font-mono">ID: {item.id.slice(0, 18)}...</span>
                          </div>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${getBadgeColor(item.entity_type)}`}>
                          {getEntityTypeLabel(item.entity_type)}
                        </span>
                      </td>

                      {/* Deleted By */}
                      <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300 font-medium">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <span>{item.deleted_by || "Staff"}</span>
                        </div>
                      </td>

                      {/* Deletion Date */}
                      <td className="py-3.5 px-4 text-gray-500 dark:text-gray-400 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>{formatManilaDate(item.deleted_at)}</span>
                        </div>
                      </td>

                      {/* Grace Period Countdown */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border ${
                          isExpiringSoon
                            ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 animate-pulse"
                            : isMidGrace
                            ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                            : "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                        }`}>
                          <Clock className="w-3 h-3" />
                          {daysLeft > 0 ? `${daysLeft} days left` : "Expired (Pending Purge)"}
                        </span>
                      </td>

                      {/* Actions: Restore & Permanent Delete */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Restore Button */}
                          <button
                            onClick={() => handleRestore(item)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl font-bold text-xs transition-colors shadow-sm"
                            title="Restore back to active operations"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore</span>
                          </button>

                          {/* Delete Forever Button (Owner Restricted) */}
                          <button
                            onClick={() => handleOpenPermanentDelete(item)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-xl font-bold text-xs transition-colors"
                            title="Permanent deletion (Owner only)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Delete Forever</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Permanent Deletion Confirmation Modal */}
      {permanentDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-rose-200 dark:border-rose-900/50 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-950/50 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-base text-gray-900 dark:text-white">Confirm Permanent Deletion</h3>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                  Owner Role Authorization Required
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl space-y-2">
              <p className="text-xs text-rose-950 dark:text-rose-200 font-bold leading-relaxed">
                You are about to PERMANENTLY purge this record from PostgreSQL:
              </p>
              <div className="text-xs bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/50 font-mono">
                <p className="font-bold text-gray-900 dark:text-white">{permanentDeleteTarget.display_name}</p>
                <p className="text-gray-500 text-[10px] mt-0.5">Table: {permanentDeleteTarget.entity_type} • ID: {permanentDeleteTarget.id}</p>
              </div>
              <p className="text-[11px] text-rose-800 dark:text-rose-300 font-semibold">
                ⚠️ This cannot be recovered or undone. All associated history will be cleared.
              </p>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-gray-700 dark:text-gray-300 font-semibold select-none pt-1">
              <input
                type="checkbox"
                checked={adminRoleConfirm}
                onChange={(e) => setAdminRoleConfirm(e.target.checked)}
                className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
              />
              <span>I confirm as Owner ({currentUser.name}) that this record should be permanently deleted immediately.</span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPermanentDeleteTarget(null)}
                disabled={isDeletingForever}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPermanentDelete}
                disabled={!adminRoleConfirm || isDeletingForever}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingForever ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Purging...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Purge Forever</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
