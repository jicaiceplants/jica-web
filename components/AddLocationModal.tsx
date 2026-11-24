"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, Search, X, Check, Compass } from "lucide-react";
import dynamic from "next/dynamic";
import { DeliveryLocation } from "@/lib/types";
import { searchPlacesNew, getPlaceNewDetails, generatePlacesSessionToken, PlaceSuggestionItem } from "@/lib/placesService";

// Lazy-load Google Map Picker ONLY when modal opens (0 initial quota consumed on page load)
const GoogleMapPicker = dynamic(
  () => import("./GoogleMapPicker"),
  { 
    ssr: false,
    loading: () => (
      <div 
        style={{ width: '100%', height: '360px', minHeight: '360px' }} 
        className="bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-400 font-bold text-xs gap-2"
      >
        <Compass className="w-4 h-4 animate-spin text-[#00875A]" />
        Loading Google Maps Cagayan de Oro...
      </div>
    )
  }
);

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (location: Omit<DeliveryLocation, "id" | "customersCount">) => void;
}

export default function AddLocationModal({
  isOpen,
  onClose,
  onSave
}: AddLocationModalProps) {
  // Center initially on Cagayan de Oro City
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState(8.4772);
  const [longitude, setLongitude] = useState(124.6459);
  const [mapZoom, setMapZoom] = useState(13);
  const [zone, setZone] = useState<"City Proper" | "Lapasan/Gusa Corridor" | "Uptown CDO" | "Market District">("City Proper");
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestionItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const sessionTokenRef = useRef<string>("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  // Initialize Places API (New) session token on modal open
  useEffect(() => {
    if (isOpen) {
      sessionTokenRef.current = generatePlacesSessionToken();
    }
  }, [isOpen]);

  // 500ms Debounced Places API (New) Search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handler = setTimeout(async () => {
      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = generatePlacesSessionToken();
        }

        const results = await searchPlacesNew(searchTerm, apiKey, sessionTokenRef.current);
        setSuggestions(results);
      } catch (err) {
        console.warn("Places search error:", err);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [searchTerm, apiKey]);

  if (!isOpen) return null;

  const handleSelectSuggestion = async (suggestion: PlaceSuggestionItem) => {
    setName(suggestion.name);
    setSearchTerm(suggestion.name);
    setShowDropdown(false);

    if (suggestion.placeId && apiKey) {
      try {
        const details = await getPlaceNewDetails(suggestion.placeId, apiKey, sessionTokenRef.current);
        // Renew session token for next search session
        sessionTokenRef.current = generatePlacesSessionToken();

        if (details) {
          setAddress(details.address || suggestion.address);
          setLatitude(details.latitude);
          setLongitude(details.longitude);
          setMapZoom(17); // Pan and zoom map to 17

          // Auto-classify corridor zone based on coordinates
          if (details.latitude < 8.46) setZone("Uptown CDO");
          else if (details.longitude > 124.66) setZone("Lapasan/Gusa Corridor");
          else setZone("City Proper");
          return;
        }
      } catch (err) {
        console.warn("Place details fetch error:", err);
      }
    }

    // Fallback if details query fails
    if (suggestion.address) {
      setAddress(suggestion.address);
    }
  };

  const handleMapPinMove = (lat: number, lng: number, resolvedAddr?: string) => {
    setLatitude(lat);
    setLongitude(lng);

    if (resolvedAddr) {
      setAddress(resolvedAddr);
      if (!name) {
        setName(resolvedAddr.split(",")[0] || "New Delivery Hub");
      }
    } else if (!address) {
      setAddress(`Drop point near (${lat.toFixed(4)}, ${lng.toFixed(4)}), Cagayan de Oro City`);
    }

    // Auto classify zone
    if (lat < 8.46) setZone("Uptown CDO");
    else if (lng > 124.66) setZone("Lapasan/Gusa Corridor");
    else setZone("City Proper");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Please enter a Hub Display Name (e.g. SM Downtown Premier, Limketkai Center, Cogon Market).");
      return;
    }

    onSave({
      name: name.trim(),
      address: address.trim() || `${name.trim()}, Cagayan de Oro City`,
      latitude,
      longitude,
      zone
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-6 h-6 text-[#00875A]" />
              Add Delivery Hub
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Powered by Places API (New): search a destination or drag the pinpoint on Google Maps.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          
          {/* Places Search Bar (Places API New, 500ms Debounce) */}
          <div className="relative">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                1. Search Landmark / Mall (Places API New)
              </label>
              {isSearching && (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                  <Compass className="w-3 h-3 animate-spin" /> Searching...
                </span>
              )}
            </div>
            <div className="relative flex items-center">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5" />
              <input
                type="text"
                placeholder="Search Cagayan de Oro location (e.g., SM Downtown, Centrio, Cogon, Gaisano)..."
                className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:outline-hidden focus:border-[#00875A] text-sm text-slate-900 dark:text-white font-semibold"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
              />
            </div>

            {/* Places Suggestions Dropdown */}
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-30 max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                {suggestions.map((item, idx) => (
                  <button
                    key={`${item.placeId}-${idx}`}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    className="w-full text-left p-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-start gap-3 transition-colors cursor-pointer"
                  >
                    <MapPin className="w-4 h-4 text-[#00875A] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</div>
                      <div className="text-xs text-slate-500">{item.address}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Interactive Google Map Picker (Height 360px, Draggable Pin) */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                2. Click Anywhere on Map or Drag Pin to Fine-Tune Spot
              </label>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                ✓ Draggable Pin Active
              </span>
            </div>

            <div 
              style={{ width: '100%', height: '360px', minHeight: '360px' }} 
              className="rounded-2xl overflow-hidden border-2 border-slate-300 dark:border-slate-600 relative shadow-inner"
            >
              <GoogleMapPicker 
                lat={latitude} 
                lng={longitude}
                zoom={mapZoom}
                onPinChange={handleMapPinMove}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1 italic">
              Coordinates: <strong>{latitude.toFixed(5)}, {longitude.toFixed(5)}</strong> • Click or drag marker to pinpoint drop-off location.
            </p>
          </div>

          {/* 3. Hub Display Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              3. Hub Display Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. SM Downtown Premier, Limketkai Center, Cogon Market"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="px-4 py-3 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:outline-hidden focus:border-[#00875A] font-extrabold text-base text-slate-900 dark:text-white"
            />
          </div>

          {/* 4. Resolved Street Address */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Street / Building Address
            </label>
            <input
              type="text"
              placeholder="e.g. Claro M. Recto Ave. corner Osmeña St., Cagayan de Oro"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-hidden focus:border-[#00875A] text-sm text-slate-900 dark:text-white"
            />
          </div>

          {/* 5. Corridor Zone Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Corridor Zone
            </label>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value as any)}
              className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-hidden focus:border-[#00875A] text-sm font-bold text-slate-900 dark:text-white cursor-pointer"
            >
              <option value="City Proper">City Proper (Divisoria, Recto, Corrales)</option>
              <option value="Lapasan/Gusa Corridor">Lapasan / Gusa Corridor (National Highway)</option>
              <option value="Uptown CDO">Uptown CDO (Upper Balulang / Masterson Ave)</option>
              <option value="Market District">Market District (Cogon, Carmen)</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-3 bg-[#00875A] hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Save Delivery Hub
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
