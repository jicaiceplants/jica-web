"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { DataService } from "@/lib/dataService";
import { supabase } from "@/lib/supabaseClient";
import { InvoiceRecord } from "@/lib/types";
import { formatPhp, sumCurrency } from "@/lib/currencyUtils";
import { formatManilaDateTime, getCurrentManilaYear, getManilaDateString } from "@/lib/dateUtils";
import { formatProductLabel } from "@/lib/productUtils";
import ConfirmModal from "@/components/ConfirmModal";
import {
  FileText,
  Search,
  Printer,
  CheckCircle2,
  Banknote,
  AlertCircle,
  RefreshCw,
  Trash2,
  Download,
  X,
  Truck,
  User,
  UserCheck,
  Calendar
} from "lucide-react";

const MONTHS = [
  { value: "01", label: "January", short: "Jan" },
  { value: "02", label: "February", short: "Feb" },
  { value: "03", label: "March", short: "Mar" },
  { value: "04", label: "April", short: "Apr" },
  { value: "05", label: "May", short: "May" },
  { value: "06", label: "June", short: "Jun" },
  { value: "07", label: "July", short: "Jul" },
  { value: "08", label: "August", short: "Aug" },
  { value: "09", label: "September", short: "Sep" },
  { value: "10", label: "October", short: "Oct" },
  { value: "11", label: "November", short: "Nov" },
  { value: "12", label: "December", short: "Dec" }
];

type ExportPeriodMode = "today" | "week" | "month" | "year";

interface MonthWeekSlice {
  weekNumber: number;
  startDay: number;
  endDay: number;
  startDateStr: string;
  endDateStr: string;
  label: string;
}

function getDaysInCalendarMonth(yearNum: number, monthNum: number): number {
  return new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();
}

function getMonthWeekSlices(yearStr: string, monthStr: string): MonthWeekSlice[] {
  const yr = parseInt(yearStr, 10) || parseInt(getCurrentManilaYear(), 10);
  const mo = Math.min(12, Math.max(1, parseInt(monthStr, 10) || 1));
  const paddedMo = String(mo).padStart(2, "0");
  const totalDays = getDaysInCalendarMonth(yr, mo);
  const monthShort = MONTHS[mo - 1]?.short || paddedMo;
  const slices: MonthWeekSlice[] = [];

  for (let start = 1, weekIdx = 1; start <= totalDays; start += 7, weekIdx += 1) {
    const end = Math.min(start + 6, totalDays);
    slices.push({
      weekNumber: weekIdx,
      startDay: start,
      endDay: end,
      startDateStr: `${yr}-${paddedMo}-${String(start).padStart(2, "0")}`,
      endDateStr: `${yr}-${paddedMo}-${String(end).padStart(2, "0")}`,
      label: `Week ${weekIdx} (${monthShort} ${start} – ${monthShort} ${end}, ${yr})`
    });
  }
  return slices;
}

function escapeCsvField(value: string | number | undefined | null): string {
  const str = String(value ?? "");
  return `"${str.replace(/"/g, '""')}"`;
}

type StatusFilterType =
  | "ALL"
  | "Cash Paid"
  | "Unpaid Charge"
  | "Settled Charge";

