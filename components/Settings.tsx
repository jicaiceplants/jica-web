"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DataService } from "@/lib/dataService";
import { supabase } from "@/lib/supabaseClient";
import {
  IceProduct,
  TruckVehicle,
  TruckCapacityInfo,
  DeliveryLocation
} from "@/lib/types";
import {
  formatPhp,
  sanitizePriceTyping,
  normalizePriceOnBlur
} from "@/lib/currencyUtils";
import { AddLocationModal } from "@/components/AddLocationModal";
import ConfirmModal from "@/components/ConfirmModal";
import {
  Package,
  Truck,
  MapPin,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Save
} from "lucide-react";

type SettingsTab = "products" | "fleet" | "hubs";

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("products");
  const [products, setProducts] = useState<IceProduct[]>([]);
  const [trucks, setTrucks] = useState<TruckVehicle[]>([]);
  const [capacityList, setCapacityList] = useState<TruckCapacityInfo[]>([]);
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);

  // String price map per product card so typing "", "0", "0." works cleanly without jump/clamp
  const [priceStrMap, setPriceStrMap] = useState<Record<string, string>>({});
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Add / Edit Product Modal
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<IceProduct | null>(null);
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState<IceProduct["category"]>("Tube");
  const [prodSackSize, setProdSackSize] = useState("50 kg");
  const [prodPriceStr, setProdPriceStr] = useState("0");
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Add / Edit Truck Modal
  const [truckModalOpen, setTruckModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<TruckVehicle | null>(null);
  const [truckIdInput, setTruckIdInput] = useState("");
  const [truckPlate, setTruckPlate] = useState("");
  const [truckModel, setTruckModel] = useState("");
  const [truckCapStr, setTruckCapStr] = useState("120");
  const [isSavingTruck, setIsSavingTruck] = useState(false);

  // Delivery Hub Modal
  const [addLocOpen, setAddLocOpen] = useState(false);

  // Confirm Soft Delete Modal
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "product" | "truck" | "location";
    id: string;
    label: string;
  } | null>(null);

  const reloadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      await DataService.fetchLiveFromSupabase();
      const cap = await DataService.fetchTrucksCapacity();
      const prods = DataService.getProducts();
      const trks = DataService.getTrucks();
      const locs = DataService.getLocations();

      setProducts(prods);
      setTrucks(trks);
      setCapacityList(cap);
      setLocations(locs);

      const initialPrices: Record<string, string> = {};
      prods.forEach(p => {
        initialPrices[p.id] = String(p.price ?? 0);
      });
      setPriceStrMap(initialPrices);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    reloadData(false);

    const channel = supabase
      .channel("settings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        reloadData(false);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trucks" }, () => {
        reloadData(false);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_hubs" }, () => {
        reloadData(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reloadData]);

  const handleCardPriceChange = (prodId: string, raw: string) => {
    const valid = sanitizePriceTyping(raw);
    if (valid !== null) {
      setPriceStrMap(prev => ({ ...prev, [prodId]: valid }));
    }
  };

  const handleSaveCardPrice = async (prod: IceProduct) => {
    const raw = priceStrMap[prod.id] ?? String(prod.price ?? 0);
    const normalized = normalizePriceOnBlur(raw);
    setPriceStrMap(prev => ({ ...prev, [prod.id]: String(normalized) }));
    setSavingPriceId(prod.id);
    setBanner(null);

    const ok = await DataService.updateProductPrice(prod.id, normalized);
    setSavingPriceId(null);

    if (ok) {
      setProducts(prev => prev.map(p => (p.id === prod.id ? { ...p, price: normalized } : p)));
      setBanner({
        type: "success",
        text: `Updated "${prod.name}" standard price to PHP ${formatPhp(normalized)}.`
      });
    } else {
      setBanner({ type: "error", text: `Failed to save price for "${prod.name}".` });
    }
  };

  const openAddProductModal = () => {
    setEditingProduct(null);
    setProdName("");
    setProdCategory("Tube");
    setProdSackSize("50 kg");
    setProdPriceStr("0");
    setProductModalOpen(true);
  };

  const openEditProductModal = (prod: IceProduct) => {
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdCategory(prod.category);
    setProdSackSize(prod.sackSize);
    setProdPriceStr(String(prod.price ?? 0));
    setProductModalOpen(true);
  };

  const handleSaveProductModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) {
      setBanner({ type: "error", text: "Product name is required." });
      return;
    }

    const finalPrice = normalizePriceOnBlur(prodPriceStr);
    setIsSavingProduct(true);
    setBanner(null);

    if (editingProduct) {
      const updated = await DataService.updateProduct(editingProduct.id, {
        name: prodName.trim(),
        category: prodCategory,
        sackSize: prodSackSize.trim() || "50 kg",
        price: finalPrice
      });
      setIsSavingProduct(false);
      if (updated) {
        setProductModalOpen(false);
        await reloadData(false);
        setBanner({ type: "success", text: `Updated product "${updated.name}".` });
      } else {
        setBanner({ type: "error", text: "Failed to update product." });
      }
    } else {
      const res = await DataService.addProduct({
        name: prodName.trim(),
        category: prodCategory,
        sackSize: prodSackSize.trim() || "50 kg",
        price: finalPrice,
        inStock: 0
      });
      setIsSavingProduct(false);
      if (res.success) {
        setProductModalOpen(false);
        await reloadData(false);
        setBanner({
          type: "success",
          text: `Added product "${prodName.trim()}" at PHP ${formatPhp(finalPrice)}.`
        });
      } else {
        setBanner({ type: "error", text: res.message || "Unable to add product." });
      }
    }
  };

  const openAddTruckModal = () => {
    setEditingTruck(null);
    setTruckIdInput("");
    setTruckPlate("");
    setTruckModel("");
    setTruckCapStr("120");
    setTruckModalOpen(true);
  };

  const openEditTruckModal = (trk: TruckVehicle) => {
    setEditingTruck(trk);
    setTruckIdInput(trk.id);
    setTruckPlate(trk.plateNumber);
    setTruckModel(trk.model);
    setTruckCapStr(String(trk.sackCapacity ?? trk.capacitySacks ?? 120));
    setTruckModalOpen(true);
  };

  const handleSaveTruckModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = truckIdInput.trim().toUpperCase();
    const cleanPlate = truckPlate.trim().toUpperCase();
    const cleanModel = truckModel.trim();
    const parsedCap = Math.max(1, parseInt(truckCapStr, 10) || 0);

    if (!cleanId || !cleanPlate || !cleanModel) {
      setBanner({ type: "error", text: "Truck Code, Plate Number, and Model are required." });
      return;
    }
    if (parsedCap < 1) {
      setBanner({ type: "error", text: "Sack capacity must be at least 1 sack." });
      return;
    }

    setIsSavingTruck(true);
    setBanner(null);

    if (editingTruck) {
      const res = await DataService.updateTruck(editingTruck.id, {
        plateNumber: cleanPlate,
        model: cleanModel,
        capacitySacks: parsedCap,
        sackCapacity: parsedCap
      });
      setIsSavingTruck(false);
      if (res.success) {
        setTruckModalOpen(false);
        await reloadData(false);
        setBanner({
          type: "success",
          text: `Updated ${editingTruck.id} (${cleanPlate}) capacity to ${parsedCap} sacks.`
        });
      } else {
        setBanner({ type: "error", text: res.message || "Failed to update truck." });
      }
    } else {
      const res = await DataService.addTruck({
        id: cleanId,
        plateNumber: cleanPlate,
        model: cleanModel,
        capacitySacks: parsedCap,
        sackCapacity: parsedCap
      });
      setIsSavingTruck(false);
      if (res.success) {
        setTruckModalOpen(false);
        await reloadData(false);
        setBanner({
          type: "success",
          text: `Added vehicle ${cleanId} (${cleanPlate}) with ${parsedCap} sack capacity.`
        });
      } else {
        setBanner({ type: "error", text: res.message || "Failed to add vehicle." });
      }
    }
  };

  const handleSaveLocation = async (loc: Omit<DeliveryLocation, "id" | "customersCount">) => {
    const res = await DataService.addLocation(loc);
    if (!res.success) {
      throw new Error(res.message || "Failed to add delivery hub.");
    }
    await reloadData(false);
    setBanner({ type: "success", text: `Saved Delivery Hub "${loc.name}".` });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { kind, id, label } = deleteTarget;
    setDeleteTarget(null);
    setBanner(null);

    const staffName = DataService.getCurrentUser()?.name || "Staff";
    let res: { success: boolean; message: string };

    if (kind === "product") {
      res = await DataService.deleteProduct(id, staffName);
    } else if (kind === "truck") {
      res = await DataService.deleteTruck(id, staffName);
    } else {
      res = await DataService.deleteLocation(id, staffName);
    }

    if (res.success) {
      setBanner({ type: "success", text: `Moved "${label}" to 30-day Trash Archive.` });
      await reloadData(false);
    } else {
      setBanner({ type: "error", text: res.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Section Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "products"
                ? "bg-[#004D40] text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Products & Pricing ({products.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("fleet")}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "fleet"
                ? "bg-[#004D40] text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Fleet & Capacities ({trucks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("hubs")}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "hubs"
                ? "bg-[#004D40] text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Delivery Hubs ({locations.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => reloadData(true)}
          disabled={isRefreshing}
          className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Sync All</span>
        </button>
      </div>

      {banner && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
            banner.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
          }`}
        >
          {banner.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-10 text-center text-sm text-slate-500">
          Syncing live inventory, fleet, and hub settings...
        </div>
      ) : (
        <>
          {/* 1. PRODUCTS & PRICING */}
          {activeTab === "products" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Ice Products & Wholesale Rates
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Adjust prices freely (PHP 0.00+ allowed for promos/complimentary sacks). Changes apply to new Load Slips.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddProductModal}
                  className="min-h-[44px] px-4 py-2.5 bg-[#004D40] hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer self-start"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Ice Product</span>
                </button>
              </div>

              {products.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
                  No ice products found. Click &quot;Add Ice Product&quot; to create one.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map(prod => {
                    const inputStr = priceStrMap[prod.id] ?? String(prod.price ?? 0);
                    return (
                      <div
                        key={prod.id}
                        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4 shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-[#004D40] dark:text-emerald-300 text-[10px] font-black uppercase">
                              {prod.category}
                            </span>
                            <h4 className="text-base font-black text-slate-900 dark:text-white mt-1">
                              {prod.name}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Pack Size: {prod.sackSize}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditProductModal(prod)}
                              aria-label={`Edit ${prod.name}`}
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                              title="Edit Product Details"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  kind: "product",
                                  id: prod.id,
                                  label: prod.name
                                })
                              }
                              aria-label={`Delete ${prod.name}`}
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                              title="Move to Trash"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                          <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                            Standard Price (PHP / unit)
                          </label>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                PHP
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={inputStr}
                                onChange={(e) => handleCardPriceChange(prod.id, e.target.value)}
                                onBlur={() => {
                                  const norm = normalizePriceOnBlur(inputStr);
                                  setPriceStrMap(prev => ({ ...prev, [prod.id]: String(norm) }));
                                }}
                                className="w-full min-h-[44px] pl-11 pr-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-base sm:text-sm font-black text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#004D40]"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveCardPrice(prod)}
                              disabled={savingPriceId === prod.id}
                              className="min-w-[44px] min-h-[44px] px-3.5 py-2 bg-[#004D40] hover:bg-emerald-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                            >
                              <Save className="w-4 h-4" />
                              <span>{savingPriceId === prod.id ? "..." : "Save"}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. FLEET & SACK CAPACITIES */}
          {activeTab === "fleet" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Fleet Vehicles & Sack Capacity Limits
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Dispatchers cannot exceed a truck&apos;s maximum sack capacity across concurrent active load slips.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddTruckModal}
                  className="min-h-[44px] px-4 py-2.5 bg-[#004D40] hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer self-start"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Truck</span>
                </button>
              </div>

              {trucks.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
                  No delivery trucks registered. Click &quot;Add Truck&quot; to register one.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trucks.map(trk => {
                    const capInfo = capacityList.find(c => c.truckId === trk.id);
                    const totalCap = capInfo?.sackCapacity ?? trk.sackCapacity ?? trk.capacitySacks ?? 120;
                    const remaining = capInfo?.remainingCapacity ?? totalCap;
                    const used = capInfo?.usedSacks ?? 0;

                    return (
                      <div
                        key={trk.id}
                        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3 shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-black text-[#004D40] dark:text-emerald-300">
                                {trk.id}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                {trk.plateNumber}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                              {trk.model}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditTruckModal(trk)}
                              aria-label={`Edit ${trk.id}`}
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                              title="Edit Truck & Capacity"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({
                                  kind: "truck",
                                  id: trk.id,
                                  label: `${trk.id} (${trk.plateNumber})`
                                })
                              }
                              aria-label={`Delete ${trk.id}`}
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                              title="Move to Trash"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Max Load Capacity</span>
                            <strong className="text-slate-900 dark:text-white">
                              {totalCap} sacks
                            </strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Available Right Now</span>
                            <strong
                              className={
                                remaining === 0
                                  ? "text-red-600"
                                  : "text-emerald-700 dark:text-emerald-400"
                              }
                            >
                              {remaining} / {totalCap} ({used} active)
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. DELIVERY HUBS */}
          {activeTab === "hubs" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Delivery Hubs & Geolocation Pins
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manage drop-off hubs across Cagayan de Oro with fast Google Maps coordinate placement.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddLocOpen(true)}
                  className="min-h-[44px] px-4 py-2.5 bg-[#004D40] hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer self-start"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Delivery Hub</span>
                </button>
              </div>

              {locations.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
                  No delivery hubs registered yet. Click &quot;Add Delivery Hub&quot; to pin your first hub.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {locations.map(loc => (
                    <div
                      key={loc.id}
                      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-2 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-[10px] font-black uppercase">
                            {loc.zone}
                          </span>
                          <h4 className="text-base font-black text-slate-900 dark:text-white mt-1">
                            {loc.name}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              kind: "location",
                              id: loc.id,
                              label: loc.name
                            })
                          }
                          aria-label={`Delete ${loc.name}`}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer shrink-0"
                          title="Move to Trash"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{loc.address}</p>
                      <div className="text-[11px] font-mono text-slate-400 pt-1">
                        {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ADD / EDIT PRODUCT MODAL */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-[90dvh] overflow-y-auto">
            <div className="p-5 bg-[#004D40] text-white flex items-center justify-between">
              <h3 className="text-lg font-black">
                {editingProduct ? `Edit Product` : `Add New Ice Product`}
              </h3>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveProductModal} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="Enter product name"
                  className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value as IceProduct["category"])}
                    className="w-full min-h-[44px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm font-bold text-slate-900 dark:text-white"
                  >
                    <option value="Tube">Tube</option>
                    <option value="Block">Block</option>
                    <option value="Crushed">Crushed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                    Sack / Unit Size
                  </label>
                  <input
                    type="text"
                    value={prodSackSize}
                    onChange={(e) => setProdSackSize(e.target.value)}
                    placeholder="50 kg"
                    className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                  Standard Price (PHP, &gt;= 0)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={prodPriceStr}
                  onChange={(e) => {
                    const clean = sanitizePriceTyping(e.target.value);
                    if (clean !== null) setProdPriceStr(clean);
                  }}
                  onBlur={() => setProdPriceStr(String(normalizePriceOnBlur(prodPriceStr)))}
                  placeholder="0.00"
                  className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm font-black text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="min-h-[44px] px-5 py-2 bg-[#004D40] hover:bg-emerald-900 text-white font-bold text-sm rounded-xl cursor-pointer disabled:opacity-60"
                >
                  {isSavingProduct ? "Saving..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT TRUCK MODAL */}
      {truckModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-[90dvh] overflow-y-auto">
            <div className="p-5 bg-[#004D40] text-white flex items-center justify-between">
              <h3 className="text-lg font-black">
                {editingTruck ? `Edit Vehicle ${editingTruck.id}` : "Register Fleet Vehicle"}
              </h3>
              <button
                type="button"
                onClick={() => setTruckModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTruckModal} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                  Truck Code *
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingTruck)}
                  value={truckIdInput}
                  onChange={(e) => setTruckIdInput(e.target.value)}
                  placeholder="Enter unique truck code"
                  className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm font-mono uppercase text-slate-900 dark:text-white disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                  Plate Number *
                </label>
                <input
                  type="text"
                  required
                  value={truckPlate}
                  onChange={(e) => setTruckPlate(e.target.value)}
                  placeholder="Enter license plate"
                  className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm uppercase text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                  Vehicle Model *
                </label>
                <input
                  type="text"
                  required
                  value={truckModel}
                  onChange={(e) => setTruckModel(e.target.value)}
                  placeholder="Enter truck make / model"
                  className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                  Maximum Sack Capacity *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={truckCapStr}
                  onChange={(e) => {
                    if (/^\d*$/.test(e.target.value)) setTruckCapStr(e.target.value);
                  }}
                  placeholder="120"
                  className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm font-black text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setTruckModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTruck}
                  className="min-h-[44px] px-5 py-2 bg-[#004D40] hover:bg-emerald-900 text-white font-bold text-sm rounded-xl cursor-pointer disabled:opacity-60"
                >
                  {isSavingTruck ? "Saving..." : "Save Vehicle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AddLocationModal
        isOpen={addLocOpen}
        onClose={() => setAddLocOpen(false)}
        onSave={handleSaveLocation}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Move Item to Trash?"
        message={`Move "${deleteTarget?.label}" to the 30-day Trash Archive?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default Settings;
