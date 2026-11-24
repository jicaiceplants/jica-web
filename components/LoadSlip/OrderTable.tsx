"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Sparkles, RotateCcw, Check, AlertCircle, RefreshCw, Store } from "lucide-react";
import { DeliveryLocation, IceProduct, StoreCustomer, LoadSlipItem, LoadSlip } from "@/lib/types";
import { DataService, generateUUID } from "@/lib/dataService";
import ConfirmModal from "../ConfirmModal";

interface OrderTableProps {
  currentDate: string;
  currentTime: string;
  truckId: string;
  inChargeId: string;
  driverId: string;
  onSavedSuccess?: (slip: LoadSlip) => void;
}

export default function OrderTable({
  currentDate,
  currentTime,
  truckId,
  inChargeId,
  driverId,
  onSavedSuccess
}: OrderTableProps) {
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [products, setProducts] = useState<IceProduct[]>([]);
  const [customers, setCustomers] = useState<StoreCustomer[]>([]);

  const [items, setItems] = useState<LoadSlipItem[]>([]);
  const [isPrefilled, setIsPrefilled] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Modal State for row deletion
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [confirmClearModal, setConfirmClearModal] = useState(false);

  // Initialize data on mount
  useEffect(() => {
    const locs = DataService.getLocations();
    const prods = DataService.getProducts();
    const custs = DataService.getCustomers();
    setLocations(locs);
    setProducts(prods);
    setCustomers(custs);

    // Auto-Prefill from yesterday's template
    const template = DataService.getTodayLoadSlipTemplate();
    if (template.isPrefilled && template.loadSlip.items.length > 0) {
      setItems(template.loadSlip.items);
      setIsPrefilled(true);
      setPrefilledDate(template.prefilledDate);
    } else {
      createBlankRow(locs, prods);
    }
  }, []);

  const createBlankRow = (locs = locations, prods = products) => {
    const defaultLoc = locs[0];
    const defaultProd = prods[0];
    const newItem: LoadSlipItem = {
      id: `ITEM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerId: "",
      storeName: "",
      locationId: defaultLoc?.id || "",
      locationName: defaultLoc?.name || "",
      iceProductId: defaultProd?.id || "",
      iceType: defaultProd?.name || "Tube Ice",
      sackSize: defaultProd?.sackSize || "50kg Big Sack",
      plannedQty: 1,
      deliveredQty: 0,
      unitPrice: defaultProd?.price || 150,
      totalPrice: defaultProd?.price || 150,
      paymentType: "Cash",
      status: "Pending"
    };
    setItems([newItem]);
    setIsPrefilled(false);
  };

  const handleAddRow = () => {
    const defaultLoc = locations[0];
    const defaultProd = products[0];
    const newItem: LoadSlipItem = {
      id: `ITEM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerId: "",
      storeName: "",
      locationId: defaultLoc?.id || "",
      locationName: defaultLoc?.name || "",
      iceProductId: defaultProd?.id || "",
      iceType: defaultProd?.name || "Tube Ice",
      sackSize: defaultProd?.sackSize || "50kg Big Sack",
      plannedQty: 1,
      deliveredQty: 0,
      unitPrice: defaultProd?.price || 150,
      totalPrice: defaultProd?.price || 150,
      paymentType: "Cash",
      status: "Pending"
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleClearToBlank = () => {
    createBlankRow();
    setConfirmClearModal(false);
  };

  const handleReloadYesterday = () => {
    const template = DataService.getTodayLoadSlipTemplate();
    if (template.isPrefilled && template.loadSlip.items && template.loadSlip.items.length > 0) {
      setItems(template.loadSlip.items);
      setIsPrefilled(true);
      setPrefilledDate(template.prefilledDate);
    }
  };

  const handleUpdateItem = (id: string, field: keyof LoadSlipItem, value: any) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // If location changed, update locationName
        if (field === "locationId") {
          const loc = locations.find(l => l.id === value);
          if (loc) updated.locationName = loc.name;
        }

        // If customer changed, auto-fill defaults
        if (field === "customerId") {
          const cust = customers.find(c => c.id === value);
          if (cust) {
            updated.storeName = cust.name;
            updated.locationId = cust.locationId;
            updated.locationName = cust.locationName;
            updated.iceType = cust.defaultIceType;
            updated.sackSize = cust.defaultSackSize;
            updated.plannedQty = cust.defaultQty;
            updated.paymentType = cust.defaultPaymentType;
            const matchingProd = products.find(p => p.name.includes(cust.defaultIceType));
            if (matchingProd) {
              updated.iceProductId = matchingProd.id;
              updated.unitPrice = matchingProd.price;
              updated.totalPrice = cust.defaultQty * matchingProd.price;
            }
          }
        }

        // If iceProduct changed, update unit price
        if (field === "iceProductId") {
          const prod = products.find(p => p.id === value);
          if (prod) {
            updated.iceType = prod.name;
            updated.sackSize = prod.sackSize;
            updated.unitPrice = prod.price;
            updated.totalPrice = (Number(updated.plannedQty) || 0) * prod.price;
          }
        }

        // If quantity changed, recalculate total price
        if (field === "plannedQty") {
          const qty = Number(value) || 0;
          updated.totalPrice = qty * (Number(updated.unitPrice) || 0);
        }

        // If total price manually negotiated
        if (field === "totalPrice") {
          updated.totalPrice = Number(value) || 0;
        }

        return updated;
      })
    );
  };

  const executeDelete = () => {
    if (itemToDelete) {
      setItems(prev => prev.filter(item => item.id !== itemToDelete));
      setItemToDelete(null);
    }
  };

  // Grand totals
  const totalSacksLoaded = items.reduce((acc, row) => acc + (Number(row.plannedQty) || 0), 0);
  const grandTotal = items.reduce((acc, row) => acc + (Number(row.totalPrice) || 0), 0);
  const totalCash = items.filter(i => i.paymentType === "Cash").reduce((a, r) => a + (Number(r.totalPrice) || 0), 0);
  const totalCharge = items.filter(i => i.paymentType === "Charge Invoice").reduce((a, r) => a + (Number(r.totalPrice) || 0), 0);

  // Save Load Slip with idempotency & double-submit protection
  const handleSaveLoadSlip = () => {
    if (items.length === 0) {
      alert("Please add at least one delivery item to the Load Slip.");
      return;
    }

    const hasInvalidStore = items.some(i => !i.storeName.trim());
    if (hasInvalidStore) {
      alert("Please ensure every delivery has a valid Store Name.");
      return;
    }

    setIsSaving(true);

    const trucks = DataService.getTrucks();
    const truck = trucks.find(t => t.id === truckId) || trucks[0];

    const staffList = DataService.getStaff();
    const inCharge = staffList.find(s => s.id === inChargeId) || staffList[0];

    const drivers = DataService.getDrivers();
    const driver = drivers.find(d => d.id === driverId) || drivers[0];

    const newLoadSlip: LoadSlip = {
      id: `LS-${currentDate.replace(/-/g, "")}-${Math.floor(10 + Math.random() * 90)}`,
      idempotencyKey: generateUUID(),
      date: currentDate,
      time: currentTime,
      truckId: truck.id,
      truckPlate: truck.plateNumber,
      inChargeId: inCharge.id,
      inChargeName: inCharge.name,
      driverId: driver.id,
      driverName: driver.name,
      status: "Active",
      totalLoadedSacks: totalSacksLoaded,
      totalDeliveredSacks: 0,
      totalReturnedSacks: 0,
      totalRevenue: grandTotal,
      totalCashRevenue: totalCash,
      totalChargeRevenue: totalCharge,
      items: items.map(item => ({
        ...item,
        status: "Pending"
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setTimeout(() => {
      const res = DataService.saveLoadSlip(newLoadSlip);
      setIsSaving(false);
      setSaveSuccessMessage(res.message);
      if (onSavedSuccess) onSavedSuccess(newLoadSlip);

      setTimeout(() => {
        setSaveSuccessMessage(null);
      }, 3500);
    }, 600);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Auto-Prefill Notification Banner */}
      {isPrefilled && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/50 text-[#00875A] dark:text-emerald-300 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-[#00875A] dark:text-emerald-300 text-sm">
                Auto-Filled from Yesterday ({prefilledDate})
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Recurring customers and planned quantities loaded. All delivery statuses reset to &quot;Pending&quot;. Edit any row or click &quot;Save Load Slip&quot;.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setConfirmClearModal(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-600 transition-colors"
            >
              Clear / Start Blank
            </button>
          </div>
        </div>
      )}

      {/* Success Notification Alert */}
      {saveSuccessMessage && (
        <div className="bg-emerald-100 dark:bg-emerald-900/60 border-2 border-emerald-500 rounded-2xl p-4 flex items-center justify-between text-emerald-900 dark:text-emerald-100 font-bold text-sm shadow-md animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
            <span>{saveSuccessMessage} Record added to Load Slip History.</span>
          </div>
        </div>
      )}

      {/* Missing Master Data Warning Banner */}
      {(locations.length === 0 || products.length === 0) && (
        <div className="p-5 bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-700 rounded-2xl flex items-start gap-3.5 text-amber-900 dark:text-amber-200 shadow-xs">
          <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold text-base">Setup Required Before Creating Dispatch Manifest</h4>
            <p className="text-xs mt-1 text-amber-800 dark:text-amber-300 leading-relaxed">
              {locations.length === 0 && products.length === 0
                ? "No Delivery Location Hubs or Ice Products are registered yet. Please click on 'Settings' in the sidebar to add your Delivery Hubs and Ice Products first."
                : locations.length === 0
                ? "No Delivery Location Hubs are registered yet. Please click on 'Settings' in the sidebar to add your Cagayan de Oro delivery hubs on Google Maps."
                : "No Ice Products are registered in your catalog yet. Please click on 'Settings' in the sidebar to define your ice categories and prices."}
            </p>
          </div>
        </div>
      )}

      {/* Main Delivery Table */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700">
                <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-12 text-center">#</th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-56">Store Customer</th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-48">Delivery Hub Location</th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-44">Ice Product</th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-24 text-center">Sacks</th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-28 bg-slate-100 dark:bg-slate-900/50">Unit Price</th>
                <th className="py-3.5 px-4 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider w-36 bg-emerald-50 dark:bg-emerald-900/20">Total (PHP)</th>
                <th className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-36">Payment</th>
                <th className="py-3.5 px-4 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              {items.map((row, index) => {
                const matchingCustomers = customers.filter(c => c.locationId === row.locationId);

                return (
                  <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/40 transition-colors group">
                    <td className="py-3 px-4 text-sm font-semibold text-slate-400 text-center">
                      {index + 1}
                    </td>

                    {/* Store Customer Name / Preset Selector */}
                    <td className="py-3 px-2">
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00875A] font-bold text-slate-900 dark:text-white"
                          placeholder="e.g. Jollibee SM Downtown"
                          value={row.storeName}
                          onChange={(e) => handleUpdateItem(row.id, "storeName", e.target.value)}
                        />
                        {matchingCustomers.length > 0 && (
                          <select
                            className="text-[11px] text-slate-500 dark:text-slate-400 bg-transparent border-0 cursor-pointer hover:text-[#00875A] font-medium"
                            value={row.customerId}
                            onChange={(e) => handleUpdateItem(row.id, "customerId", e.target.value)}
                          >
                            <option value="">Quick pick from this hub...</option>
                            {matchingCustomers.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>

                    {/* Delivery Hub Location */}
                    <td className="py-3 px-2">
                      <select
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00875A] text-slate-900 dark:text-white font-medium cursor-pointer"
                        value={row.locationId}
                        onChange={(e) => handleUpdateItem(row.id, "locationId", e.target.value)}
                      >
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* Ice Product */}
                    <td className="py-3 px-2">
                      <select
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00875A] text-slate-900 dark:text-white font-medium cursor-pointer"
                        value={row.iceProductId}
                        onChange={(e) => handleUpdateItem(row.id, "iceProductId", e.target.value)}
                      >
                        {products.map(prod => (
                          <option key={prod.id} value={prod.id}>
                            {prod.name} (₱{prod.price})
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Planned Sacks Quantity */}
                    <td className="py-3 px-2 text-center">
                      <input
                        type="number"
                        min="1"
                        max="200"
                        className="w-20 px-2.5 py-2 text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00875A] font-bold text-base text-slate-900 dark:text-white"
                        value={row.plannedQty}
                        onChange={(e) => handleUpdateItem(row.id, "plannedQty", e.target.value)}
                      />
                    </td>

                    {/* Standard Unit Price */}
                    <td className="py-3 px-4 bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 font-semibold">
                      ₱ {Number(row.unitPrice).toFixed(2)}
                    </td>

                    {/* Total Price (Editable for Negotiated Pricing) */}
                    <td className="py-3 px-2 bg-emerald-50/50 dark:bg-emerald-900/10">
                      <div className="relative flex items-center">
                        <span className="absolute left-2.5 text-emerald-600 dark:text-emerald-400 font-bold">₱</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          className="w-full pl-7 pr-2.5 py-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg font-bold text-emerald-700 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                          value={row.totalPrice}
                          onChange={(e) => handleUpdateItem(row.id, "totalPrice", e.target.value)}
                        />
                      </div>
                    </td>

                    {/* Payment Type */}
                    <td className="py-3 px-2">
                      <select
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00875A] font-bold cursor-pointer ${
                          row.paymentType === "Cash"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                        }`}
                        value={row.paymentType}
                        onChange={(e) => handleUpdateItem(row.id, "paymentType", e.target.value)}
                      >
                        <option value="Cash">Cash</option>
                        <option value="Charge Invoice">Charge Invoice</option>
                      </select>
                    </td>

                    {/* Delete Row Action */}
                    <td className="py-3 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => setItemToDelete(row.id)}
                        disabled={items.length === 1}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Remove delivery stop"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Action Row */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 flex flex-wrap justify-between items-center gap-3">
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-[#00875A] dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Another Store Delivery
          </button>

          {!isPrefilled && (
            <button
              type="button"
              onClick={handleReloadYesterday}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Re-load Yesterday&apos;s Recurring Stops
            </button>
          )}
        </div>
      </section>

      {/* Grand Total & Primary Save Section */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-8">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={isSaving || locations.length === 0 || products.length === 0 || !truckId}
            onClick={handleSaveLoadSlip}
            className="flex items-center gap-3 px-10 py-4 bg-[#00875A] hover:bg-emerald-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-900/20 hover:-translate-y-0.5 hover:shadow-emerald-900/30 transition-all active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Validating & Saving...
              </>
            ) : (
              <>
                <Save className="w-6 h-6" />
                Save & Dispatch Load Slip
              </>
            )}
          </button>
          <span className="text-xs text-slate-400">
            Generates unique idempotency key. Instantly syncs with driver mobile devices.
          </span>
        </div>

        {/* Big Grand Total Display */}
        <div className="bg-gradient-to-r from-yellow-400 to-amber-400 rounded-2xl p-6 shadow-xl flex flex-col items-end min-w-[340px] text-yellow-950 border border-yellow-300">
          <div className="flex justify-between w-full text-xs font-bold uppercase tracking-wider text-yellow-900 mb-1">
            <span>Total Planned Sacks: <strong>{totalSacksLoaded}</strong></span>
            <span>Grand Total</span>
          </div>
          <span className="text-4xl font-black tracking-tight">
            ₱ {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="flex justify-between w-full text-xs font-extrabold text-yellow-900/90 border-t border-yellow-600/20 pt-2 mt-2">
            <span>Cash: ₱{totalCash.toLocaleString()}</span>
            <span>Charge Invoice: ₱{totalCharge.toLocaleString()}</span>
          </div>
        </div>
      </section>

      {/* Delete Row Modal */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        onConfirm={executeDelete}
        onCancel={() => setItemToDelete(null)}
        message="Are you sure you want to remove this delivery record from today's Load Slip?"
      />

      {/* Clear All Modal */}
      <ConfirmModal
        isOpen={confirmClearModal}
        onConfirm={handleClearToBlank}
        onCancel={() => setConfirmClearModal(false)}
        message="Clear all auto-filled stops and start with a completely blank load slip?"
      />
    </div>
  );
}
