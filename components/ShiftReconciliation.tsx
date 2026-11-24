"use client";

import { useState, useEffect } from "react";
import { TruckVehicle, LoadSlip } from "@/lib/types";
import { DataService } from "@/lib/dataService";
import { 
  RotateCcw, 
  Lock, 
  CheckCircle2, 
  Banknote, 
  FileText, 
  Package, 
  Truck, 
  AlertTriangle,
  Calendar,
  Warehouse
} from "lucide-react";
import ConfirmModal from "./ConfirmModal";

export default function ShiftReconciliation() {
  const [trucks, setTrucks] = useState<TruckVehicle[]>([]);
  const [selectedTruckId, setSelectedTruckId] = useState("TRK-01");
  const [loadSlips, setLoadSlips] = useState<LoadSlip[]>([]);
  const [isShiftClosed, setIsShiftClosed] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");

  useEffect(() => {
    const t = DataService.getTrucks();
    setTrucks(t);
    if (t.length > 0) setSelectedTruckId(t[0].id);
    const history = DataService.getHistoricalLoadSlips();
    setLoadSlips(history);
  }, []);

  const activeSlip = loadSlips.find(s => s.truckId === selectedTruckId) || loadSlips[0];

  const totalLoaded = activeSlip?.totalLoadedSacks || 0;
  const totalDelivered = activeSlip?.totalDeliveredSacks || 0;
  const totalReturned = activeSlip?.totalReturnedSacks || (totalLoaded - totalDelivered);
  const cashToRemit = activeSlip?.totalCashRevenue || 0;
  const chargeIssued = activeSlip?.totalChargeRevenue || 0;

  const handleCloseShift = () => {
    setIsShiftClosed(true);
    setShowConfirmModal(false);
    DataService.saveReconciliation({
      truckId: selectedTruckId,
      date: new Date().toLocaleDateString("en-CA"),
      cashRemitted: cashToRemit,
      chargeIssued: chargeIssued,
      sacksReturned: totalReturned,
      closedAt: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      closedBy: "Rochill Libron (Staff)",
      notes: closingNotes
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-[#00875A]" />
            End-of-Day Truck Shift Closing & Reconciliation
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Tally physical cash to remit into the safe, audit charge invoices, and return unsold ice sacks to the Gusa cold room.
          </p>
        </div>

        {/* Truck Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Select Truck:</span>
          <select
            value={selectedTruckId}
            onChange={(e) => {
              setSelectedTruckId(e.target.value);
              setIsShiftClosed(false);
            }}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-extrabold text-sm text-slate-900 dark:text-white"
          >
            {trucks.map(t => (
              <option key={t.id} value={t.id}>
                {t.id} ({t.plateNumber}) - {t.model}
              </option>
            ))}
          </select>
        </div>
      </div>

      {trucks.length === 0 ? (
        <div className="py-16 px-6 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-[#00875A] flex items-center justify-center mb-4">
            <RotateCcw className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">No Fleet Vehicles Registered</h4>
          <p className="text-sm text-slate-500 max-w-md mt-1">
            There are no delivery trucks registered in the system. Once trucks are registered in Settings and complete delivery routes, end-of-day cashier reconciliations will appear here.
          </p>
        </div>
      ) : !activeSlip ? (
        <div className="py-16 px-6 flex flex-col items-center justify-center text-center bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center mb-4">
            <Truck className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">No Delivery Shift Recorded for {selectedTruckId}</h4>
          <p className="text-sm text-slate-500 max-w-md mt-1">
            No load slip or delivery manifest has been dispatched or completed for this truck today. Safe remittance and unsold sack returns will activate when the driver returns to the Gusa plant.
          </p>
        </div>
      ) : (
        <>
          {/* Driver Handover Notice Banner */}
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-500/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shrink-0">
                ✓
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                  Driver Arrived at JICA ICEPLANT • Status: Completed / Pending Remittance
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Mobile driver finished route and triggered final offline queue flush. Physical cash and returned sacks are ready for cashier audit.
                </p>
              </div>
            </div>
            <span className="text-xs font-black uppercase px-3 py-1 bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 rounded-full shrink-0">
              Ready for Closing
            </span>
          </div>

      {/* Reconciliation Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Cash to Remit */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-100">
              Total Cash to Remit to Safe
            </span>
            <div className="p-2 bg-white/20 rounded-xl">
              <Banknote className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-black tracking-tight">
              ₱ {cashToRemit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-emerald-100 block mt-1">
              Collected by driver from cash stops
            </span>
          </div>
        </div>

        {/* Charge Invoices Issued */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-blue-200 dark:border-blue-800/60 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">
              Charge Invoices Issued (Credit)
            </span>
            <div className="p-2 bg-blue-100 dark:bg-blue-950/50 rounded-xl text-blue-600">
              <FileText className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-black text-blue-700 dark:text-blue-400 tracking-tight">
              ₱ {chargeIssued.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-400 block mt-1">
              Signed credit invoices for supermarket billing
            </span>
          </div>
        </div>

        {/* Unsold Sacks Returning to Cold Storage */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-amber-200 dark:border-amber-800/60 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
              Unsold Ice Sacks for Restock
            </span>
            <div className="p-2 bg-amber-100 dark:bg-amber-950/50 rounded-xl text-amber-600">
              <Warehouse className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                {totalReturned}
              </span>
              <span className="text-xs font-bold text-slate-500">
                sacks returning ({totalDelivered} delivered / {totalLoaded} loaded)
              </span>
            </div>
            <span className="text-xs text-slate-400 block mt-1">
              Return to JICA ICEPLANT (#69 Old Road Gusa, CDOC 9000) cold storage room
            </span>
          </div>
        </div>
      </div>

      {/* Driver & Trip Audit Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Truck className="w-5 h-5 text-[#00875A]" />
          Shift Deliveries Breakdown — {selectedTruckId} (Driver: {activeSlip?.driverName || "Jethro Bon Dena"})
        </h3>

        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3">Store Customer</th>
                <th className="p-3">Location Hub</th>
                <th className="p-3 text-center">Planned</th>
                <th className="p-3 text-center">Delivered</th>
                <th className="p-3 text-center">Returned Sacks</th>
                <th className="p-3">Payment</th>
                <th className="p-3 text-right">Amount (PHP)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              {activeSlip?.items && activeSlip.items.length > 0 ? (
                activeSlip.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{item.storeName}</td>
                    <td className="p-3 text-slate-500 text-xs">{item.locationName}</td>
                    <td className="p-3 text-center font-semibold text-xs">{item.plannedQty}</td>
                    <td className="p-3 text-center font-bold text-xs text-emerald-600">{item.deliveredQty}</td>
                    <td className="p-3 text-center font-bold text-xs text-amber-600">
                      {Math.max(0, item.plannedQty - item.deliveredQty)}
                    </td>
                    <td className="p-3 text-xs font-bold">
                      <span className={item.paymentType === "Cash" ? "text-emerald-700" : "text-blue-700"}>
                        {item.paymentType}
                      </span>
                    </td>
                    <td className="p-3 text-right font-black text-xs text-slate-900 dark:text-white">
                      ₱ {item.totalPrice.toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    No active delivery rows found for this vehicle.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Shift Closing Controls */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Audit notes (e.g., Driver cash verified by Rochill, 4 sacks returned to cold room 2)..."
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00875A]"
            />
          </div>

          <button
            disabled={isShiftClosed}
            onClick={() => setShowConfirmModal(true)}
            className={`px-8 py-3.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg transition-all ${
              isShiftClosed
                ? "bg-slate-200 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
                : "bg-emerald-700 hover:bg-emerald-800 text-white hover:shadow-xl cursor-pointer"
            }`}
          >
            {isShiftClosed ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Shift Closed & Remitted
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Confirm Shift Closed & Remitted
              </>
            )}
          </button>
        </div>
      </div>
      </>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <ConfirmModal
          isOpen={showConfirmModal}
          onConfirm={handleCloseShift}
          onCancel={() => setShowConfirmModal(false)}
          message={`Confirm shift closing for ${selectedTruckId}? Cash of ₱${cashToRemit.toLocaleString()} will be recorded as remitted into safe and ${totalReturned} unsold ice sacks returned to cold storage.`}
        />
      )}
    </div>
  );
}
