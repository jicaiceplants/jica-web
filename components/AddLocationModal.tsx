"use client";

import React, { useState, useEffect, useRef } from "react";
import { DeliveryLocation } from "@/lib/types";
import { CDO_MAP_CENTER } from "@/lib/constants";
import { GoogleMapPicker } from "@/components/GoogleMapPicker";
import { ImageUploadField, deleteStorageImage } from "@/components/ImageUploadField";
import { MapPin, Search, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLocation?: DeliveryLocation | null;
  onSave: (
    loc: Omit<DeliveryLocation, "id" | "customersCount">,
    existingId?: string
  ) => Promise<void> | void;
}

interface PlaceSearchResult {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const SEARCH_CACHE_KEY = "jica_place_search_cache_v1";

function readCachedSearch(query: string): PlaceSearchResult[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Record<string, PlaceSearchResult[]>;
    return obj[query.toLowerCase()] || null;
  } catch {
    return null;
  }
}

function writeCachedSearch(query: string, results: PlaceSearchResult[]): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY);
    const obj = raw ? (JSON.parse(raw) as Record<string, PlaceSearchResult[]>) : {};
    const keys = Object.keys(obj);
    if (keys.length > 60) delete obj[keys[0]];
    obj[query.toLowerCase()] = results;
    localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

