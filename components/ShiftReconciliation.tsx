"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataService } from "@/lib/dataService";
import { supabase } from "@/lib/supabaseClient";
import { formatPhp, sumCurrency } from "@/lib/currencyUtils";
import { formatManilaDateTime } from "@/lib/dateUtils";
import { formatProductLabel } from "@/lib/productUtils";
import { LoadSlip } from "@/lib/types";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  FileText,
  Truck,
  Package,
  RefreshCw,
  Clock,
  UserCheck,
  MapPin
} from "lucide-react";

export function ShiftReconciliation() {
  const [pendingSlips, setPendingSlips] = useState<LoadSlip[]>([]);
  const [inTransitCount, setInTransitCount] = useState(0);
  const [selectedSlipId, setSelectedSlipId] = useState<string>("");
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadPending = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const { slips, inTransitCount: activeCount } = await DataService.fetchPendingShiftClosings();
      setPendingSlips(slips);
      setInTransitCount(activeCount);
      setSelectedSlipId(prev => {
        if (slips.length === 0) return "";
        if (prev && slips.some(s => s.id === prev)) return prev;
        return slips[0].id;
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPending(false);

    const channel = supabase
      .channel("shift-closing-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "load_slips" },
        () => {
          loadPending(false);
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      loadPending(false);
    }, 5000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [loadPending]);

  const selectedSlip =
    pendingSlips.find(s => s.id === selectedSlipId) || pendingSlips[0] || null;

  const handleConfirmRemit = async () => {
    if (!selectedSlip || isSubmitting) return;
    setIsSubmitting(true);
    setFeedbackBanner(null);

    const slipLabel = selectedSlip.slipNumber || selectedSlip.id;
    const remitNotes = notesMap[selectedSlip.id] || "";
    const res = await DataService.confirmShiftRemit(selectedSlip.id, remitNotes);

    if (res.success) {
      setPendingSlips(prev => {
        const remaining = prev.filter(s => s.id !== selectedSlip.id);
        setSelectedSlipId(remaining[0]?.id || "");
        return remaining;
      });
      setNotesMap(prev => {
        const copy = { ...prev };
        delete copy[selectedSlip.id];
        return copy;
      });
      setFeedbackBanner({
        type: "success",
        text: `Shift ${slipLabel} remitted & closed. Cash safe total PHP ${formatPhp(selectedSlip.totalCashRevenue)} verified.`
      });
      await loadPending(false);
    } else {
      setFeedbackBanner({
        type: "error",
        text: res.message || "Unable to confirm shift closing."
      });
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Loading finished deliveries awaiting remittance...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Control Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Awaiting End-of-Shift Remittance ({pendingSlips.length})</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Only trips where the driver has completed delivery appear here for cash safe & sack audit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {inTransitCount > 0 && (
            <span className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-1.5">
              <Clock className="w-4 h-4 shrink-0" />
              {inTransitCount} truck trip{inTransitCount === 1 ? "" : "s"} currently out on delivery
            </span>
          )}
          <button
            type="button"
            onClick={() => loadPending(true)}
            disabled={isRefreshing}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 text-xs font-bold ${feedbackBanner.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
            }`}
        >
          {feedbackBanner.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          )}
          <span>{feedbackBanner.text}</span>
        </div>
      )}

      {pendingSlips.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <ClipboardCheck className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            No Pending Remittances
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {inTransitCount > 0
              ? `${inTransitCount} truck${inTransitCount === 1 ? "" : "s"} currently out on delivery. Once a driver finishes delivery in the mobile app, their shift closing form will appear here automatically.`
              : "All finished delivery shifts have been audited and closed. Dispatch a truck in Digital Load Slip Builder to start a new trip."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Driver / Trip Selector Column */}
          <div className="lg:col-span-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
              Finished Shifts Ready to Remit
            </div>
            {pendingSlips.map(slip => {
              const active = selectedSlip?.id === slip.id;
              return (
                <button
                  key={slip.id}
                  type="button"
                  onClick={() => setSelectedSlipId(slip.id)}
                  className={`w-full min-h-[76px] text-left p-4 rounded-2xl border transition-all cursor-pointer ${active
                      ? "bg-[#004D40] text-white border-[#004D40] shadow-md"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-[#004D40]/50 text-slate-900 dark:text-white"
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-black">
                      {slip.slipNumber || slip.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${active
                          ? "bg-emerald-400/20 text-emerald-100"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                        }`}
                    >
                      Awaiting Remit
                    </span>
                  </div>
                  <div className="font-bold text-sm mt-1 truncate">
                    {slip.driverName || "Assigned Driver Pending"}
                  </div>
                  <div
                    className={`text-xs mt-1 flex items-center justify-between ${active ? "text-emerald-100" : "text-slate-500 dark:text-slate-400"
                      }`}
                  >
                    <span>
                      {slip.truckId} {slip.truckPlate ? `(${slip.truckPlate})` : ""}
                    </span>
                    <span className="font-black">PHP {formatPhp(slip.totalCashRevenue)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Shift Audit Sheet */}
          {selectedSlip && (
            <div className="lg:col-span-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[11px] font-black uppercase rounded-lg">
                      Ready for Remittance
                    </span>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {selectedSlip.slipNumber || selectedSlip.id}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                    {selectedSlip.truckId}{" "}
                    {selectedSlip.truckPlate ? `• ${selectedSlip.truckPlate}` : ""}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-[#004D40] dark:text-emerald-400" />
                      Driver: <strong className="text-slate-700 dark:text-slate-200">{selectedSlip.driverName}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-[#004D40] dark:text-emerald-400" />
                      Dispatched by: <strong className="text-slate-700 dark:text-slate-200">{selectedSlip.inChargeName}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#004D40] dark:text-emerald-400" />
                      Finished: <strong>{formatManilaDateTime(selectedSlip.deliveryFinishedAt || selectedSlip.updatedAt)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-6">
                {/* KPI Audit Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 block">
                      Loaded Sacks
                    </span>
                    <span className="text-xl font-black text-slate-900 dark:text-white">
                      {selectedSlip.totalLoadedSacks}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">
                      Delivered Sacks
                    </span>
                    <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                      {selectedSlip.totalDeliveredSacks}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <span className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-400 block">
                      Returned Sacks
                    </span>
                    <span className="text-xl font-black text-amber-700 dark:text-amber-300">
                      {selectedSlip.totalReturnedSacks}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#004D40]/10 dark:bg-emerald-950/40 border border-[#004D40]/30 dark:border-emerald-800">
                    <span className="text-[11px] font-bold uppercase text-[#004D40] dark:text-emerald-300 block">
                      Cash to Remit
                    </span>
                    <span className="text-xl font-black text-[#004D40] dark:text-emerald-300">
                      PHP {formatPhp(selectedSlip.totalCashRevenue)}
                    </span>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Banknote className="w-5 h-5 text-emerald-600" />
                      <div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                          Cash Sales (On Hand)
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Must match cash drawer deposit
                        </span>
                      </div>
                    </div>
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
                      PHP {formatPhp(selectedSlip.totalCashRevenue)}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                          Charge Invoices (AR)
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Tracked in Invoices & Receipts
                        </span>
                      </div>
                    </div>
                    <span className="text-base font-black text-blue-700 dark:text-blue-400">
                      PHP {formatPhp(selectedSlip.totalChargeRevenue)}
                    </span>
                  </div>
                </div>

                {/* Delivery Line Items Table */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-[#004D40] dark:text-emerald-400" />
                      Delivered Drops ({selectedSlip.items.length})
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      Gross Shift Value: PHP{" "}
                      {formatPhp(
                        sumCurrency(selectedSlip.items.map(i => i.totalPrice || 0))
                      )}
                    </span>
                  </div>
                  <div className="overflow-x-auto scroll-touch">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/70 dark:bg-slate-900/20 text-slate-500 dark:text-slate-400 uppercase font-bold">
                        <tr>
                          <th className="px-4 py-2.5">Customer / Store</th>
                          <th className="px-4 py-2.5">Ice Product</th>
                          <th className="px-4 py-2.5 text-center">Plan / Del / Ret</th>
                          <th className="px-4 py-2.5">Payment</th>
                          <th className="px-4 py-2.5 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {selectedSlip.items.map(item => (
                          <tr key={item.id}>
                            <td className="px-4 py-2.5">
                              <div className="font-bold text-slate-900 dark:text-white">
                                {item.storeName}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {item.locationName || "Route Drop"}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="font-medium text-slate-700 dark:text-slate-200">
                                {formatProductLabel(item.iceType, item.sackSize)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center font-mono">
                              {item.plannedQty} /{" "}
                              <strong className="text-emerald-600 dark:text-emerald-400">
                                {item.deliveredQty}
                              </strong>{" "}
                              /{" "}
                              <span className="text-amber-600 dark:text-amber-400">
                                {item.returnedQty ?? Math.max(0, item.plannedQty - item.deliveredQty)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.paymentType === "Cash"
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                  }`}
                              >
                                {item.paymentType}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-white">
                              PHP {formatPhp(item.totalPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Reconciliation Notes & Confirm */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Remittance & Returned Ice Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={notesMap[selectedSlip.id] || ""}
                    onChange={(e) =>
                      setNotesMap(prev => ({ ...prev, [selectedSlip.id]: e.target.value }))
                    }
                    placeholder="E.g., Cash verified complete; 3 returned sacks transferred to cold storage..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#004D40]"
                  />

                  <button
                    type="button"
                    onClick={handleConfirmRemit}
                    disabled={isSubmitting}
                    className="w-full min-h-[48px] py-3 px-6 bg-[#004D40] hover:bg-emerald-900 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>
                      {isSubmitting
                        ? "Confirming Remittance..."
                        : `Confirm Remittance & Close Shift (${selectedSlip.truckId})`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ShiftReconciliation;
