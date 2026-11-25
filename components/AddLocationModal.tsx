"use client";

import React, { useState, useEffect, useRef } from "react";
import { DeliveryLocation } from "@/lib/types";
import { CDO_MAP_CENTER } from "@/lib/constants";
import { GoogleMapPicker } from "@/components/GoogleMapPicker";
import { MapPin, Search, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (loc: Omit<DeliveryLocation, "id" | "customersCount">) => Promise<void> | void;
}

interface PlaceSuggestion {
  placeId: string;
  title: string;
  subtitle: string;
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export function AddLocationModal({ isOpen, onClose, onSave }: AddLocationModalProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [zone, setZone] = useState<DeliveryLocation["zone"]>("City Proper");
  const [lat, setLat] = useState<number>(CDO_MAP_CENTER.lat);
  const [lng, setLng] = useState<number>(CDO_MAP_CENTER.lng);
  const [zoom, setZoom] = useState<number>(14);

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setAddress("");
      setZone("City Proper");
      setLat(CDO_MAP_CENTER.lat);
      setLng(CDO_MAP_CENTER.lng);
      setZoom(14);
      setSearchQuery("");
      setSuggestions([]);
      setErrorMsg(null);
      setIsSaving(false);
    }
  }, [isOpen]);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setErrorMsg(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text.trim() || text.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === "your_google_maps_api_key_here") {
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY
          },
          body: JSON.stringify({
            input: text.trim(),
            locationBias: {
              circle: {
                center: { latitude: CDO_MAP_CENTER.lat, longitude: CDO_MAP_CENTER.lng },
                radius: 35000.0
              }
            },
            includedRegionCodes: ["ph"]
          })
        });

        if (res.ok) {
          const data = await res.json();
          const mapped: PlaceSuggestion[] = (data.suggestions || [])
            .map((s: any) => s.placePrediction)
            .filter(Boolean)
            .map((p: any) => ({
              placeId: p.placeId,
              title: p.structuredFormat?.mainText?.text || p.text?.text || "Place",
              subtitle: p.structuredFormat?.secondaryText?.text || ""
            }));
          setSuggestions(mapped);
        }
      } catch {
        // Ignore autocomplete transient error
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
    setSuggestions([]);
    setSearchQuery(suggestion.title);
    if (!GOOGLE_MAPS_API_KEY) return;

    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(suggestion.placeId)}`,
        {
          headers: {
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
            "X-Goog-FieldMask": "id,displayName,formattedAddress,location"
          }
        }
      );
      if (res.ok) {
        const detail = await res.json();
        const newLat = Number(detail.location?.latitude);
        const newLng = Number(detail.location?.longitude);
        if (Number.isFinite(newLat) && Number.isFinite(newLng)) {
          setLat(Number(newLat.toFixed(6)));
          setLng(Number(newLng.toFixed(6)));
          setZoom(17);
        }
        if (!name.trim() && detail.displayName?.text) {
          setName(detail.displayName.text);
        }
        if (detail.formattedAddress) {
          setAddress(detail.formattedAddress);
        }
      }
    } catch {
      // ignore
    }
  };

  const handlePinChange = (newLat: number, newLng: number, reverseGeocodedAddress?: string) => {
    setLat(newLat);
    setLng(newLng);
    if (reverseGeocodedAddress) {
      setAddress(reverseGeocodedAddress);
    }
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
      await onSave({
        name: name.trim(),
        address: address.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}, Cagayan de Oro`,
        latitude: lat,
        longitude: lng,
        zone
      });
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
              <h3 className="text-lg font-black">Add New Delivery Hub</h3>
              <p className="text-xs text-emerald-100">
                Search an address or drag the map / pin to set exact GPS coordinates
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
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

          {/* Google Places Search Bar */}
          <div className="relative">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Search Address / Landmark (Optional)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Type street, barangay, or market in Cagayan de Oro..."
                className="w-full min-h-[44px] pl-10 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#004D40]"
              />
              {isSearching && (
                <Loader2 className="w-4 h-4 text-[#004D40] animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
              )}
            </div>

            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                {suggestions.map(sug => (
                  <button
                    key={sug.placeId}
                    type="button"
                    onClick={() => handleSelectSuggestion(sug)}
                    className="w-full min-h-[44px] text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 border-b last:border-b-0 border-slate-100 dark:border-slate-700 text-xs cursor-pointer"
                  >
                    <div className="font-bold text-slate-900 dark:text-white">{sug.title}</div>
                    {sug.subtitle && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {sug.subtitle}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Interactive Fast-Drag Google Map Picker */}
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
              placeholder="Auto-filled from map pin or type street details"
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#004D40]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
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
