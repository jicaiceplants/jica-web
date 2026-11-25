"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
import {
  SACK_SIZE_OPTIONS,
  SackSizeOption,
  formatProductLabel,
  normalizeSackSizeOption
} from "@/lib/productUtils";
import { AddLocationModal } from "@/components/AddLocationModal";
import { ImageUploadField, deleteStorageImage } from "@/components/ImageUploadField";
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

  // Add / Edit Product Modal (Restructured: Product Name + Sack Size [Small/Medium/Large] + Price + Photo)
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<IceProduct | null>(null);
  const [prodName, setProdName] = useState("");
  const [prodSackSize, setProdSackSize] = useState<SackSizeOption>("Medium");
  const [prodPriceStr, setProdPriceStr] = useState("0");
  const [prodImageUrl, setProdImageUrl] = useState("");
  const [initialProdImageUrl, setInitialProdImageUrl] = useState("");
  const prodTempUploadsRef = useRef<string[]>([]);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Add / Edit Truck Modal
  const [truckModalOpen, setTruckModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<TruckVehicle | null>(null);
  const [truckIdInput, setTruckIdInput] = useState("");
  const [truckPlate, setTruckPlate] = useState("");
  const [truckModel, setTruckModel] = useState("");
  const [truckCapStr, setTruckCapStr] = useState("120");
  const [truckImageUrl, setTruckImageUrl] = useState("");
  const [initialTruckImageUrl, setInitialTruckImageUrl] = useState("");
  const truckTempUploadsRef = useRef<string[]>([]);
  const [isSavingTruck, setIsSavingTruck] = useState(false);

  // Delivery Hub Add / Edit Modal
  const [hubModalOpen, setHubModalOpen] = useState(false);
  const [editingHub, setEditingHub] = useState<DeliveryLocation | null>(null);

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

    const label = formatProductLabel(prod.name, prod.sackSize);
    if (ok) {
      setProducts(prev => prev.map(p => (p.id === prod.id ? { ...p, price: normalized } : p)));
      setBanner({
        type: "success",
        text: `Updated "${label}" standard price to PHP ${formatPhp(normalized)}.`
      });
    } else {
      setBanner({ type: "error", text: `Failed to save price for "${label}".` });
    }
  };

  const openAddProductModal = () => {
    setEditingProduct(null);
    setProdName("");
    setProdSackSize("Medium");
    setProdPriceStr("0");
    setProdImageUrl("");
    setInitialProdImageUrl("");
    prodTempUploadsRef.current = [];
    setProductModalOpen(true);
  };

  const openEditProductModal = (prod: IceProduct) => {
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdSackSize(normalizeSackSizeOption(prod.sackSize));
    setProdPriceStr(String(prod.price ?? 0));
    setProdImageUrl(prod.imageUrl || "");
    setInitialProdImageUrl(prod.imageUrl || "");
    prodTempUploadsRef.current = [];
    setProductModalOpen(true);
  };

  const closeProductModal = async () => {
    const unused = prodTempUploadsRef.current.filter(u => u && u !== initialProdImageUrl);
    await Promise.all(unused.map(u => deleteStorageImage(u)));
    prodTempUploadsRef.current = [];
    setProductModalOpen(false);
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

    const unused = prodTempUploadsRef.current.filter(
      u => u && u !== prodImageUrl && u !== initialProdImageUrl
    );
    await Promise.all(unused.map(u => deleteStorageImage(u)));
    prodTempUploadsRef.current = [];

    if (editingProduct) {
      const updated = await DataService.updateProduct(editingProduct.id, {
        name: prodName.trim(),
        sackSize: prodSackSize,
        category: prodSackSize,
        price: finalPrice,
        imageUrl: prodImageUrl || ""
      });
      setIsSavingProduct(false);
      if (updated) {
        setProductModalOpen(false);
        await reloadData(false);
        setBanner({
          type: "success",
          text: `Updated product "${formatProductLabel(updated.name, updated.sackSize)}".`
        });
      } else {
        setBanner({ type: "error", text: "Failed to update product." });
      }
    } else {
      const res = await DataService.addProduct({
        name: prodName.trim(),
        sackSize: prodSackSize,
        category: prodSackSize,
        price: finalPrice,
        imageUrl: prodImageUrl || undefined,
        inStock: 0
      });
      setIsSavingProduct(false);
      if (res.success) {
        setProductModalOpen(false);
        await reloadData(false);
        setBanner({
          type: "success",
          text: `Added "${formatProductLabel(prodName.trim(), prodSackSize)}" at PHP ${formatPhp(
            finalPrice
          )}.`
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
    setTruckImageUrl("");
    setInitialTruckImageUrl("");
    truckTempUploadsRef.current = [];
    setTruckModalOpen(true);
  };

  const openEditTruckModal = (trk: TruckVehicle) => {
    setEditingTruck(trk);
    setTruckIdInput(trk.id);
    setTruckPlate(trk.plateNumber);
    setTruckModel(trk.model);
    setTruckCapStr(String(trk.sackCapacity ?? trk.capacitySacks ?? 120));
    setTruckImageUrl(trk.imageUrl || "");
    setInitialTruckImageUrl(trk.imageUrl || "");
    truckTempUploadsRef.current = [];
    setTruckModalOpen(true);
  };

  const closeTruckModal = async () => {
    const unused = truckTempUploadsRef.current.filter(u => u && u !== initialTruckImageUrl);
    await Promise.all(unused.map(u => deleteStorageImage(u)));
    truckTempUploadsRef.current = [];
    setTruckModalOpen(false);
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

    const unused = truckTempUploadsRef.current.filter(
      u => u && u !== truckImageUrl && u !== initialTruckImageUrl
    );
    await Promise.all(unused.map(u => deleteStorageImage(u)));
    truckTempUploadsRef.current = [];

    if (editingTruck) {
      const res = await DataService.updateTruck(editingTruck.id, {
        plateNumber: cleanPlate,
        model: cleanModel,
        capacitySacks: parsedCap,
        sackCapacity: parsedCap,
        imageUrl: truckImageUrl || ""
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
        sackCapacity: parsedCap,
        imageUrl: truckImageUrl || undefined
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

  const handleSaveLocation = async (
    loc: Omit<DeliveryLocation, "id" | "customersCount">,
    existingId?: string
  ) => {
    if (existingId) {
      const res = await DataService.updateLocation(existingId, {
        ...loc,
        imageUrl: loc.imageUrl || ""
      });
      if (!res.success) {
        throw new Error(res.message || "Failed to update delivery hub.");
      }
      await reloadData(false);
      setBanner({ type: "success", text: `Updated Delivery Hub "${loc.name}".` });
    } else {
      const res = await DataService.addLocation(loc);
      if (!res.success) {
        throw new Error(res.message || "Failed to add delivery hub.");
      }
      await reloadData(false);
      setBanner({ type: "success", text: `Saved Delivery Hub "${loc.name}".` });
    }
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
      setBanner({ type: "success", text: `Moved "${label}" to Trash Archive.` });
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
            <span>Products &amp; Pricing ({products.length})</span>
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
            <span>Fleet &amp; Capacities ({trucks.length})</span>
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
          {/* 1. PRODUCTS & PRICING (Name + Sack Size [Small / Medium / Large] + Price + Photo) */}
          {activeTab === "products" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Ice Products &amp; Wholesale Sack Pricing
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure Product Name, Sack Size (Small / Medium / Large), standard unit price (PHP 0.00+ allowed), and photo.
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
                    const formattedTitle = formatProductLabel(prod.name, prod.sackSize);
                    return (
                      <div
                        key={prod.id}
                        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs flex flex-col"
                      >
                        <div className="h-36 bg-slate-100 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                          {prod.imageUrl ? (
                            <img
                              src={prod.imageUrl}
                              alt={formattedTitle}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                          )}
                        </div>

                        <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-[#004D40] dark:text-emerald-300 text-[10px] font-black uppercase">
                                {prod.sackSize || "Standard"}
                              </span>
                              <h4 className="text-base font-black text-slate-900 dark:text-white mt-1 truncate">
                                {formattedTitle}
                              </h4>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openEditProductModal(prod)}
                                aria-label={`Edit ${formattedTitle}`}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                title="Edit Product Details & Photo"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({
                                    kind: "product",
                                    id: prod.id,
                                    label: formattedTitle
                                  })
                                }
                                aria-label={`Delete ${formattedTitle}`}
                                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                                title="Move to Trash"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                            <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                              Standard Price (PHP / sack)
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
                    Fleet Vehicles &amp; Sack Capacity Limits
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manage truck photos, plate numbers, and concurrent active dispatch sack limits.
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
                        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs"
                      >
                        <div className="h-36 bg-slate-100 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                          {trk.imageUrl ? (
                            <img
                              src={trk.imageUrl}
                              alt={`${trk.id} ${trk.plateNumber}`}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Truck className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                          )}
                        </div>

                        <div className="p-5 space-y-3">
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
                                title="Edit Truck, Capacity & Photo"
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. DELIVERY HUBS (With Storefront Photos + Edit/Delete) */}
          {activeTab === "hubs" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Delivery Hubs &amp; Storefront Pins
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manage Cagayan de Oro drop-off hubs, storefront reference photos, and GPS coordinates.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingHub(null);
                    setHubModalOpen(true);
                  }}
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
                      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs"
                    >
                      <div className="h-36 bg-slate-100 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                        {loc.imageUrl ? (
                          <img
                            src={loc.imageUrl}
                            alt={loc.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <MapPin className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                        )}
                      </div>

                      <div className="p-5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-[10px] font-black uppercase">
                              {loc.zone}
                            </span>
                            <h4 className="text-base font-black text-slate-900 dark:text-white mt-1 truncate">
                              {loc.name}
                            </h4>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingHub(loc);
                                setHubModalOpen(true);
                              }}
                              aria-label={`Edit ${loc.name}`}
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                              title="Edit Delivery Hub"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
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
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                              title="Move to Trash"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{loc.address}</p>
                        <div className="text-[11px] font-mono text-slate-400 pt-1">
                          {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ADD / EDIT PRODUCT MODAL (Product Name + Sack Size [Small/Medium/Large] + Price + Photo) */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-[90dvh] overflow-y-auto">
            <div className="p-5 bg-[#004D40] text-white flex items-center justify-between">
              <h3 className="text-lg font-black">
                {editingProduct ? "Edit Ice Product" : "Add New Ice Product"}
              </h3>
              <button
                type="button"
                onClick={closeProductModal}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveProductModal} className="p-5 space-y-4">
              <ImageUploadField
                label="Product Photo (Optional)"
                folder="products"
                value={prodImageUrl}
                onChange={setProdImageUrl}
                onTempUploadCreated={(url) => prodTempUploadsRef.current.push(url)}
                fallbackIcon={<Package className="w-8 h-8" />}
              />

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Tube Ice, Crushed Ice, Block Ice"
                  className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                    Sack Size *
                  </label>
                  <select
                    value={prodSackSize}
                    onChange={(e) => setProdSackSize(e.target.value as SackSizeOption)}
                    className="w-full min-h-[44px] px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm font-bold text-slate-900 dark:text-white"
                  >
                    {SACK_SIZE_OPTIONS.map(sz => (
                      <option key={sz} value={sz}>
                        {sz}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1.5">
                    Price (PHP, &gt;= 0)
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
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200">
                Displays as:{" "}
                <strong>{formatProductLabel(prodName || "Ice Product", prodSackSize)}</strong>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={closeProductModal}
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
                onClick={closeTruckModal}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTruckModal} className="p-5 space-y-4">
              <ImageUploadField
                label="Vehicle Photo (Optional)"
                folder="trucks"
                value={truckImageUrl}
                onChange={setTruckImageUrl}
                onTempUploadCreated={(url) => truckTempUploadsRef.current.push(url)}
                fallbackIcon={<Truck className="w-8 h-8" />}
              />

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
                  onClick={closeTruckModal}
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
        isOpen={hubModalOpen}
        initialLocation={editingHub}
        onClose={() => {
          setHubModalOpen(false);
          setEditingHub(null);
        }}
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
