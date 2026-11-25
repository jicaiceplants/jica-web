"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { DataService } from "@/lib/dataService";
import { supabase } from "@/lib/supabaseClient";
import { InvoiceRecord } from "@/lib/types";
import { formatPhp } from "@/lib/currencyUtils";
import { formatManilaDateTime, getCurrentManilaYear, getManilaDateString } from "@/lib/dateUtils";
import ConfirmModal from "@/components/ConfirmModal";
import {
  FileText,
  Search,
  Printer,
  CheckCircle2,
  Clock,
  Banknote,
  AlertCircle,
  RefreshCw,
  Trash2,
  Download,
  X,
  Truck,
  User,
  UserCheck
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

type StatusFilterType =
  | "ALL"
  | "Pending Delivery"
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
      const yr = (inv.date || "").split("-")[0];
      if (/^\d{4}$/.test(yr)) yearSet.add(yr);
    });
    return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
  }, [invoices]);

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

  const handleExportCSV = () => {
    const headers = [
      "Invoice No",
      "Load Slip No",
      "Date",
      "Customer",
      "Hub",
      "Truck Plate",
      "Driver",
      "In-Charge",
      "Product",
      "Sack Size",
      "Planned",
      "Delivered",
      "Returned",
      "Unit Price",
      "Total Amount",
      "Payment Type",
      "Status",
      "Settled By"
    ];
    const rows = results.map(r => [
      `"${r.invoiceNumber}"`,
      `"${r.slipNumber || r.loadSlipId}"`,
      `"${r.date}"`,
      `"${(r.customerName || "").replace(/"/g, '""')}"`,
      `"${(r.locationName || "").replace(/"/g, '""')}"`,
      `"${r.truckPlate || r.truckId || ""}"`,
      `"${(r.driverName || "").replace(/"/g, '""')}"`,
      `"${(r.inChargeName || "").replace(/"/g, '""')}"`,
      `"${(r.iceType || "").replace(/"/g, '""')}"`,
      `"${r.sackSize || ""}"`,
      r.plannedQty ?? r.deliveredQty,
      r.deliveredQty,
      r.returnedQty ?? Math.max(0, (r.plannedQty ?? r.deliveredQty) - r.deliveredQty),
      r.unitPrice.toFixed(2),
      r.totalAmount.toFixed(2),
      `"${r.paymentType}"`,
      `"${r.status}"`,
      `"${r.settledBy || ""}"`
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `JICA_Invoices_${getManilaDateString()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Unpaid Charge
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            Pending Delivery
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
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
            <span>In-Transit / Pending Drop</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1.5">
            PHP {formatPhp(kpi.totalPendingDelivery)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {kpi.countPending} pre-dispatched receipt{kpi.countPending === 1 ? "" : "s"}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
            <span>Total Billed Gross</span>
            <FileText className="w-4 h-4 text-[#004D40] dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1.5">
            PHP {formatPhp(kpi.totalOverall)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Across {invoices.length} official record{invoices.length === 1 ? "" : "s"}
          </div>
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
              onClick={handleExportCSV}
              className="min-h-[44px] px-3.5 py-2 bg-[#004D40] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["ALL", "Pending Delivery", "Unpaid Charge", "Settled Charge", "Cash Paid"] as StatusFilterType[]).map(
            tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === tab
                    ? "bg-[#004D40] text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {tab === "ALL" ? "All Receipts" : tab}
              </button>
            )
          )}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading official receipts and invoices...
          </div>
        ) : results.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No matching invoices found. Dispatch a Load Slip to auto-generate receipts.
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
                        {inv.iceType} ({inv.sackSize})
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
                          {selectedReceipt.iceType}
                        </div>
                        <div className="text-[11px] text-slate-400">{selectedReceipt.sackSize}</div>
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
