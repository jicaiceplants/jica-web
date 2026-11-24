"use client";

import { useState, useEffect, useRef } from "react";
import { IceProduct, DeliveryLocation, TruckVehicle } from "@/lib/types";
import { DataService } from "@/lib/dataService";
import { supabase } from "@/lib/supabaseClient";
import { compressImage } from "@/lib/imageUtils";
import { 
  Save, 
  Plus, 
  Trash2, 
  MapPin, 
  ShieldCheck, 
  FileText, 
  Check, 
  AlertCircle, 
  Truck, 
  Package, 
  Upload, 
  X, 
  Layers 
} from "lucide-react";
import ConfirmModal from "./ConfirmModal";
import AddLocationModal from "./AddLocationModal";
import ComplianceModal from "./ComplianceModal";

export default function Settings() {
  const [products, setProducts] = useState<IceProduct[]>([]);
  const [trucks, setTrucks] = useState<TruckVehicle[]>([]);
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);

  // Modals & Triggers
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddTruckOpen, setIsAddTruckOpen] = useState(false);
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [isComplianceOpen, setIsComplianceOpen] = useState(false);
  const [complianceTab, setComplianceTab] = useState<"privacy" | "terms" | "gps">("privacy");

  // Deletion targets
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [truckToDelete, setTruckToDelete] = useState<string | null>(null);
  const [locationToDelete, setLocationToDelete] = useState<string | null>(null);

  const [saveSuccess, setSaveSuccess] = useState(false);

  // Add Product Form State
  const [newProdName, setNewProdName] = useState("");
  const [newProdCategory, setNewProdCategory] = useState<"Tube" | "Block" | "Crushed">("Tube");
  const [newProdSackSize, setNewProdSackSize] = useState("50kg Big Sack");
  const [newProdPrice, setNewProdPrice] = useState(150);
  const [newProdPhoto, setNewProdPhoto] = useState("");
  const [prodFormError, setProdFormError] = useState("");
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  const prodFileInputRef = useRef<HTMLInputElement>(null);

  // Add Truck Form State
  const [newTruckId, setNewTruckId] = useState("");
  const [newTruckPlate, setNewTruckPlate] = useState("");
  const [newTruckModel, setNewTruckModel] = useState("Isuzu Elf (6-Wheeler Closed)");
  const [newTruckCapacity, setNewTruckCapacity] = useState(120);
  const [newTruckPhoto, setNewTruckPhoto] = useState("");
  const [truckFormError, setTruckFormError] = useState("");
  const [isSubmittingTruck, setIsSubmittingTruck] = useState(false);
  const truckFileInputRef = useRef<HTMLInputElement>(null);

  const reloadData = async () => {
    // 1. Initial cached values
    setProducts(DataService.getProducts());
    setTrucks(DataService.getTrucks());
    setLocations(DataService.getLocations());

    // 2. Fetch live from Supabase PostgreSQL (deleted_at IS NULL AND is_active = true)
    try {
      const [hubsRes, prodsRes, trucksRes] = await Promise.all([
        supabase
          .from("delivery_hubs")
          .select("*")
          .is("deleted_at", null)
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("products")
          .select("*")
          .is("deleted_at", null)
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("trucks")
          .select("*")
          .is("deleted_at", null)
          .eq("is_active", true)
          .order("truck_code", { ascending: true })
      ]);

      if (!hubsRes.error && hubsRes.data) {
        const mappedLocations: DeliveryLocation[] = hubsRes.data.map(h => ({
          id: h.id,
          name: h.name,
          address: h.address,
          latitude: Number(h.latitude),
          longitude: Number(h.longitude),
          zone: "City Proper" as const
        }));
        setLocations(mappedLocations);
        localStorage.setItem("jica_locations", JSON.stringify(mappedLocations));
      }

      if (!prodsRes.error && prodsRes.data && prodsRes.data.length > 0) {
        const mappedProducts: IceProduct[] = prodsRes.data.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category as any,
          sackSize: p.sack_size || "Standard",
          price: Number(p.price_per_sack || 0),
          inStock: 500,
          imageUrl: p.photo_url || undefined
        }));
        setProducts(mappedProducts);
        localStorage.setItem("jica_products", JSON.stringify(mappedProducts));
      }

      if (!trucksRes.error && trucksRes.data && trucksRes.data.length > 0) {
        const mappedTrucks: TruckVehicle[] = trucksRes.data.map(t => ({
          id: t.truck_code,
          plateNumber: t.plate_number,
          model: t.model || "Isuzu Elf",
          capacitySacks: t.capacity_sacks || 120,
          status: "Available" as const
        }));
        setTrucks(mappedTrucks);
        localStorage.setItem("jica_trucks", JSON.stringify(mappedTrucks));
      }
    } catch (e) {
      console.warn("Settings live sync notice:", e);
    }
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleUpdatePrice = (id: string, newPrice: number) => {
    setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, price: newPrice } : p))
    );
  };

  const handleSaveAll = () => {
    products.forEach(p => {
      DataService.updateProductPrice(p.id, p.price);
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // --- PRODUCT MANAGEMENT ---
  const handleProductPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setProdFormError("");
      const compressed = await compressImage(file, 600, 0.8);
      setNewProdPhoto(compressed);
    } catch (err: any) {
      setProdFormError(err.message || "Failed to process product image.");
    }
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) {
      setProdFormError("Product Name is required.");
      return;
    }
    if (newProdPrice <= 0) {
      setProdFormError("Price must be greater than ₱0.");
      return;
    }

    setIsSubmittingProduct(true);
    try {
      DataService.addProduct({
        name: newProdName.trim(),
        category: newProdCategory,
        sackSize: newProdSackSize.trim() || "Standard",
        price: newProdPrice,
        inStock: 500,
        imageUrl: newProdPhoto || undefined
      });

      setIsAddProductOpen(false);
      setNewProdName("");
      setNewProdPrice(150);
      setNewProdPhoto("");
      setProdFormError("");
      reloadData();
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  const executeDeleteProduct = () => {
    if (productToDelete) {
      DataService.deleteProduct(productToDelete);
      reloadData();
      setProductToDelete(null);
    }
  };

  // --- TRUCK MANAGEMENT ---
  const handleTruckPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setTruckFormError("");
      const compressed = await compressImage(file, 600, 0.8);
      setNewTruckPhoto(compressed);
    } catch (err: any) {
      setTruckFormError(err.message || "Failed to process truck image.");
    }
  };

  const handleCreateTruck = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = newTruckId.trim().toUpperCase();
    const cleanPlate = newTruckPlate.trim().toUpperCase();

    if (!cleanId || !cleanPlate) {
      setTruckFormError("Truck ID and Plate Number are required.");
      return;
    }

    setIsSubmittingTruck(true);
    try {
      DataService.addTruck({
        id: cleanId,
        plateNumber: cleanPlate,
        model: newTruckModel.trim() || "Isuzu Elf",
        capacitySacks: newTruckCapacity || 120,
        imageUrl: newTruckPhoto || undefined,
        status: "Available"
      });

      setIsAddTruckOpen(false);
      setNewTruckId("");
      setNewTruckPlate("");
      setNewTruckPhoto("");
      setTruckFormError("");
      reloadData();
    } finally {
      setIsSubmittingTruck(false);
    }
  };

  const executeDeleteTruck = () => {
    if (truckToDelete) {
      DataService.deleteTruck(truckToDelete);
      reloadData();
      setTruckToDelete(null);
    }
  };

  // --- LOCATION MANAGEMENT ---
  const handleSaveLocation = async (newLoc: Omit<DeliveryLocation, "id" | "customersCount">) => {
    DataService.addLocation(newLoc);
    await reloadData();
  };

  const executeDeleteLocation = async () => {
    if (locationToDelete) {
      DataService.deleteLocation(locationToDelete);
      setLocationToDelete(null);
      await reloadData();
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            System & Operations Settings
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage product catalog, wholesale rates, delivery fleet vehicles, and delivery location hubs.
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          className="flex items-center gap-2 px-8 py-3 bg-[#FFD700] hover:bg-yellow-400 text-yellow-950 rounded-xl font-black shadow-lg hover:shadow-xl transition-all uppercase tracking-wider text-sm shrink-0"
        >
          {saveSuccess ? (
            <>
              <Check className="w-5 h-5 text-emerald-800" />
              Settings Saved!
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save All Settings
            </>
          )}
        </button>
      </div>

      {/* ICE PRODUCT CATALOG & PRICING */}
      <section className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-slate-200 dark:border-slate-700 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-[#00875A]" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Ice Products & Standard Pricing
              </h3>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              Commercial ice types, sack packaging, and standard base prices.
            </p>
          </div>

          <button
            onClick={() => {
              setProdFormError("");
              setIsAddProductOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#00875A] hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Ice Product
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.length === 0 ? (
            <div className="col-span-full py-12 px-6 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-[#00875A] flex items-center justify-center mb-4">
                <Package className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">No Ice Products in Catalog Yet</h4>
              <p className="text-sm text-slate-500 max-w-md mt-1 mb-5">
                Your commercial catalog is currently empty. Click &quot;Add Ice Product&quot; to define your commercial ice types, sack packaging, and base pricing (e.g., Tube Ice - 50kg Big Sack @ ₱150).
              </p>
              <button
                onClick={() => {
                  setProdFormError("");
                  setIsAddProductOpen(true);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#00875A] hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md text-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Create First Ice Product
              </button>
            </div>
          ) : (
            products.map((item) => (
            <div
              key={item.id}
              className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col justify-between bg-slate-50 dark:bg-slate-900 gap-4 group relative"
            >
              {/* Delete Button */}
              <button
                onClick={() => setProductToDelete(item.id)}
                className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100 z-10"
                title="Delete product"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Product Photo / Fallback Container */}
              <div className="w-full aspect-16/10 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center relative border border-slate-200 dark:border-slate-700">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : null}
                <div className={`w-full h-full flex flex-col items-center justify-center text-slate-400 ${item.imageUrl ? "hidden" : "flex"}`}>
                  <Package className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider mt-1">No Photo</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 text-[#00875A] dark:text-emerald-300 rounded-full">
                  {item.category} Ice
                </span>
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white mt-2 truncate">
                  {item.name}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Package: <strong>{item.sackSize}</strong>
                </p>
              </div>

              <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Base Price (PHP)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-400 font-bold">₱</span>
                  <input
                    type="number"
                    min="10"
                    step="5"
                    value={item.price}
                    onChange={(e) => handleUpdatePrice(item.id, parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:outline-hidden focus:border-[#00875A] text-slate-900 dark:text-white font-extrabold text-lg"
                  />
                </div>
              </div>
            </div>
          )))}
        </div>
      </section>

      {/* FLEET TRUCKS & DELIVERY VEHICLES */}
      <section className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-slate-200 dark:border-slate-700 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Delivery Fleet Vehicles
              </h3>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              Active JICA delivery trucks, plate numbers, and sack capacity. Add new trucks as your fleet grows.
            </p>
          </div>

          <button
            onClick={() => {
              setTruckFormError("");
              setIsAddTruckOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Delivery Truck
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trucks.length === 0 ? (
            <div className="col-span-full py-12 px-6 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center mb-4">
                <Truck className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">No Fleet Vehicles Registered Yet</h4>
              <p className="text-sm text-slate-500 max-w-md mt-1 mb-5">
                No delivery vehicles are registered in the fleet. Click &quot;Add Delivery Truck&quot; to register your trucks and sack capacities (e.g., TRK-01 / ABC-1234, Isuzu Elf).
              </p>
              <button
                onClick={() => {
                  setTruckFormError("");
                  setIsAddTruckOpen(true);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md text-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Register First Delivery Truck
              </button>
            </div>
          ) : (
            trucks.map((truck) => (
            <div
              key={truck.id}
              className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 bg-slate-50 dark:bg-slate-900 flex flex-col justify-between group relative"
            >
              {/* Delete Button */}
              <button
                onClick={() => setTruckToDelete(truck.id)}
                className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100 z-10"
                title="Remove truck"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Truck Photo */}
              <div className="w-full aspect-16/10 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center relative border border-slate-200 dark:border-slate-700 mb-3">
                {truck.imageUrl ? (
                  <img
                    src={truck.imageUrl}
                    alt={truck.id}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : null}
                <div className={`w-full h-full flex flex-col items-center justify-center text-slate-400 ${truck.imageUrl ? "hidden" : "flex"}`}>
                  <Truck className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Vehicle Photo</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black font-mono px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-md">
                    {truck.id}
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md">
                    {truck.plateNumber}
                  </span>
                </div>

                <h4 className="font-extrabold text-base text-slate-900 dark:text-white mt-2">
                  {truck.model}
                </h4>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                <span>Capacity:</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">{truck.capacitySacks} Sacks</span>
              </div>
            </div>
          )))}
        </div>
      </section>

      {/* DELIVERY HUBS & LOCATION PICKER */}
      <section className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-slate-200 dark:border-slate-700 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#00875A]" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Cagayan de Oro Delivery Location Hubs
              </h3>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              Commercial hubs and malls where multiple store deliveries are grouped under 1 pin.
            </p>
          </div>

          <button
            onClick={() => setIsAddLocationOpen(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#00875A] hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Delivery Hub
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.length === 0 ? (
            <div className="col-span-full py-12 px-6 flex flex-col items-center justify-center text-center bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-[#00875A] flex items-center justify-center mb-4">
                <MapPin className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">No Delivery Hubs Defined Yet</h4>
              <p className="text-sm text-slate-500 max-w-md mt-1 mb-5">
                No delivery location hubs are mapped yet. Click &quot;Add Delivery Hub&quot; to pick drop-off locations across Cagayan de Oro on Google Maps.
              </p>
              <button
                onClick={() => setIsAddLocationOpen(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#00875A] hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md text-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Add First Delivery Hub
              </button>
            </div>
          ) : (
            locations.map((loc) => (
            <div
              key={loc.id}
              className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col justify-between group hover:border-[#00875A] transition-colors"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-base">
                    <MapPin className="w-4 h-4 text-[#00875A] shrink-0" />
                    <span>{loc.name}</span>
                  </div>
                  <button
                    onClick={() => setLocationToDelete(loc.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove location"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {loc.address}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-[11px] font-mono text-slate-400">
                <span>{loc.zone}</span>
                <span>{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</span>
              </div>
            </div>
          )))}
        </div>
      </section>

      {/* INTERNAL COMPLIANCE & LEGAL POLICIES (RA 10173) */}
      <section className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#00875A]" />
            Internal Privacy, Terms & Shift-Only GPS Consent
          </h3>
          <p className="text-slate-500 text-xs mt-1">
            Governed under the Philippine Data Privacy Act (RA 10173). Accessible by all staff and drivers.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setComplianceTab("privacy");
              setIsComplianceOpen(true);
            }}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
          >
            Privacy Notice
          </button>
          <button
            onClick={() => {
              setComplianceTab("terms");
              setIsComplianceOpen(true);
            }}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
          >
            Acceptable Use Terms
          </button>
          <button
            onClick={() => {
              setComplianceTab("gps");
              setIsComplianceOpen(true);
            }}
            className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold text-[#00875A] dark:text-emerald-300 transition-colors"
          >
            Shift-Only GPS Consent
          </button>
        </div>
      </section>

      {/* Add Ice Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Add New Ice Product
              </h3>
              <button
                onClick={() => setIsAddProductOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6 flex flex-col gap-4">
              {prodFormError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{prodFormError}</span>
                </div>
              )}

              {/* Product Photo Device Upload */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-800 shrink-0 flex items-center justify-center relative">
                  {newProdPhoto ? (
                    <img src={newProdPhoto} alt="Product" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Product Picture
                  </span>
                  <input
                    ref={prodFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProductPhotoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => prodFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00875A] hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Photo
                  </button>
                  <p className="text-[11px] text-slate-400">
                    Compressed to &lt;80 KB for zero-overage storage.
                  </p>
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder='e.g. Tube Ice (Big Sack), Block Ice...'
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-sm focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
                />
              </div>

              {/* Category & Sack/Unit Size */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Ice Category
                  </label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold text-sm focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
                  >
                    <option value="Tube">Tube Ice</option>
                    <option value="Block">Block Ice</option>
                    <option value="Crushed">Crushed Ice</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Sack / Unit Size
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 50kg Big Sack, 25kg"
                    value={newProdSackSize}
                    onChange={(e) => setNewProdSackSize(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-sm focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
                  />
                </div>
              </div>

              {/* Base Price */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Base Price (PHP) <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-400 font-bold">₱</span>
                  <input
                    type="number"
                    min="1"
                    step="5"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-[#00875A]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 mt-2">
                <button
                  type="button"
                  disabled={isSubmittingProduct}
                  onClick={() => setIsAddProductOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProduct}
                  className="px-6 py-2.5 rounded-xl bg-[#00875A] hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2"
                >
                  {isSubmittingProduct ? "Saving Product..." : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Truck Modal */}
      {isAddTruckOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                Add New Delivery Truck
              </h3>
              <button
                onClick={() => setIsAddTruckOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTruck} className="p-6 flex flex-col gap-4">
              {truckFormError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{truckFormError}</span>
                </div>
              )}

              {/* Truck Photo Upload */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <div className="w-20 h-20 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-800 shrink-0 flex items-center justify-center relative">
                  {newTruckPhoto ? (
                    <img src={newTruckPhoto} alt="Truck" className="w-full h-full object-cover" />
                  ) : (
                    <Truck className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Vehicle Photo
                  </span>
                  <input
                    ref={truckFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleTruckPhotoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => truckFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Photo
                  </button>
                  <p className="text-[11px] text-slate-400">
                    Compressed image for vehicle catalog.
                  </p>
                </div>
              </div>

              {/* Truck Code and Plate Number */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Truck ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TRK-04"
                    value={newTruckId}
                    onChange={(e) => setNewTruckId(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Plate Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KAD 5521"
                    value={newTruckPlate}
                    onChange={(e) => setNewTruckPlate(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600 uppercase"
                  />
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Vehicle Model
                </label>
                <input
                  type="text"
                  placeholder="e.g. Isuzu Elf 14ft Aluminum Van"
                  value={newTruckModel}
                  onChange={(e) => setNewTruckModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Sack Capacity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Max Sack Capacity
                </label>
                <input
                  type="number"
                  min="20"
                  max="500"
                  value={newTruckCapacity}
                  onChange={(e) => setNewTruckCapacity(parseInt(e.target.value) || 100)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 mt-2">
                <button
                  type="button"
                  disabled={isSubmittingTruck}
                  onClick={() => setIsAddTruckOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTruck}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2"
                >
                  {isSubmittingTruck ? "Registering Truck..." : "Add Truck"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Location Modal */}
      <AddLocationModal
        isOpen={isAddLocationOpen}
        onClose={() => setIsAddLocationOpen(false)}
        onSave={handleSaveLocation}
      />

      {/* Delete Product Confirmation Modal */}
      <ConfirmModal
        isOpen={!!productToDelete}
        onConfirm={executeDeleteProduct}
        onCancel={() => setProductToDelete(null)}
        message="Are you sure you want to delete this ice product? This will remove it from future Load Slip options."
      />

      {/* Delete Truck Confirmation Modal */}
      <ConfirmModal
        isOpen={!!truckToDelete}
        onConfirm={executeDeleteTruck}
        onCancel={() => setTruckToDelete(null)}
        message="Are you sure you want to remove this delivery truck from the active fleet?"
      />

      {/* Delete Delivery Location Confirmation Modal */}
      <ConfirmModal
        isOpen={!!locationToDelete}
        onConfirm={executeDeleteLocation}
        onCancel={() => setLocationToDelete(null)}
        message="Are you sure you want to remove this delivery hub location?"
      />

      {/* Compliance Policies Modal */}
      <ComplianceModal
        isOpen={isComplianceOpen}
        onClose={() => setIsComplianceOpen(false)}
        defaultTab={complianceTab}
      />
    </div>
  );
}
