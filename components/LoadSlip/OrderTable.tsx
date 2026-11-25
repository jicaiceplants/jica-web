"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Save, Sparkles, RotateCcw, Check, AlertCircle, RefreshCw, AlertTriangle, PackageCheck } from "lucide-react";
import { DeliveryLocation, IceProduct, StoreCustomer, LoadSlipItem, LoadSlip, UserAccount, TruckCapacityInfo } from "@/lib/types";
import { DataService, generateUUID } from "@/lib/dataService";
import { multiplyCurrency, roundCurrency, sumCurrency, sanitizePriceTyping, normalizePriceOnBlur, formatPhp } from "@/lib/currencyUtils";
import { formatProductLabel } from "@/lib/productUtils";
import { supabase } from "@/lib/supabaseClient";
import ConfirmModal from "../ConfirmModal";

interface OrderTableProps {
  currentDate: string;
  currentTime: string;
  truckId: string;
  driverId: string;
  currentUser: UserAccount;
  onSavedSuccess?: (slip: LoadSlip) => void;
}

export default function OrderTable({
  currentDate,
  currentTime,
  truckId,
  driverId,
  currentUser,
  onSavedSuccess
}: OrderTableProps) {
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [products, setProducts] = useState<IceProduct[]>([]);
  const [customers, setCustomers] = useState<StoreCustomer[]>([]);
  const [capacities, setCapacities] = useState<TruckCapacityInfo[]>([]);

  const [items, setItems] = useState<LoadSlipItem[]>([]);
  const [qtyStrMap, setQtyStrMap] = useState<Record<string, string>>({});
  const [totalStrMap, setTotalStrMap] = useState<Record<string, string>>({});

  const [isPrefilled, setIsPrefilled] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [confirmClearModal, setConfirmClearModal] = useState(false);

  const syncRowStrings = (rows: LoadSlipItem[]) => {
    const qMap: Record<string, string> = {};
    const tMap: Record<string, string> = {};
    rows.forEach(r => {
      qMap[r.id] = String(r.plannedQty ?? 0);
      tMap[r.id] = String(r.totalPrice ?? 0);
    });
    setQtyStrMap(qMap);
    setTotalStrMap(tMap);
  };

  const refreshLiveCapacity = useCallback(async () => {
    const capList = await DataService.fetchTrucksCapacity();
    setCapacities(capList);
  }, []);

  const loadMasterData = useCallback(async () => {
    await DataService.fetchLiveFromSupabase();
    const locs = DataService.getLocations();
    const prods = DataService.getProducts();
    const custs = DataService.getCustomers();
    setLocations(locs);
    setProducts(prods);
    setCustomers(custs);
    await refreshLiveCapacity();
    return { locs, prods };
  }, [refreshLiveCapacity]);

  useEffect(() => {
    let mounted = true;
    loadMasterData().then(({ locs, prods }) => {
      if (!mounted) return;
      const template = DataService.getTodayLoadSlipTemplate();
      if (template.isPrefilled && template.loadSlip.items.length > 0 && locs.length > 0 && prods.length > 0) {
        setItems(template.loadSlip.items);
        syncRowStrings(template.loadSlip.items);
        setIsPrefilled(true);
        setPrefilledDate(template.prefilledDate);
      } else if (locs.length > 0 && prods.length > 0) {
        const defaultLoc = locs[0];
        const defaultProd = prods[0];
        const rowId = `ITEM-${Date.now()}`;
        const initial: LoadSlipItem = {
          id: rowId,
          customerId: "",
          storeName: "",
          locationId: defaultLoc.id,
          locationName: defaultLoc.name,
          iceProductId: defaultProd.id,
          iceType: defaultProd.name,
          sackSize: defaultProd.sackSize,
          plannedQty: 1,
          deliveredQty: 0,
          unitPrice: defaultProd.price,
          totalPrice: multiplyCurrency(1, defaultProd.price),
          paymentType: "Cash",
          status: "Pending"
        };
        setItems([initial]);
        syncRowStrings([initial]);
        setIsPrefilled(false);
      } else {
        setItems([]);
        syncRowStrings([]);
      }
    });

    // Realtime capacity watcher when another dispatcher submits a Load Slip
    const capChannel = supabase
      .channel("load-slip-capacity-watcher")
      .on("postgres_changes", { event: "*", schema: "public", table: "load_slips" }, () => {
        refreshLiveCapacity();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trucks" }, () => {
        refreshLiveCapacity();
      })
      .subscribe();

    const pollCap = setInterval(refreshLiveCapacity, 10000);
    return () => {
      mounted = false;
      clearInterval(pollCap);
      supabase.removeChannel(capChannel);
    };
  }, [loadMasterData, refreshLiveCapacity]);

  const createBlankRow = (locs = locations, prods = products) => {
    if (locs.length === 0 || prods.length === 0) {
      setItems([]);
      syncRowStrings([]);
      return;
    }
    const defaultLoc = locs[0];
    const defaultProd = prods[0];
    const newItem: LoadSlipItem = {
      id: `ITEM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerId: "",
      storeName: "",
      locationId: defaultLoc.id,
      locationName: defaultLoc.name,
      iceProductId: defaultProd.id,
      iceType: defaultProd.name,
      sackSize: defaultProd.sackSize,
      plannedQty: 1,
      deliveredQty: 0,
      unitPrice: defaultProd.price,
      totalPrice: multiplyCurrency(1, defaultProd.price),
      paymentType: "Cash",
      status: "Pending"
    };
    setItems([newItem]);
    syncRowStrings([newItem]);
    setIsPrefilled(false);
  };

  const handleAddRow = () => {
    if (locations.length === 0 || products.length === 0) return;
    const defaultLoc = locations[0];
    const defaultProd = products[0];
    const rowId = `ITEM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newItem: LoadSlipItem = {
      id: rowId,
      customerId: "",
      storeName: "",
      locationId: defaultLoc.id,
      locationName: defaultLoc.name,
      iceProductId: defaultProd.id,
      iceType: defaultProd.name,
      sackSize: defaultProd.sackSize,
      plannedQty: 1,
      deliveredQty: 0,
      unitPrice: defaultProd.price,
      totalPrice: multiplyCurrency(1, defaultProd.price),
      paymentType: "Cash",
      status: "Pending"
    };
    setItems(prev => [...prev, newItem]);
    setQtyStrMap(prev => ({ ...prev, [rowId]: "1" }));
    setTotalStrMap(prev => ({ ...prev, [rowId]: String(newItem.totalPrice) }));
  };

  const handleClearToBlank = () => {
    createBlankRow();
    setConfirmClearModal(false);
  };

  const handleReloadYesterday = () => {
    const template = DataService.getTodayLoadSlipTemplate();
    if (template.isPrefilled && template.loadSlip.items.length > 0) {
      setItems(template.loadSlip.items);
      syncRowStrings(template.loadSlip.items);
      setIsPrefilled(true);
      setPrefilledDate(template.prefilledDate);
    }
  };

  const handleUpdateItem = (id: string, field: keyof LoadSlipItem, value: any) => {
    setErrorBanner(null);
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };

        if (field === "locationId") {
          const loc = locations.find(l => l.id === value);
          if (loc) updated.locationName = loc.name;
        }

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
            const matchingProd = products.find(p => p.name === cust.defaultIceType);
            if (matchingProd) {
              updated.iceProductId = matchingProd.id;
              updated.unitPrice = matchingProd.price;
              updated.totalPrice = multiplyCurrency(cust.defaultQty, matchingProd.price);
              setQtyStrMap(m => ({ ...m, [id]: String(cust.defaultQty) }));
              setTotalStrMap(m => ({ ...m, [id]: String(updated.totalPrice) }));
            }
          }
        }

        if (field === "iceProductId") {
          const prod = products.find(p => p.id === value);
          if (prod) {
            updated.iceType = prod.name;
            updated.sackSize = prod.sackSize;
            updated.unitPrice = prod.price;
            updated.totalPrice = multiplyCurrency(Number(updated.plannedQty) || 0, prod.price);
            setTotalStrMap(m => ({ ...m, [id]: String(updated.totalPrice) }));
          }
        }

        return updated;
      })
    );
  };

  const handleQtyChange = (id: string, raw: string) => {
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    setErrorBanner(null);
    setQtyStrMap(prev => ({ ...prev, [id]: raw }));
    const parsedQty = raw === "" ? 0 : parseInt(raw, 10);
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const newTotal = multiplyCurrency(parsedQty, Number(item.unitPrice) || 0);
        setTotalStrMap(tm => ({ ...tm, [id]: String(newTotal) }));
        return { ...item, plannedQty: parsedQty, totalPrice: newTotal };
      })
    );
  };

  const handleQtyBlur = (id: string) => {
    const raw = qtyStrMap[id] ?? "1";
    const parsed = Math.max(1, parseInt(raw, 10) || 1);
    setQtyStrMap(prev => ({ ...prev, [id]: String(parsed) }));
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const newTotal = multiplyCurrency(parsed, Number(item.unitPrice) || 0);
        setTotalStrMap(tm => ({ ...tm, [id]: String(newTotal) }));
        return { ...item, plannedQty: parsed, totalPrice: newTotal };
      })
    );
  };

  const handleTotalChange = (id: string, raw: string) => {
    const cleaned = sanitizePriceTyping(raw);
    if (cleaned === null) return;
    setErrorBanner(null);
    setTotalStrMap(prev => ({ ...prev, [id]: cleaned }));
    const numeric = cleaned === "" || cleaned === "." ? 0 : roundCurrency(parseFloat(cleaned));
    setItems(prev => prev.map(it => (it.id === id ? { ...it, totalPrice: numeric } : it)));
  };

  const handleTotalBlur = (id: string) => {
    const normalized = normalizePriceOnBlur(totalStrMap[id] ?? "0");
    setTotalStrMap(prev => ({ ...prev, [id]: String(normalized) }));
    setItems(prev => prev.map(it => (it.id === id ? { ...it, totalPrice: normalized } : it)));
  };

  const executeDelete = () => {
    if (itemToDelete) {
      setItems(prev => prev.filter(item => item.id !== itemToDelete));
      setItemToDelete(null);
    }
  };

  // Truck Capacity State Calculation
  const selectedTruckCap = capacities.find(c => c.truckId === truckId);
  const allTrucks = DataService.getTrucks();
  const fallbackTruck = allTrucks.find(t => t.id === truckId);
  const maxTruckCap = selectedTruckCap?.sackCapacity ?? fallbackTruck?.capacitySacks ?? 0;
  const availableCap = selectedTruckCap?.remainingCapacity ?? maxTruckCap;
  const isTruckInTransit = selectedTruckCap?.isInTransit ?? false;

  const totalSacksLoaded = items.reduce((acc, row) => acc + (Number(row.plannedQty) || 0), 0);
  const exceedsCapacity = Boolean(truckId && totalSacksLoaded > availableCap);

  const totalCash = sumCurrency(items.filter(i => i.paymentType === "Cash").map(r => r.totalPrice));
  const totalCharge = sumCurrency(items.filter(i => i.paymentType === "Charge Invoice").map(r => r.totalPrice));
  const grandTotal = roundCurrency(totalCash + totalCharge);

  const handleSaveLoadSlip = async () => {
    setErrorBanner(null);
    setSaveSuccessMessage(null);

    if (!truckId) {
      setErrorBanner("Please select a valid Delivery Truck (or register one in Settings).");
      return;
    }
    if (items.length === 0) {
      setErrorBanner("Please add at least one delivery item to the Load Slip.");
      return;
    }
    if (items.some(i => !i.storeName.trim())) {
      setErrorBanner("Every delivery row must have a Store / Customer Name.");
      return;
    }
    if (items.some(i => (Number(i.plannedQty) || 0) <= 0)) {
      setErrorBanner("Every delivery row must have at least 1 sack planned.");
      return;
    }
    if (exceedsCapacity) {
      setErrorBanner(
        `Capacity exceeded: Truck ${truckId} only has ${availableCap} / ${maxTruckCap} sacks remaining for this active shift.`
      );
      return;
    }

    setIsSaving(true);
    try {
      const truck = allTrucks.find(t => t.id === truckId);
      const driver = DataService.getDrivers().find(d => d.id === driverId);

      const newLoadSlip: LoadSlip = {
        id: generateUUID(),
        slipNumber: `LS-${currentDate.replace(/-/g, "")}-${truckId}-${generateUUID().slice(0, 4).toUpperCase()}`,
        idempotencyKey: generateUUID(),
        date: currentDate,
        time: currentTime,
        truckId: truckId,
        truckPlate: truck?.plateNumber || truckId,
        inChargeId: currentUser.id,
        inChargeName: currentUser.name,
        driverId: driver?.id || driverId || "",
        driverName: driver?.name || "Unassigned Driver",
        status: "DISPATCHED",
        totalLoadedSacks: totalSacksLoaded,
        totalDeliveredSacks: 0,
        totalReturnedSacks: 0,
        totalRevenue: grandTotal,
        totalCashRevenue: totalCash,
        totalChargeRevenue: totalCharge,
        items: items.map(item => ({
          ...item,
          unitPrice: roundCurrency(item.unitPrice),
          totalPrice: roundCurrency(item.totalPrice),
          status: "Pending"
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const res = await DataService.dispatchLoadSlip(newLoadSlip);

      if (!res.success) {
        setErrorBanner(res.message);
        await refreshLiveCapacity();
        return;
      }

      setSaveSuccessMessage(res.message);
      await refreshLiveCapacity();
      if (onSavedSuccess && res.loadSlip) onSavedSuccess(res.loadSlip);

      createBlankRow();
      setTimeout(() => setSaveSuccessMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Live Truck Capacity & Mid-Route Warning Strip */}
      {truckId && (
        <div
          className={`rounded-2xl p-4 border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
            exceedsCapacity
              ? "bg-red-50 dark:bg-red-950/50 border-red-400 dark:border-red-800 text-red-900 dark:text-red-200"
              : availableCap === 0
              ? "bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-800 text-amber-900 dark:text-amber-200"
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                exceedsCapacity ? "bg-red-100 text-red-600" : "bg-emerald-100 dark:bg-emerald-900/40 text-[#00875A]"
              }`}
            >
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-sm">
                  Available Capacity ({truckId}): {availableCap} / {maxTruckCap} sacks
                </span>
                {isTruckInTransit && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Currently IN_TRANSIT
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {exceedsCapacity
                  ? `Planned load (${totalSacksLoaded} sacks) exceeds remaining available truck capacity (${availableCap} sacks).`
                  : isTruckInTransit
                  ? `Truck is currently mid-route. Remaining ${availableCap} sacks available for queued loading.`
                  : `After this dispatch: ${Math.max(0, availableCap - totalSacksLoaded)} sacks remaining on ${truckId}.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={refreshLiveCapacity}
            className="min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Capacity
          </button>
        </div>
      )}

      {/* Auto-Prefill Notification Banner */}
      {isPrefilled && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/50 text-[#00875A] dark:text-emerald-300 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-[#00875A] dark:text-emerald-300 text-sm">
                Auto-Filled from Previous Dispatch ({prefilledDate})
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Recurring customers loaded with Pending delivery status. Review quantities before clicking &quot;Save &amp; Dispatch&quot;.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setConfirmClearModal(true)}
            className="min-h-[44px] px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 rounded-xl border border-slate-300 dark:border-slate-600 cursor-pointer shrink-0"
          >
            Clear / Start Blank
          </button>
        </div>
      )}

      {/* Error / Rejection Alert */}
      {errorBanner && (
        <div className="bg-red-50 dark:bg-red-950/70 border-2 border-red-500 rounded-2xl p-4 flex items-center justify-between gap-3 text-red-900 dark:text-red-100 font-bold text-sm shadow-md">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-500 font-black"
          >
            ×
          </button>
        </div>
      )}

      {/* Success Notification Alert */}
      {saveSuccessMessage && (
        <div className="bg-emerald-100 dark:bg-emerald-900/60 border-2 border-emerald-500 rounded-2xl p-4 flex items-center justify-between text-emerald-900 dark:text-emerald-100 font-bold text-sm shadow-md">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-300 shrink-0" />
            <span>{saveSuccessMessage} Synced to driver mobile app &amp; itemized receipts.</span>
          </div>
        </div>
      )}

      {/* Missing Master Data Warning Banner */}
      {(locations.length === 0 || products.length === 0) && (
        <div className="p-5 bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-700 rounded-2xl flex items-start gap-3.5 text-amber-900 dark:text-amber-200 shadow-xs">
          <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold text-base">No Items Found — Setup Required in Settings</h4>
            <p className="text-xs mt-1 text-amber-800 dark:text-amber-300 leading-relaxed">
              {locations.length === 0 && products.length === 0
                ? "No Delivery Hubs or Ice Products found in Supabase. Add both under Settings & Pricing first."
                : locations.length === 0
                ? "No Delivery Hubs found — please add at least one hub in Settings & Pricing."
                : "No Ice Products found — please add products and prices in Settings & Pricing."}
            </p>
          </div>
        </div>
      )}

      {/* Main Delivery Table */}
      <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl overflow-hidden">
        <div className="overflow-x-auto scroll-touch">
          <table className="w-full text-left border-collapse min-w-[1050px]">
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
                <th className="py-3.5 px-4 w-14 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500 text-sm">
                    {locations.length === 0 || products.length === 0
                      ? "No delivery items can be built until Delivery Hubs and Products are added in Settings."
                      : "Click 'Add Another Store Delivery' below to add stops."}
                  </td>
                </tr>
              ) : (
                items.map((row, index) => {
                  const matchingCustomers = customers.filter(c => c.locationId === row.locationId);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/40 transition-colors">
                      <td className="py-3 px-4 text-sm font-semibold text-slate-400 text-center">{index + 1}</td>

                      <td className="py-3 px-2">
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            className="w-full min-h-[44px] px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00875A] font-bold text-base sm:text-sm text-slate-900 dark:text-white"
                            placeholder="Enter store customer name..."
                            value={row.storeName}
                            onChange={(e) => handleUpdateItem(row.id, "storeName", e.target.value)}
                          />
                          {matchingCustomers.length > 0 && (
                            <select
                              className="text-xs text-slate-500 dark:text-slate-400 bg-transparent border-0 cursor-pointer hover:text-[#00875A] font-medium min-h-[32px]"
                              value={row.customerId}
                              onChange={(e) => handleUpdateItem(row.id, "customerId", e.target.value)}
                            >
                              <option value="">Quick pick customer...</option>
                              {matchingCustomers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-2">
                        <select
                          className="w-full min-h-[44px] px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00875A] text-base sm:text-sm text-slate-900 dark:text-white font-medium cursor-pointer"
                          value={row.locationId}
                          onChange={(e) => handleUpdateItem(row.id, "locationId", e.target.value)}
                        >
                          {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3 px-2">
                        <select
                          className="w-full min-h-[44px] px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00875A] text-base sm:text-sm text-slate-900 dark:text-white font-medium cursor-pointer"
                          value={row.iceProductId}
                          onChange={(e) => handleUpdateItem(row.id, "iceProductId", e.target.value)}
                        >
                          {products.map(prod => (
                            <option key={prod.id} value={prod.id}>
                              {formatProductLabel(prod.name, prod.sackSize)} — ₱{formatPhp(prod.price)}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3 px-2 text-center">
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-20 min-h-[44px] px-2.5 py-2 text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00875A] font-bold text-base text-slate-900 dark:text-white"
                          value={qtyStrMap[row.id] ?? String(row.plannedQty)}
                          onChange={(e) => handleQtyChange(row.id, e.target.value)}
                          onBlur={() => handleQtyBlur(row.id)}
                        />
                      </td>

                      <td className="py-3 px-4 bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 font-semibold">
                        ₱ {formatPhp(row.unitPrice)}
                      </td>

                      <td className="py-3 px-2 bg-emerald-50/50 dark:bg-emerald-900/10">
                        <div className="relative flex items-center">
                          <span className="absolute left-2.5 text-emerald-600 dark:text-emerald-400 font-bold">₱</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="w-full min-h-[44px] pl-7 pr-2.5 py-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg font-bold text-base text-emerald-700 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                            value={totalStrMap[row.id] ?? String(row.totalPrice)}
                            onKeyDown={(e) => {
                              if (["-", "+", "e", "E"].includes(e.key)) e.preventDefault();
                            }}
                            onChange={(e) => handleTotalChange(row.id, e.target.value)}
                            onBlur={() => handleTotalBlur(row.id)}
                          />
                        </div>
                      </td>

                      <td className="py-3 px-2">
                        <select
                          className={`w-full min-h-[44px] px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00875A] font-bold cursor-pointer text-base sm:text-sm ${
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

                      <td className="py-3 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => setItemToDelete(row.id)}
                          disabled={items.length === 1}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          title="Remove delivery stop"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 flex flex-wrap justify-between items-center gap-3">
          <button
            type="button"
            disabled={locations.length === 0 || products.length === 0}
            onClick={handleAddRow}
            className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-[#00875A] dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 rounded-xl transition-all cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            Add Another Store Delivery
          </button>

          {!isPrefilled && (
            <button
              type="button"
              onClick={handleReloadYesterday}
              className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Re-load Previous Recurring Stops
            </button>
          )}
        </div>
      </section>

      {/* Grand Total & Primary Dispatch Section */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-8">
        <div className="flex flex-col gap-2 w-full md:w-auto">
          <button
            type="button"
            disabled={isSaving || locations.length === 0 || products.length === 0 || !truckId || exceedsCapacity}
            onClick={handleSaveLoadSlip}
            className="min-h-[56px] w-full md:w-auto flex items-center justify-center gap-3 px-8 sm:px-10 py-4 bg-[#00875A] hover:bg-emerald-700 text-white rounded-2xl font-black text-base sm:text-lg shadow-xl shadow-emerald-900/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Validating Capacity &amp; Dispatching...
              </>
            ) : (
              <>
                <Save className="w-6 h-6" />
                Save &amp; Dispatch Load Slip
              </>
            )}
          </button>
          <span className="text-xs text-slate-500">
            Atomic truck capacity check enforced. Instantly reflects in Driver Mobile App &amp; Invoices.
          </span>
        </div>

        <div className="bg-gradient-to-r from-yellow-400 to-amber-400 rounded-2xl p-6 shadow-xl flex flex-col items-end w-full md:min-w-[340px] md:w-auto text-yellow-950 border border-yellow-300">
          <div className="flex justify-between w-full text-xs font-bold uppercase tracking-wider text-yellow-900 mb-1">
            <span>Total Planned Sacks: <strong>{totalSacksLoaded}</strong></span>
            <span>Grand Total</span>
          </div>
          <span className="text-3xl sm:text-4xl font-black tracking-tight">
            ₱ {formatPhp(grandTotal)}
          </span>
          <div className="flex justify-between w-full text-xs font-extrabold text-yellow-900/90 border-t border-yellow-600/20 pt-2 mt-2">
            <span>Cash: ₱{formatPhp(totalCash)}</span>
            <span>Charge Invoice: ₱{formatPhp(totalCharge)}</span>
          </div>
        </div>
      </section>

      <ConfirmModal
        isOpen={!!itemToDelete}
        onConfirm={executeDelete}
        onCancel={() => setItemToDelete(null)}
        message="Remove this delivery row from the current Load Slip?"
      />

      <ConfirmModal
        isOpen={confirmClearModal}
        onConfirm={handleClearToBlank}
        onCancel={() => setConfirmClearModal(false)}
        message="Clear all auto-filled stops and start with a blank Load Slip?"
      />
    </div>
  );
}
