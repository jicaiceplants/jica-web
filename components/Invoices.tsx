"use client";

import { useState, useMemo, useEffect } from "react";
import { InvoiceRecord } from "@/lib/types";
import { DataService } from "@/lib/dataService";
import { 
  Receipt, 
  CreditCard, 
  Search, 
  Printer, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  ArrowUpDown, 
  TrendingUp, 
  Calendar,
  X,
  BadgeCheck
} from "lucide-react";
import ConfirmModal from "./ConfirmModal";

export default function Invoices() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Cash Paid" | "Unpaid Charge" | "Settled Charge">("ALL");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [monthFilter, setMonthFilter] = useState<string>("ALL");

  // Credit Collection Settlement Modal
  const [invoiceToSettle, setInvoiceToSettle] = useState<InvoiceRecord | null>(null);
  
  // Printable Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState<InvoiceRecord | null>(null);

  useEffect(() => {
    setInvoices(DataService.getInvoices());
  }, []);

  // 400ms Debounce on Search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // DSA Filtering, Sorting & KPI Summary
  const { results, kpi } = useMemo(() => {
    return DataService.filterAndSortInvoices({
      invoices,
      searchQuery: debouncedQuery,
      sortOrder,
      yearFilter,
      monthFilter,
      statusFilter
    });
  }, [invoices, debouncedQuery, sortOrder, yearFilter, monthFilter, statusFilter]);

  // Execute settlement
  const handleConfirmSettle = () => {
    if (invoiceToSettle) {
      const res = DataService.settleChargeInvoice(invoiceToSettle.id, "Rochill Libron (Staff)");
      if (res.success) {
        setInvoices(DataService.getInvoices());
      }
      setInvoiceToSettle(null);
    }
  };

  const triggerBrowserPrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-[#00875A]" />
            Billing & Credit Collections Ledger
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Track daily cash remittances, outstanding supermarket credit receivables, and settled charge invoices.
          </p>
        </div>

        <div className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-900 px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-300">
          Timezone: Asia/Manila (UTC+8)
        </div>
      </div>

      {/* KPI Cards (DSA Aggregated) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Total Cash Collected */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800/60 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              Total Cash Collected
            </span>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/50 rounded-xl text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">
              ₱ {kpi.totalCashCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-400 block mt-1">
              Includes cash deliveries ({kpi.countCash}) + settled credit ({kpi.countSettled})
            </span>
          </div>
        </div>

        {/* Total Unpaid Receivables */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-amber-200 dark:border-amber-800/60 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
              Unpaid Credit Receivables
            </span>
            <div className="p-2 bg-amber-100 dark:bg-amber-950/50 rounded-xl text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              ₱ {kpi.totalUnpaidCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-400 block mt-1">
              {kpi.countUnpaid} pending charge invoice{kpi.countUnpaid !== 1 ? 's' : ''} awaiting remittance
            </span>
          </div>
        </div>

        {/* Total Settled Charge Invoices */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-blue-200 dark:border-blue-800/60 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">
              Settled Charge Invoices
            </span>
            <div className="p-2 bg-blue-100 dark:bg-blue-950/50 rounded-xl text-blue-600">
              <BadgeCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-blue-700 dark:text-blue-400 tracking-tight">
              ₱ {kpi.totalSettledCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-400 block mt-1">
              {kpi.countSettled} institutional credit accounts collected
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00875A] text-sm text-slate-900 dark:text-white font-medium"
            placeholder="Search by customer store, receipt # (OR- / CI-), or hub..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#00875A]"
          >
            <option value="ALL">All Ledger Records</option>
            <option value="Cash Paid">Cash Sales (Paid)</option>
            <option value="Unpaid Charge">Unpaid Charge (Receivables)</option>
            <option value="Settled Charge">Settled Charge (Collected)</option>
          </select>

          {/* Year Filter */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Years</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>

          {/* Sort Order */}
          <button
            onClick={() => setSortOrder(sortOrder === "latest" ? "oldest" : "latest")}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortOrder === "latest" ? "Latest First" : "Oldest First"}
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">Receipt / Invoice #</th>
                <th className="py-3.5 px-4">Customer Store & Hub</th>
                <th className="py-3.5 px-4">Ice Item & Qty</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">Payment Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              {results.length > 0 ? (
                results.map((inv, idx) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-3.5 px-4 text-center text-xs text-slate-400 font-semibold">
                      {idx + 1}
                    </td>

                    {/* Receipt Number & Date */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                        {inv.invoiceNumber}
                      </span>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {inv.date}
                      </div>
                    </td>

                    {/* Customer Store */}
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-900 dark:text-white">
                        {inv.customerName}
                      </div>
                      <div className="text-xs text-slate-500">{inv.locationName}</div>
                    </td>

                    {/* Quantity & Unit Price */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {inv.deliveredQty} sacks • {inv.iceType}
                      </div>
                      <div className="text-xs text-slate-400">@ ₱{inv.unitPrice} / sack</div>
                    </td>

                    {/* Total Amount */}
                    <td className="py-3.5 px-4 font-black text-base text-slate-900 dark:text-white">
                      ₱ {inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Payment Status */}
                    <td className="py-3.5 px-4">
                      {inv.status === "Cash Paid" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Cash Paid
                        </span>
                      )}
                      {inv.status === "Unpaid Charge" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Unpaid Credit
                        </span>
                      )}
                      {inv.status === "Settled Charge" && (
                        <div className="flex flex-col">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 w-fit">
                            <BadgeCheck className="w-3 h-3 text-blue-600" />
                            Settled Credit
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            {inv.settledAt}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Mark as Paid Button for Unpaid Charge Invoices */}
                        {inv.status === "Unpaid Charge" && (
                          <button
                            onClick={() => setInvoiceToSettle(inv)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs shadow-sm transition-all"
                            title="Mark invoice as settled/collected"
                          >
                            Mark Paid
                          </button>
                        )}

                        {/* View Printable Receipt Button */}
                        <button
                          onClick={() => setActiveReceipt(inv)}
                          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          title="View Official Receipt / Delivery Statement"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-[#00875A] flex items-center justify-center mb-4">
                        <Receipt className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-black text-slate-800 dark:text-slate-100">
                        {invoices.length === 0 ? "No Invoices or Collections Yet" : "No Records Match Filter"}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {invoices.length === 0
                          ? "Cash receipts and store charge invoices are automatically generated when daily load slips are dispatched and deliveries are recorded by drivers."
                          : "Try adjusting your search query, status filter, or date filters above."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit Settlement Confirmation Modal */}
      {invoiceToSettle && (
        <ConfirmModal
          isOpen={!!invoiceToSettle}
          onConfirm={handleConfirmSettle}
          onCancel={() => setInvoiceToSettle(null)}
          message={`Confirm credit settlement of ₱${invoiceToSettle.totalAmount.toLocaleString()} for ${invoiceToSettle.customerName}? This will record the payment as collected today in Asia/Manila time.`}
        />
      )}

      {/* Clean Printable JICA Ice Official Receipt / Statement Modal */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl shadow-2xl max-w-xl w-full border border-slate-300 overflow-hidden flex flex-col p-8 font-sans">
            
            {/* Modal Controls */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 print:hidden">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Print Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={triggerBrowserPrint}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#00875A] text-white rounded-lg font-bold text-xs shadow-md hover:brightness-110"
                >
                  <Printer className="w-4 h-4" />
                  Print / Save PDF
                </button>
                <button
                  onClick={() => setActiveReceipt(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Statement Sheet */}
            <div className="space-y-6">
              {/* Receipt Header */}
              <div className="text-center border-b-2 border-slate-900 pb-4">
                <h1 className="text-2xl font-black uppercase tracking-wider text-slate-900">
                  J.I.C.A ICE LOGISTICS
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  National Highway, Gusa (near Caltex), Cagayan de Oro City
                </p>
                <p className="text-xs font-bold text-slate-500">
                  Contact: +63 917 111 2233 • dispatch@jicaice.com
                </p>
                <div className="mt-3 inline-block px-3 py-1 bg-slate-100 rounded text-xs font-black uppercase tracking-widest text-slate-800">
                  {activeReceipt.paymentType === "Cash" ? "OFFICIAL SALES RECEIPT (CASH)" : "DELIVERY STATEMENT & CHARGE INVOICE"}
                </div>
              </div>

              {/* Meta details */}
              <div className="flex justify-between text-xs">
                <div>
                  <span className="text-slate-400 block font-bold">BILLED TO CUSTOMER</span>
                  <span className="text-base font-extrabold text-slate-900 block">{activeReceipt.customerName}</span>
                  <span className="text-slate-600">{activeReceipt.locationName}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block font-bold">INVOICE NO.</span>
                  <span className="text-base font-black font-mono text-red-600 block">{activeReceipt.invoiceNumber}</span>
                  <span className="text-slate-500">Date: {activeReceipt.date} (Asia/Manila)</span>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-slate-700 font-black">
                    <th className="py-2">Item Description</th>
                    <th className="py-2 text-center">Delivered Qty</th>
                    <th className="py-2 text-right">Unit Price</th>
                    <th className="py-2 text-right">Amount (PHP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-3 font-bold">{activeReceipt.iceType} ({activeReceipt.sackSize})</td>
                    <td className="py-3 text-center font-bold">{activeReceipt.deliveredQty} sacks</td>
                    <td className="py-3 text-right">₱ {activeReceipt.unitPrice.toFixed(2)}</td>
                    <td className="py-3 text-right font-black">₱ {activeReceipt.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>

              {/* Total Card */}
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block uppercase">Payment Status</span>
                  <span className={`text-sm font-extrabold ${
                    activeReceipt.status === "Cash Paid"
                      ? "text-emerald-700"
                      : activeReceipt.status === "Settled Charge"
                      ? "text-blue-700"
                      : "text-amber-700"
                  }`}>
                    {activeReceipt.status.toUpperCase()}
                  </span>
                  {activeReceipt.settledAt && (
                    <span className="text-[10px] text-slate-500 block">
                      Collected on {activeReceipt.settledAt} by {activeReceipt.settledBy}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold text-slate-400 block uppercase">TOTAL DUE</span>
                  <span className="text-2xl font-black text-slate-900">
                    ₱ {activeReceipt.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 border-t border-slate-200 flex justify-between text-center text-xs">
                <div>
                  <div className="w-40 border-b border-slate-400 mb-1"></div>
                  <span className="text-slate-500 font-medium">Customer Received By</span>
                </div>
                <div>
                  <div className="w-40 border-b border-slate-400 mb-1"></div>
                  <span className="text-slate-500 font-medium">JICA Dispatch Authorized</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