export function AddLocationModal({
  isOpen,
  onClose,
  initialLocation,
  onSave
}: AddLocationModalProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [zone, setZone] = useState<DeliveryLocation["zone"]>("City Proper");
  const [lat, setLat] = useState<number>(CDO_MAP_CENTER.lat);
  const [lng, setLng] = useState<number>(CDO_MAP_CENTER.lng);
  const [zoom, setZoom] = useState<number>(14);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [initialImageUrl, setInitialImageUrl] = useState<string>("");
  const tempUploadsRef = useRef<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialLocation) {
        setName(initialLocation.name || "");
        setAddress(initialLocation.address || "");
        setZone(initialLocation.zone || "City Proper");
        setLat(initialLocation.latitude ?? CDO_MAP_CENTER.lat);
        setLng(initialLocation.longitude ?? CDO_MAP_CENTER.lng);
        setZoom(16);
        setImageUrl(initialLocation.imageUrl || "");
        setInitialImageUrl(initialLocation.imageUrl || "");
      } else {
        setName("");
        setAddress("");
        setZone("City Proper");
        setLat(CDO_MAP_CENTER.lat);
        setLng(CDO_MAP_CENTER.lng);
        setZoom(14);
        setImageUrl("");
        setInitialImageUrl("");
      }
      tempUploadsRef.current = [];
      setSearchQuery("");
      setSearchResults([]);
      setErrorMsg(null);
      setIsSaving(false);
    }
  }, [isOpen, initialLocation]);

  // Google Cloud Free-Tier Protection: Search fires ONLY on explicit button click or Enter key (NEVER per keystroke)
  const handleManualSearch = async () => {
    const clean = searchQuery.trim();
    if (!clean) return;
    setErrorMsg(null);

    const cached = readCachedSearch(clean);
    if (cached && cached.length > 0) {
      setSearchResults(cached);
      return;
    }

    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === "your_google_maps_api_key_here") {
      setErrorMsg("Google Maps API key not configured.");
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location"
        },
        body: JSON.stringify({
          textQuery: `${clean} Cagayan de Oro Philippines`,
          locationBias: {
            circle: {
              center: { latitude: CDO_MAP_CENTER.lat, longitude: CDO_MAP_CENTER.lng },
              radius: 35000.0
            }
          },
          maxResultCount: 5
        })
      });

      if (res.ok) {
        const data = await res.json();
        const mapped: PlaceSearchResult[] = (data.places || [])
          .filter((p: any) => p.location)
          .map((p: any) => ({
            id: p.id,
            title: p.displayName?.text || clean,
            address: p.formattedAddress || "",
            lat: Number(p.location.latitude),
            lng: Number(p.location.longitude)
          }));
        setSearchResults(mapped);
        if (mapped.length > 0) {
          writeCachedSearch(clean, mapped);
          const first = mapped[0];
          setLat(Number(first.lat.toFixed(6)));
          setLng(Number(first.lng.toFixed(6)));
          setZoom(17);
          if (!name.trim()) setName(first.title);
          if (first.address) setAddress(first.address);
        } else {
          setErrorMsg("No matching place found. Drag the pin directly on the map.");
        }
      }
    } catch {
      setErrorMsg("Unable to reach search API. Drag the map pin directly instead.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (item: PlaceSearchResult) => {
    setSearchResults([]);
    setLat(Number(item.lat.toFixed(6)));
    setLng(Number(item.lng.toFixed(6)));
    setZoom(17);
    if (!name.trim()) setName(item.title);
    if (item.address) setAddress(item.address);
  };

  const handlePinChange = (newLat: number, newLng: number, reverseGeocodedAddress?: string) => {
    setLat(newLat);
    setLng(newLng);
    if (reverseGeocodedAddress) {
      setAddress(reverseGeocodedAddress);
    }
  };

  const handleClose = async () => {
    const unusedTemps = tempUploadsRef.current.filter(url => url && url !== initialImageUrl);
    await Promise.all(unusedTemps.map(url => deleteStorageImage(url)));
    tempUploadsRef.current = [];
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Please enter a Hub / Area Name.");
      return;
    }

    setIsSaving(true);
    try {
      const unusedTemps = tempUploadsRef.current.filter(
        url => url && url !== imageUrl && url !== initialImageUrl
      );
      await Promise.all(unusedTemps.map(url => deleteStorageImage(url)));
      tempUploadsRef.current = [];

      await onSave(
        {
          name: name.trim(),
          address: address.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}, Cagayan de Oro`,
          latitude: lat,
          longitude: lng,
          zone,
          imageUrl: imageUrl || undefined
        },
        initialLocation?.id
      );

      if (initialLocation?.id && initialImageUrl && initialImageUrl !== imageUrl) {
        await deleteStorageImage(initialImageUrl);
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save delivery hub.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden max-h-[90dvh] overflow-y-auto scroll-touch">
        <div className="p-5 bg-[#004D40] text-white flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-5 h-5 text-emerald-300" />
            <div>
              <h3 className="text-lg font-black">
                {initialLocation ? "Edit Delivery Hub" : "Add New Delivery Hub"}
              </h3>
              <p className="text-xs text-emerald-100">
                Pin exact GPS location and attach an optional storefront / hub reference photo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Hub / Place Photo Upload */}
          <ImageUploadField
            label="Delivery Hub / Storefront Photo (Optional)"
            folder="hubs"
            value={imageUrl}
            onChange={setImageUrl}
            onTempUploadCreated={(url) => tempUploadsRef.current.push(url)}
            fallbackIcon={<MapPin className="w-8 h-8" />}
          />

          {/* Explicit Manual Google Places Search (Zero Per-Keystroke API Requests) */}
          <div className="relative">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Find Place / Street on Map (Manual Search)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleManualSearch();
                    }
                  }}
                  placeholder="Type street or landmark, then tap Search Map..."
                  className="w-full min-h-[44px] pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#004D40]"
                />
              </div>
              <button
                type="button"
                onClick={handleManualSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Search Map</span>
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-44 overflow-y-auto">
                {searchResults.map(resItem => (
                  <button
                    key={resItem.id}
                    type="button"
                    onClick={() => handleSelectResult(resItem)}
                    className="w-full min-h-[44px] text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 border-b last:border-b-0 border-slate-100 dark:border-slate-700 text-xs cursor-pointer"
                  >
                    <div className="font-bold text-slate-900 dark:text-white">{resItem.title}</div>
                    {resItem.address && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {resItem.address}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <GoogleMapPicker lat={lat} lng={lng} zoom={zoom} onPinChange={handlePinChange} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Delivery Hub Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter customer area or hub name"
                className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#004D40]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Zone Classification
              </label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value as DeliveryLocation["zone"])}
                className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#004D40]"
              >
                <option value="City Proper">City Proper</option>
                <option value="Lapasan/Gusa Corridor">Lapasan/Gusa Corridor</option>
                <option value="Uptown CDO">Uptown CDO</option>
                <option value="Market District">Market District</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Street Address / Landmark Notes
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Auto-filled after pin drop or type street details"
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#004D40]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              className="min-h-[44px] px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[44px] px-6 py-2.5 bg-[#004D40] hover:bg-emerald-900 text-white font-black text-sm rounded-xl shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? "Saving Hub..." : "Save Delivery Hub"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