export function Invoices() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("ALL");
  const [selectedReceipt, setSelectedReceipt] = useState<InvoiceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    action: "settle" | "delete" | null;
    invoice: InvoiceRecord | null;
  }>({ isOpen: false, action: null, invoice: null });

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPeriodMode, setExportPeriodMode] = useState<ExportPeriodMode>("today");
  const [exportYear, setExportYear] = useState<string>(() => getCurrentManilaYear());
  const [exportMonth, setExportMonth] = useState<string>(() => getManilaDateString().split("-")[1] || "01");
  const [exportWeek, setExportWeek] = useState<number>(() => {
    const day = parseInt(getManilaDateString().split("-")[2] || "1", 10) || 1;
    return Math.min(5, Math.ceil(day / 7));
  });

  const loadInvoices = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const live = await DataService.fetchInvoicesLive();
      setInvoices(live);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const cached = DataService.getInvoices();
    if (cached.length > 0) {
      setInvoices(cached);
    }
    loadInvoices(false);

    const channel = supabase
      .channel("invoices-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
        loadInvoices(false);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "load_slips" }, () => {
        loadInvoices(false);
      })
      .subscribe();

    const poll = setInterval(() => loadInvoices(false), 10000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [loadInvoices]);

  const availableYears = useMemo(() => {
    const yearSet = new Set<string>([getCurrentManilaYear()]);
    invoices.forEach(inv => {
      const yr = getManilaDateString(inv.date || inv.issuedAt).split("-")[0];
      if (/^\d{4}$/.test(yr)) yearSet.add(yr);
    });
    return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
  }, [invoices]);

  const exportYearOptions = useMemo(() => {
    const currentYrNum = parseInt(getCurrentManilaYear(), 10) || 2026;
    const yearSet = new Set<string>([String(currentYrNum), String(currentYrNum - 1), ...availableYears]);
    return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
  }, [availableYears]);

  const { results, kpi } = useMemo(() => {
    return DataService.filterAndSortInvoices({
      invoices,
      searchQuery,
      sortOrder,
      yearFilter,
      monthFilter,
      statusFilter
    });
  }, [invoices, searchQuery, sortOrder, yearFilter, monthFilter, statusFilter]);

  const openExportModal = () => {
    const todayManila = getManilaDateString();
    const [yr, mo, dy] = todayManila.split("-");
    const dayNum = parseInt(dy || "1", 10) || 1;
    setExportYear(yr || getCurrentManilaYear());
    setExportMonth(mo || "01");
    setExportWeek(Math.min(5, Math.ceil(dayNum / 7)));
    setShowExportModal(true);
  };

  const exportMonthWeeks = useMemo(
    () => getMonthWeekSlices(exportYear, exportMonth),
    [exportYear, exportMonth]
  );

  const clampedExportWeek = Math.min(exportWeek, exportMonthWeeks.length || 1);
  const activeExportWeek =
    exportMonthWeeks.find(w => w.weekNumber === clampedExportWeek) || exportMonthWeeks[0];

  const {
    matchingExportInvoices,
    exportPeriodLabel,
    exportFileName,
    exportTotalAmount
  } = useMemo(() => {
    const todayManila = getManilaDateString();
    const monthMeta = MONTHS.find(m => m.value === exportMonth) || MONTHS[0];

    const matched = invoices.filter(inv => {
      const invDate = getManilaDateString(inv.date || inv.issuedAt);
      if (exportPeriodMode === "today") {
        return invDate === todayManila;
      }
      if (exportPeriodMode === "week" && activeExportWeek) {
        return invDate >= activeExportWeek.startDateStr && invDate <= activeExportWeek.endDateStr;
      }
      if (exportPeriodMode === "month") {
        return invDate.startsWith(`${exportYear}-${exportMonth}-`);
      }
      return invDate.startsWith(`${exportYear}-`);
    });

    const sortedMatched = [...matched].sort((a, b) => {
      const timeA = new Date(a.issuedAt || a.date || 0).getTime();
      const timeB = new Date(b.issuedAt || b.date || 0).getTime();
      return timeB - timeA;
    });

    let label = "";
    let filename = "";
    if (exportPeriodMode === "today") {
      const [y, m, d] = todayManila.split("-");
      const todayMonthShort = MONTHS[(parseInt(m, 10) || 1) - 1]?.short || m;
      label = `Today (${todayMonthShort} ${parseInt(d, 10) || d}, ${y}, Asia/Manila)`;
      filename = `JICA_Receipts_Today_${todayManila}.csv`;
    } else if (exportPeriodMode === "week" && activeExportWeek) {
      label = activeExportWeek.label;
      filename = `JICA_Receipts_${exportYear}-${exportMonth}_Week${activeExportWeek.weekNumber}.csv`;
    } else if (exportPeriodMode === "month") {
      label = `${monthMeta.label} ${exportYear}`;
      filename = `JICA_Receipts_${exportYear}-${exportMonth}.csv`;
    } else {
      label = `Year ${exportYear}`;
      filename = `JICA_Receipts_${exportYear}.csv`;
    }

    return {
      matchingExportInvoices: sortedMatched,
      exportPeriodLabel: label,
      exportFileName: filename,
      exportTotalAmount: sumCurrency(sortedMatched.map(r => r.totalAmount || 0))
    };
  }, [invoices, exportPeriodMode, exportYear, exportMonth, activeExportWeek]);

  const handleConfirmAction = async () => {
    const target = confirmState.invoice;
    const action = confirmState.action;
    setConfirmState({ isOpen: false, action: null, invoice: null });
    if (!target || !action) return;

    const currentUserName = DataService.getCurrentUser()?.name || "Staff";

    if (action === "settle") {
      const res = await DataService.settleChargeInvoice(target.id, currentUserName);
      if (res.success) {
        setFeedback({ type: "success", text: res.message });
        const fresh = await DataService.fetchInvoicesLive();
        setInvoices(fresh);
        if (selectedReceipt?.id === target.id) {
          const updated = fresh.find(f => f.id === target.id) || null;
          setSelectedReceipt(updated);
        }
      } else {
        setFeedback({ type: "error", text: res.message });
      }
    } else if (action === "delete") {
      const res = await DataService.deleteInvoice(target.id, currentUserName);
      if (res.success) {
        setFeedback({ type: "success", text: `Invoice ${target.invoiceNumber} moved to Trash.` });
        setInvoices(prev => prev.filter(i => i.id !== target.id));
        if (selectedReceipt?.id === target.id) setSelectedReceipt(null);
      } else {
        setFeedback({ type: "error", text: res.message });
      }
    }
  };

  const handleDownloadPeriodCSV = () => {
    if (matchingExportInvoices.length === 0) return;

    const headers = [
      "Invoice No",
      "Load Slip No",
      "Date (Asia/Manila)",
      "Customer",
      "Hub",
      "Truck Plate",
      "Driver",
      "In-Charge",
      "Product",
      "Sack Size",
      "Planned Sacks",
      "Delivered Sacks",
      "Returned Sacks",
      "Unit Price (₱)",
      "Total Amount (₱)",
      "Payment Type",
      "Status",
      "Settled By"
    ];
    const rows = matchingExportInvoices.map(r => [
      escapeCsvField(r.invoiceNumber),
      escapeCsvField(r.slipNumber || r.loadSlipId),
      escapeCsvField(getManilaDateString(r.date || r.issuedAt)),
      escapeCsvField(r.customerName),
      escapeCsvField(r.locationName),
      escapeCsvField(r.truckPlate || r.truckId || ""),
      escapeCsvField(r.driverName),
      escapeCsvField(r.inChargeName),
      escapeCsvField(r.iceType),
      escapeCsvField(r.sackSize),
      r.plannedQty ?? r.deliveredQty,
      r.deliveredQty,
      r.returnedQty ?? Math.max(0, (r.plannedQty ?? r.deliveredQty) - r.deliveredQty),
      r.unitPrice.toFixed(2),
      r.totalAmount.toFixed(2),
      escapeCsvField(r.paymentType),
      escapeCsvField(r.status),
      escapeCsvField(r.settledBy || "")
    ]);

    const csv = [headers.map(h => escapeCsvField(h)).join(","), ...rows.map(r => r.join(","))].join("\n");
    // Prepend UTF-8 BOM (\uFEFF) so Excel opens ₱ currency symbols accurately
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportModal(false);
    setFeedback({
      type: "success",
      text: `Downloaded ${matchingExportInvoices.length} approved receipt${matchingExportInvoices.length === 1 ? "" : "s"} (${exportFileName}).`
    });
  };

  const renderStatusBadge = (status: InvoiceRecord["status"]) => {
    switch (status) {
      case "Cash Paid":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            Cash Paid
          </span>
        );
      case "Settled Charge":
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
            Settled Charge
          </span>
        );
      case "Unpaid Charge":
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Unpaid Charge
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards (Approved & Remitted Receipts Only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
            <span>Cash + Settled Collections</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1.5">
            PHP {formatPhp(kpi.totalCashCollected)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {kpi.countCash} Cash + {kpi.countSettled} Settled
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
            <span>Unpaid Charge Invoices</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1.5">
            PHP {formatPhp(kpi.totalUnpaidCharge)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {kpi.countUnpaid} invoice{kpi.countUnpaid === 1 ? "" : "s"} awaiting collection
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
            <span>Settled Charge Invoices</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-teal-700 dark:text-teal-400 mt-1.5">
            PHP {formatPhp(kpi.totalSettledCharge)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {kpi.countSettled} settled charge receipt{kpi.countSettled === 1 ? "" : "s"}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
            <span>Approved Billed Gross</span>
            <FileText className="w-4 h-4 text-[#004D40] dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5">
            PHP {formatPhp(kpi.totalOverall)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Across {invoices.length} remitted receipt{invoices.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${feedback.type === "success"
            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
            : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
            }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Invoice #, Slip #, customer, hub, or driver..."
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
              onClick={() => loadInvoices(true)}
              disabled={isRefreshing}
              className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Sync</span>
            </button>

            <button
              type="button"
              onClick={openExportModal}
              className="min-h-[44px] px-3.5 py-2 bg-[#004D40] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["ALL", "Cash Paid", "Unpaid Charge", "Settled Charge"] as StatusFilterType[]).map(
            tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${statusFilter === tab
                  ? "bg-[#004D40] text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
              >
                {tab === "ALL" ? "All Approved Receipts" : tab}
              </button>
            )
          )}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading approved official receipts and invoices...
          </div>
        ) : results.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No approved receipts found. Complete delivery and approve remittance in Shift Closing to publish receipts here.
          </div>
        ) : (
          <div className="overflow-x-auto scroll-touch">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase font-bold">
                <tr>
                  <th className="px-4 py-3">Invoice / Slip #</th>
                  <th className="px-4 py-3">Customer / Hub</th>
                  <th className="px-4 py-3">Truck & Driver</th>
                  <th className="px-4 py-3">Product & Sacks</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {results.map(inv => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {inv.invoiceNumber}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {inv.slipNumber || inv.loadSlipId}
                      </div>
                      <div className="text-[11px] text-slate-400">{inv.date}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {inv.customerName}
                      </div>
                      <div className="text-[11px] text-slate-400">{inv.locationName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-700 dark:text-slate-200">
                        {inv.truckPlate || inv.truckId || "Unassigned"}
                      </div>
                      <div className="text-[11px] text-slate-400">{inv.driverName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {formatProductLabel(inv.iceType, inv.sackSize)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Del: <strong>{inv.deliveredQty}</strong> / Plan:{" "}
                        {inv.plannedQty ?? inv.deliveredQty} @ PHP {formatPhp(inv.unitPrice)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-white">
                      PHP {formatPhp(inv.totalAmount)}
                    </td>
                    <td className="px-4 py-3">{renderStatusBadge(inv.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(inv)}
                          className="min-w-[44px] min-h-[44px] px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                          title="View & Print Receipt"
                        >
                          <Printer className="w-4 h-4" />
                          <span className="hidden sm:inline">Receipt</span>
                        </button>

                        {inv.status === "Unpaid Charge" && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmState({ isOpen: true, action: "settle", invoice: inv })
                            }
                            className="min-h-[44px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Settle</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setConfirmState({ isOpen: true, action: "delete", invoice: inv })
                          }
                          aria-label={`Delete invoice ${inv.invoiceNumber}`}
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

      {/* Printable Official Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="jica-print-sheet bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-[90dvh] overflow-y-auto">
            <div className="p-5 bg-[#004D40] text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight">JICA ICE PLANTS & COLD STORAGE</h3>
                <p className="text-xs text-emerald-100">
                  Cagayan de Oro City • Official Sales Delivery Receipt
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 text-white cursor-pointer print:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs text-slate-800 dark:text-slate-200">
              <div className="flex flex-wrap justify-between gap-3 pb-4 border-b border-dashed border-slate-300 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 block uppercase font-bold">Receipt / Invoice No.</span>
                  <strong className="text-base font-mono text-slate-900 dark:text-white">
                    {selectedReceipt.invoiceNumber}
                  </strong>
                  <span className="block text-slate-500 mt-0.5 font-mono">
                    Slip: {selectedReceipt.slipNumber || selectedReceipt.loadSlipId}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block uppercase font-bold">Date Issued</span>
                  <strong className="font-bold">
                    {formatManilaDateTime(selectedReceipt.issuedAt || selectedReceipt.date)}
                  </strong>
                  <div className="mt-1">{renderStatusBadge(selectedReceipt.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 block text-[11px] uppercase font-bold">
                    Billed Customer / Drop
                  </span>
                  <strong className="text-sm text-slate-900 dark:text-white">
                    {selectedReceipt.customerName}
                  </strong>
                  <span className="block text-slate-500">{selectedReceipt.locationName}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#004D40] dark:text-emerald-400" />
                    <span>Truck: <strong>{selectedReceipt.truckPlate || selectedReceipt.truckId}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#004D40] dark:text-emerald-400" />
                    <span>Driver: <strong>{selectedReceipt.driverName}</strong></span>
                  </div>
                  {selectedReceipt.inChargeName && (
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-[#004D40] dark:text-emerald-400" />
                      <span>In-Charge: <strong>{selectedReceipt.inChargeName}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Ice Product</th>
                      <th className="px-3 py-2 text-center">Plan / Del / Ret</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-200 dark:border-slate-700">
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {formatProductLabel(selectedReceipt.iceType, selectedReceipt.sackSize)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center font-mono">
                        {selectedReceipt.plannedQty ?? selectedReceipt.deliveredQty} /{" "}
                        <strong>{selectedReceipt.deliveredQty}</strong> /{" "}
                        {selectedReceipt.returnedQty ??
                          Math.max(
                            0,
                            (selectedReceipt.plannedQty ?? selectedReceipt.deliveredQty) -
                            selectedReceipt.deliveredQty
                          )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">
                        PHP {formatPhp(selectedReceipt.unitPrice)}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-slate-900 dark:text-white">
                        PHP {formatPhp(selectedReceipt.totalAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-dashed border-slate-300 dark:border-slate-700">
                <span className="font-bold text-slate-500 uppercase">
                  Payment Method: {selectedReceipt.paymentType}
                </span>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block uppercase">Total Amount</span>
                  <strong className="text-2xl font-black text-[#004D40] dark:text-emerald-400">
                    PHP {formatPhp(selectedReceipt.totalAmount)}
                  </strong>
                </div>
              </div>

              {selectedReceipt.status === "Settled Charge" && selectedReceipt.settledAt && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200">
                  <strong>Paid & Settled:</strong> {formatManilaDateTime(selectedReceipt.settledAt)} by{" "}
                  {selectedReceipt.settledBy || "Staff"}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2.5 pt-2 print:hidden">
                {selectedReceipt.status === "Unpaid Charge" && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmState({
                        isOpen: true,
                        action: "settle",
                        invoice: selectedReceipt
                      })
                    }
                    className="min-h-[44px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark Charge Paid</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[44px] px-4 py-2.5 bg-[#004D40] hover:bg-emerald-900 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flexible Manila Period Export CSV Modal (PC, Laptop & iPad Safari Safe) */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-[90dvh] overflow-y-auto">
            <div className="p-5 bg-[#004D40] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-emerald-200 shrink-0" />
                <div>
                  <h3 className="text-base font-black tracking-tight">Export Official Receipts (CSV)</h3>
                  <p className="text-[11px] text-emerald-100">
                    Approved &amp; remitted receipts filtered in Asia/Manila (UTC+8)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                aria-label="Close Export Modal"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Period Mode Selector Tabs */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Select Reporting Period
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: "today", label: "Today" },
                      { id: "week", label: "Week" },
                      { id: "month", label: "Month" },
                      { id: "year", label: "Year" }
                    ] as { id: ExportPeriodMode; label: string }[]
                  ).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setExportPeriodMode(opt.id)}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        exportPeriodMode === opt.id
                          ? "bg-[#004D40] text-white shadow-sm"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditional Period Selectors (Touch-Friendly Dropdowns — No input[type=week]) */}
              {exportPeriodMode === "today" && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                  Exports all approved receipts dated <strong className="text-slate-900 dark:text-white">{getManilaDateString()}</strong> in Asia/Manila time.
                </div>
              )}

              {(exportPeriodMode === "week" || exportPeriodMode === "month" || exportPeriodMode === "year") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                      Year
                    </label>
                    <select
                      value={exportYear}
                      onChange={(e) => setExportYear(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-xs font-bold text-slate-800 dark:text-white"
                    >
                      {exportYearOptions.map(yr => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(exportPeriodMode === "week" || exportPeriodMode === "month") && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                        Month
                      </label>
                      <select
                        value={exportMonth}
                        onChange={(e) => setExportMonth(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-xs font-bold text-slate-800 dark:text-white"
                      >
                        {MONTHS.map(m => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {exportPeriodMode === "week" && (
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                        Week Range
                      </label>
                      <select
                        value={clampedExportWeek}
                        onChange={(e) => setExportWeek(Number(e.target.value))}
                        className="w-full min-h-[44px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-xs font-bold text-slate-800 dark:text-white"
                      >
                        {exportMonthWeeks.map(w => (
                          <option key={w.weekNumber} value={w.weekNumber}>
                            {w.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Live Match Count & Total Preview */}
              <div
                className={`p-4 rounded-xl border ${
                  matchingExportInvoices.length > 0
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                    : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                }`}
              >
                <div className="text-xs font-black text-slate-900 dark:text-white">
                  {matchingExportInvoices.length > 0
                    ? `${matchingExportInvoices.length} approved receipt${matchingExportInvoices.length === 1 ? "" : "s"} found for ${exportPeriodLabel}`
                    : `No approved receipts found for ${exportPeriodLabel}`}
                </div>
                {matchingExportInvoices.length > 0 ? (
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1 flex flex-wrap items-center justify-between gap-2">
                    <span>Total Amount: <strong>PHP {formatPhp(exportTotalAmount)}</strong></span>
                    <span className="font-mono text-[10px] opacity-80">{exportFileName}</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                    Select another period with remitted deliveries to enable CSV download.
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPeriodCSV}
                  disabled={matchingExportInvoices.length === 0}
                  className="min-h-[44px] px-5 py-2.5 bg-[#004D40] hover:bg-emerald-900 disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400 text-white text-xs font-black rounded-xl flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.action === "settle" ? "Confirm Charge Payment" : "Move Invoice to Trash?"}
        message={
          confirmState.action === "settle"
            ? `Mark ${confirmState.invoice?.invoiceNumber} (PHP ${formatPhp(
              confirmState.invoice?.totalAmount || 0
            )}) for ${confirmState.invoice?.customerName} as PAID / SETTLED?`
            : `Move ${confirmState.invoice?.invoiceNumber} to the 30-day Trash Archive?`
        }
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmState({ isOpen: false, action: null, invoice: null })}
      />
    </div>
  );
}

export default Invoices;
