"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { DataService } from "@/lib/dataService";
import { supabase } from "@/lib/supabaseClient";
import { LoadSlip } from "@/lib/types";
import { formatPhp } from "@/lib/currencyUtils";
import { formatManilaDateTime, getCurrentManilaYear, getManilaDateString } from "@/lib/dateUtils";
import ConfirmModal from "@/components/ConfirmModal";
import {
  Search,
  Download,
  RefreshCw,
  Eye,
  Trash2,
  Printer,
  X,
  Truck,
  User,
  UserCheck,
  Package,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" }
];

type PaymentFilter = "ALL" | "Cash" | "Charge Invoice" | "Partial" | "Completed";

export function LoadSlipHistory() {
  const [history, setHistory] = useState<LoadSlip[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentFilter>("ALL");
  const [selectedSlip, setSelectedSlip] = useState<LoadSlip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [confirmDelete, setConfirmDelete] = useState<LoadSlip | null>(null);

  const loadHistory = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      await DataService.fetchLiveFromSupabase();
      setHistory(DataService.getHistoricalLoadSlips());
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const cached = DataService.getHistoricalLoadSlips();
    if (cached.length > 0) setHistory(cached);
    loadHistory(false);

    const channel = supabase
      .channel("load-slip-history-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "load_slips" }, () => {
        loadHistory(false);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "load_slip_items" }, () => {
        loadHistory(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadHistory]);

  const availableYears = useMemo(() => {
    const years = new Set<string>([getCurrentManilaYear()]);
    history.forEach(s => {
      const yr = (s.date || "").split("-")[0];
      if (/^\d{4}$/.test(yr)) years.add(yr);
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [history]);

  const { results, kpi } = useMemo(() => {
    return DataService.filterAndSortHistory({
      history,
      searchQuery,
      sortOrder,
      yearFilter,
      monthFilter,
      paymentStatusFilter
    });
  }, [history, searchQuery, sortOrder, yearFilter, monthFilter, paymentStatusFilter]);

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);

    const staffName = DataService.getCurrentUser()?.name || "Staff";
    const res = await DataService.deleteLoadSlip(target.id, staffName);
    if (res.success) {
      setHistory(prev => prev.filter(s => s.id !== target.id));
      if (selectedSlip?.id === target.id) setSelectedSlip(null);
      setFeedback({
        type: "success",
        text: `Load Slip ${target.slipNumber || target.id} moved to Trash.`
      });
    } else {
      setFeedback({ type: "error", text: res.message });
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Slip No",
      "Date",
      "Time",
      "Truck",
      "Driver",
      "In-Charge",
      "Status",
      "Loaded Sacks",
      "Delivered Sacks",
      "Returned Sacks",
      "Cash Revenue",
      "Charge Revenue",
      "Total Revenue"
    ];
    const rows = results.map(s => [
      `"${s.slipNumber || s.id}"`,
      `"${s.date}"`,
      `"${s.time}"`,
      `"${s.truckPlate || s.truckId}"`,
      `"${(s.driverName || "").replace(/"/g, '""')}"`,
      `"${(s.inChargeName || "").replace(/"/g, '""')}"`,
      `"${s.status}"`,
      s.totalLoadedSacks,
      s.totalDeliveredSacks,
      s.totalReturnedSacks,
      s.totalCashRevenue.toFixed(2),
      s.totalChargeRevenue.toFixed(2),
      s.totalRevenue.toFixed(2)
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `JICA_LoadSlips_${getManilaDateString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusChip = (status: string) => {
    const upper = String(status || "").toUpperCase();
    if (["REMITTED", "COMPLETED", "RECONCILED"].includes(upper)) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          Remitted
        </span>
      );
    }
    if (["DELIVERY_FINISHED", "AWAITING_REMIT", "COMPLETED / PENDING REMITTANCE"].includes(upper)) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
          Awaiting Remit
        </span>
      );
    }
    if (["IN_TRANSIT", "IN-TRANSIT"].includes(upper)) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          In Transit
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
        Dispatched
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs">
          <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
            Filtered Slips
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {kpi.totalSlips}
          </div>
          <div className="text-[11px] text-slate-400">Loaded: {kpi.totalSacksLoaded} sacks</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs">
          <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
            Delivered / Returned
          </span>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
            {kpi.totalSacksDelivered} /{" "}
            <span className="text-amber-600 dark:text-amber-400">{kpi.totalSacksReturned}</span>
          </div>
          <div className="text-[11px] text-slate-400">Total sacks delivered vs returned</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs">
          <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
            Cash Revenue
          </span>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
            PHP {formatPhp(kpi.totalCash)}
          </div>
          <div className="text-[11px] text-slate-400">
            Charge: PHP {formatPhp(kpi.totalCharge)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs">
          <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
            Total Gross Value
          </span>
          <div className="text-2xl font-black text-[#004D40] dark:text-emerald-300 mt-1">
            PHP {formatPhp(kpi.totalRevenue)}
          </div>
          <div className="text-[11px] text-slate-400">Combined Cash + Charge</div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search slip #, truck plate, driver, or customer..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#004D40]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="min-h-[44px] px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">All Years</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="min-h-[44px] px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">All Months</option>
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "latest" | "oldest")}
              className="min-h-[44px] px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              <option value="latest">Latest First</option>
              <option value="oldest">Oldest First</option>
            </select>

            <button
              type="button"
              onClick={() => loadHistory(true)}
              disabled={isRefreshing}
              className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="min-h-[44px] px-3.5 py-2 bg-[#004D40] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["ALL", "Cash", "Charge Invoice", "Partial", "Completed"] as PaymentFilter[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setPaymentStatusFilter(f)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                paymentStatusFilter === f
                  ? "bg-[#004D40] text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              {f === "ALL" ? "All Load Slips" : f === "Completed" ? "Remitted / Closed" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Slips Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading load slip history...
          </div>
        ) : results.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No historical load slips found matching your filter.
          </div>
        ) : (
          <div className="overflow-x-auto scroll-touch">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase font-bold">
                <tr>
                  <th className="px-4 py-3">Slip # & Date</th>
                  <th className="px-4 py-3">Truck & Driver</th>
                  <th className="px-4 py-3">In-Charge</th>
                  <th className="px-4 py-3 text-center">Drops</th>
                  <th className="px-4 py-3 text-center">Plan / Del / Ret</th>
                  <th className="px-4 py-3 text-right">Total Value</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {results.map(slip => (
                  <tr
                    key={slip.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {slip.slipNumber || slip.id}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {slip.date} • {slip.time}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {slip.truckPlate || slip.truckId}
                      </div>
                      <div className="text-[11px] text-slate-400">{slip.driverName}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                      {slip.inChargeName}
                    </td>
                    <td className="px-4 py-3 text-center font-bold">{slip.items.length}</td>
                    <td className="px-4 py-3 text-center font-mono">
                      {slip.totalLoadedSacks} /{" "}
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {slip.totalDeliveredSacks}
                      </strong>{" "}
                      /{" "}
                      <span className="text-amber-600 dark:text-amber-400">
                        {slip.totalReturnedSacks}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white">
                      PHP {formatPhp(slip.totalRevenue)}
                    </td>
                    <td className="px-4 py-3">{getStatusChip(slip.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSlip(slip)}
                          className="min-w-[44px] min-h-[44px] px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="hidden sm:inline">View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(slip)}
                          aria-label={`Delete load slip ${slip.slipNumber || slip.id}`}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                          title="Move to Trash"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slip Detail & Print Modal */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="jica-print-sheet bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-[90dvh] overflow-y-auto">
            <div className="p-5 bg-[#004D40] text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">
                  Digital Load Slip • {selectedSlip.slipNumber || selectedSlip.id}
                </h3>
                <p className="text-xs text-emerald-100">
                  JICA Ice Plants • {selectedSlip.date} {selectedSlip.time} (Asia/Manila)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlip(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 text-white cursor-pointer print:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs text-slate-800 dark:text-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#004D40] dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[11px]">Truck</span>
                    <strong>{selectedSlip.truckPlate || selectedSlip.truckId}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#004D40] dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[11px]">Assigned Driver</span>
                    <strong>{selectedSlip.driverName}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#004D40] dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[11px]">In-Charge</span>
                    <strong>{selectedSlip.inChargeName}</strong>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 font-bold uppercase text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  <span>Dispatched Stops ({selectedSlip.items.length})</span>
                </div>
                <div className="overflow-x-auto scroll-touch">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/40 text-[11px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Store / Customer</th>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2 text-center">Plan / Del / Ret</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedSlip.items.map(it => (
                        <tr key={it.id}>
                          <td className="px-3 py-2.5">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {it.storeName}
                            </div>
                            <div className="text-[11px] text-slate-400">{it.locationName}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            {it.iceType} ({it.sackSize})
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono">
                            {it.plannedQty} / {it.deliveredQty} /{" "}
                            {it.returnedQty ?? Math.max(0, it.plannedQty - it.deliveredQty)}
                          </td>
                          <td className="px-3 py-2.5">{it.paymentType}</td>
                          <td className="px-3 py-2.5 text-right font-bold">
                            PHP {formatPhp(it.totalPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[11px] text-slate-500 block">Cash Revenue</span>
                  <strong className="text-base text-emerald-700 dark:text-emerald-300">
                    PHP {formatPhp(selectedSlip.totalCashRevenue)}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <span className="text-[11px] text-slate-500 block">Charge Invoice</span>
                  <strong className="text-base text-blue-700 dark:text-blue-300">
                    PHP {formatPhp(selectedSlip.totalChargeRevenue)}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500 block">Grand Total</span>
                  <strong className="text-base text-slate-900 dark:text-white">
                    PHP {formatPhp(selectedSlip.totalRevenue)}
                  </strong>
                </div>
              </div>

              {selectedSlip.remittedAt && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
                  <strong>Shift Closed:</strong> {formatManilaDateTime(selectedSlip.remittedAt)}{" "}
                  {selectedSlip.remittedBy ? `by ${selectedSlip.remittedBy}` : ""}
                  {selectedSlip.notes ? ` — "${selectedSlip.notes}"` : ""}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[44px] px-4 py-2.5 bg-[#004D40] hover:bg-emerald-900 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSlip(null)}
                  className="min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(confirmDelete)}
        title="Move Load Slip to Trash?"
        message={`Move ${confirmDelete?.slipNumber || confirmDelete?.id} to the 30-day Trash Archive?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

export default LoadSlipHistory;
