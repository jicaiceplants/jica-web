"use client";

import { useState, useMemo, useEffect } from "react";
import { LoadSlip, LoadSlipItem } from "@/lib/types";
import { DataService } from "@/lib/dataService";
import { 
  History, 
  Search, 
  Download, 
  Eye, 
  Calendar, 
  ArrowUpDown, 
  TrendingUp, 
  Package, 
  RotateCcw, 
  CreditCard,
  FileSpreadsheet,
  X,
  AlertTriangle
} from "lucide-react";

export default function LoadSlipHistory() {
  const [history, setHistory] = useState<LoadSlip[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "Cash" | "Charge Invoice" | "Partial" | "Completed">("ALL");
  const [selectedSlip, setSelectedSlip] = useState<LoadSlip | null>(null);

  // Load history from data service
  useEffect(() => {
    setHistory(DataService.getHistoricalLoadSlips());
  }, []);

  // 400ms Debounce on search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Execute DSA Filter, Sort & KPI aggregation
  const { results, kpi } = useMemo(() => {
    return DataService.filterAndSortHistory({
      history,
      searchQuery: debouncedQuery,
      sortOrder,
      yearFilter,
      monthFilter,
      paymentStatusFilter: paymentFilter
    });
  }, [history, debouncedQuery, sortOrder, yearFilter, monthFilter, paymentFilter]);

  // CSV Export utility
  const handleExportCSV = () => {
    if (results.length === 0) {
      alert("No records to export matching current filters.");
      return;
    }

    const headers = [
      "Load Slip ID",
      "Date",
      "Time",
      "Truck ID",
      "Truck Plate",
      "Driver Name",
      "In-Charge",
      "Status",
      "Loaded Sacks",
      "Delivered Sacks",
      "Returned Sacks",
      "Total Revenue (PHP)",
      "Cash Revenue (PHP)",
      "Charge Revenue (PHP)"
    ];

    const rows = results.map(s => [
      `"${s.id}"`,
      `"${s.date}"`,
      `"${s.time}"`,
      `"${s.truckId}"`,
      `"${s.truckPlate}"`,
      `"${s.driverName}"`,
      `"${s.inChargeName}"`,
      `"${s.status}"`,
      s.totalLoadedSacks,
      s.totalDeliveredSacks,
      s.totalReturnedSacks,
      s.totalRevenue,
      s.totalCashRevenue,
      s.totalChargeRevenue
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `JICA_LoadSlip_History_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Top Banner & Export */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-6 h-6 text-[#00875A]" />
            Load Slip History & Delivery Archive
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Complete historical records of load slips, store deliveries, and partial sack adjustments.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all text-sm"
        >
          <Download className="w-4 h-4" />
          Export Filtered CSV
        </button>
      </div>

      {/* KPI Cards (DSA Aggregated) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Sacks Loaded</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-3xl font-black text-slate-900 dark:text-white">
            {kpi.totalSacksLoaded.toLocaleString()}
          </span>
          <span className="text-xs text-slate-400 mt-1">Across {kpi.totalSlips} load slips</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Sacks Delivered</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {kpi.totalSacksDelivered.toLocaleString()}
          </span>
          <span className="text-xs text-slate-400 mt-1">
            {kpi.totalSacksLoaded > 0 ? `${((kpi.totalSacksDelivered / kpi.totalSacksLoaded) * 100).toFixed(1)}% fulfillment` : "0%"}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
          <div className="flex items-center justify-between text-amber-600 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Returned / Unsold</span>
            <RotateCcw className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-3xl font-black text-amber-600 dark:text-amber-400">
            {kpi.totalSacksReturned.toLocaleString()}
          </span>
          <span className="text-xs text-slate-400 mt-1">Safely reconciled to depot</span>
        </div>

        <div className="bg-gradient-to-br from-yellow-400 to-amber-500 p-5 rounded-2xl shadow-md flex flex-col text-yellow-950">
          <div className="flex items-center justify-between text-yellow-900 text-xs font-black uppercase tracking-wider mb-2">
            <span>Total Revenue</span>
            <CreditCard className="w-4 h-4 text-yellow-950" />
          </div>
          <span className="text-3xl font-black tracking-tight">
            ₱ {kpi.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="flex justify-between text-xs font-bold mt-1 text-yellow-900/90">
            <span>Cash: ₱{kpi.totalCash.toLocaleString()}</span>
            <span>Charge: ₱{kpi.totalCharge.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* DSA Filter & Search Controls */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        {/* Debounced Search Bar */}
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00875A] text-sm text-slate-900 dark:text-white"
            placeholder="Search by store name, driver, truck plate, or slip ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Year Filter */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00875A]"
          >
            <option value="ALL">All Years</option>
            <option value="2026">Year 2026</option>
            <option value="2025">Year 2025</option>
          </select>

          {/* Month Filter */}
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00875A]"
          >
            <option value="ALL">All Months</option>
            <option value="11">November</option>
            <option value="10">October</option>
            <option value="09">September</option>
          </select>

          {/* Payment / Status Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00875A]"
          >
            <option value="ALL">All Transactions</option>
            <option value="Cash">Cash Collected</option>
            <option value="Charge Invoice">Charge Invoiced</option>
            <option value="Partial">With Partial Adjustments</option>
            <option value="Completed">100% Completed</option>
          </select>

          {/* Sort Order Button */}
          <button
            onClick={() => setSortOrder(sortOrder === "latest" ? "oldest" : "latest")}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
            title="Toggle sort direction"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortOrder === "latest" ? "Latest First" : "Oldest First"}
          </button>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">Slip ID & Date</th>
                <th className="py-3.5 px-4">Vehicle & Driver</th>
                <th className="py-3.5 px-4">Sacks (L / D / R)</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">Payment Split</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              {results.length > 0 ? (
                results.map((slip, index) => {
                  const hasPartial = slip.totalReturnedSacks > 0 || slip.items.some(i => i.status === "Partial");
                  return (
                    <tr key={slip.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3.5 px-4 text-center text-xs text-slate-400 font-medium">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white font-mono text-xs">
                          {slip.id}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {slip.date} • {slip.time}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {slip.driverName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {slip.truckId} ({slip.truckPlate})
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="text-blue-600">{slip.totalLoadedSacks}L</span>
                          <span className="text-slate-300">/</span>
                          <span className="text-emerald-600">{slip.totalDeliveredSacks}D</span>
                          <span className="text-slate-300">/</span>
                          <span className={slip.totalReturnedSacks > 0 ? "text-amber-600 font-extrabold" : "text-slate-400"}>
                            {slip.totalReturnedSacks}R
                          </span>
                        </div>
                        {hasPartial && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                            Partial deliveries recorded
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">
                        ₱ {slip.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <div className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          Cash: ₱{slip.totalCashRevenue.toLocaleString()}
                        </div>
                        <div className="text-blue-700 dark:text-blue-400 font-semibold">
                          Charge: ₱{slip.totalChargeRevenue.toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          slip.status === "Completed"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                        }`}>
                          {slip.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedSlip(slip)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-[#00875A] hover:text-white text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No historical load slips match your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Inspection Modal */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start bg-slate-50 dark:bg-slate-900">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-[#00875A] text-white px-2 py-0.5 rounded">
                    {selectedSlip.id}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {selectedSlip.date} • {selectedSlip.time}
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                  Trip Audit & Store Delivery Breakdown
                </h3>
                <p className="text-xs text-slate-500">
                  Driver: <strong>{selectedSlip.driverName}</strong> | Vehicle: <strong>{selectedSlip.truckId} ({selectedSlip.truckPlate})</strong> | In-Charge: <strong>{selectedSlip.inChargeName}</strong>
                </p>
              </div>

              <button
                onClick={() => setSelectedSlip(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Table */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-slate-400 block font-bold">LOADED</span>
                  <span className="text-lg font-black text-blue-600">{selectedSlip.totalLoadedSacks} Sacks</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">DELIVERED</span>
                  <span className="text-lg font-black text-emerald-600">{selectedSlip.totalDeliveredSacks} Sacks</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">RETURNED / UNSOLD</span>
                  <span className="text-lg font-black text-amber-600">{selectedSlip.totalReturnedSacks} Sacks</span>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">Store Customer</th>
                      <th className="p-3">Location Hub</th>
                      <th className="p-3">Ice Type</th>
                      <th className="p-3">Qty (Plan / Del)</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Payment</th>
                      <th className="p-3">Delivery Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {selectedSlip.items && selectedSlip.items.length > 0 ? (
                      selectedSlip.items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-900 dark:text-white">
                            {item.storeName}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-300">
                            {item.locationName}
                          </td>
                          <td className="p-3">
                            {item.iceType} ({item.sackSize})
                          </td>
                          <td className="p-3 font-semibold">
                            {item.plannedQty} / <span className="text-[#00875A] font-bold">{item.deliveredQty}</span>
                          </td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white">
                            ₱{item.totalPrice.toLocaleString()}
                          </td>
                          <td className="p-3 font-medium">
                            <span className={item.paymentType === "Cash" ? "text-emerald-600 font-bold" : "text-blue-600 font-bold"}>
                              {item.paymentType}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              item.status === "Completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.status === "Partial"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                            }`}>
                              {item.status}
                            </span>
                            {item.partialReason && (
                              <div className="text-[10px] text-amber-600 mt-0.5 italic">
                                Reason: {item.partialReason}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400">
                          No store-level breakdown recorded for this archive record.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <span className="text-xs text-slate-400 font-mono">
                Idempotency: {selectedSlip.idempotencyKey}
              </span>
              <button
                onClick={() => setSelectedSlip(null)}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white font-bold rounded-xl text-xs hover:bg-slate-300 transition-colors"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
