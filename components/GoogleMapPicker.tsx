"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { loadGoogleMaps, BASE_GOOGLE_MAP_OPTIONS } from "@/lib/googleMapsLoader";
import { CDO_MAP_CENTER } from "@/lib/constants";
import { MapPin, LocateFixed } from "lucide-react";

interface GoogleMapPickerProps {
  lat: number;
  lng: number;
  zoom?: number;
  onPinChange: (newLat: number, newLng: number, reverseGeocodedAddress?: string) => void;
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const GEOCODE_CACHE_STORAGE_KEY = "jica_geocode_cache_v1";
const MAX_CACHE_ENTRIES = 200;

const memGeocodeCache = new Map<string, string>();

function makeCoordCacheKey(lat: number, lng: number): string {
  // 4 decimal places (~11m grid) prevents duplicate Geocoding billing on nearby drags
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function getCachedGeocode(lat: number, lng: number): string | null {
  const key = makeCoordCacheKey(lat, lng);
  if (memGeocodeCache.has(key)) return memGeocodeCache.get(key) || null;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Record<string, string>;
    if (obj[key]) {
      memGeocodeCache.set(key, obj[key]);
      return obj[key];
    }
  } catch {
    // ignore storage read error
  }
  return null;
}

function saveCachedGeocode(lat: number, lng: number, address: string): void {
  const key = makeCoordCacheKey(lat, lng);
  memGeocodeCache.set(key, address);
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_STORAGE_KEY);
    const obj = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    const keys = Object.keys(obj);
    if (keys.length >= MAX_CACHE_ENTRIES) {
      delete obj[keys[0]];
    }
    obj[key] = address;
    localStorage.setItem(GEOCODE_CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore quota error
  }
}

export function GoogleMapPicker({
  lat,
  lng,
  zoom = 14,
  onPinChange
}: GoogleMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const onPinChangeRef = useRef(onPinChange);
  const isProgrammaticMoveRef = useRef(false);
  const isMapDraggedRef = useRef(false);
  const lastEmittedRef = useRef<{ lat: number; lng: number }>({ lat, lng });
  const geocodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [displayCoord, setDisplayCoord] = useState({ lat, lng });

  useEffect(() => {
    onPinChangeRef.current = onPinChange;
  }, [onPinChange]);

  const memoizedMapOptions = useMemo(
    () => ({
      ...BASE_GOOGLE_MAP_OPTIONS,
      center: {
        lat: Number.isFinite(lat) ? lat : CDO_MAP_CENTER.lat,
        lng: Number.isFinite(lng) ? lng : CDO_MAP_CENTER.lng
      },
      zoom
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const emitCoordinates = (newLat: number, newLng: number) => {
    lastEmittedRef.current = { lat: newLat, lng: newLng };
    setDisplayCoord({ lat: newLat, lng: newLng });

    // Notify coordinates immediately; debounce paid reverse-geocode calls (600ms) + check cache first
    onPinChangeRef.current(newLat, newLng);

    if (geocodeDebounceRef.current) {
      clearTimeout(geocodeDebounceRef.current);
      geocodeDebounceRef.current = null;
    }

    const cached = getCachedGeocode(newLat, newLng);
    if (cached) {
      onPinChangeRef.current(newLat, newLng, cached);
      return;
    }

    if (!geocoderRef.current) return;

    geocodeDebounceRef.current = setTimeout(() => {
      geocoderRef.current?.geocode(
        { location: { lat: newLat, lng: newLng } },
        (results: any, status: string) => {
          if (status === "OK" && results && results[0]?.formatted_address) {
            const formatted = results[0].formatted_address;
            saveCachedGeocode(newLat, newLng, formatted);
            onPinChangeRef.current(newLat, newLng, formatted);
          }
        }
      );
    }, 600);
  };

  useEffect(() => {
    let isMounted = true;

    loadGoogleMaps(GOOGLE_MAPS_API_KEY)
      .then((google) => {
        if (!isMounted || !mapContainerRef.current) return;

        const map = new google.maps.Map(mapContainerRef.current, memoizedMapOptions);
        mapInstanceRef.current = map;
        geocoderRef.current = new google.maps.Geocoder();

        const marker = new google.maps.Marker({
          position: { lat, lng },
          map,
          draggable: true,
          title: "Delivery Hub Location Pin"
        });
        markerRef.current = marker;

        // Cancel pending geocode immediately when starting a new drag
        map.addListener("dragstart", () => {
          isMapDraggedRef.current = true;
          if (geocodeDebounceRef.current) {
            clearTimeout(geocodeDebounceRef.current);
            geocodeDebounceRef.current = null;
          }
        });

        marker.addListener("dragstart", () => {
          if (geocodeDebounceRef.current) {
            clearTimeout(geocodeDebounceRef.current);
            geocodeDebounceRef.current = null;
          }
        });

        // Fire ONLY on idle after user drag settles (600ms reverse-geocode debounce + local cache)
        map.addListener("idle", () => {
          if (isProgrammaticMoveRef.current) {
            isProgrammaticMoveRef.current = false;
            isMapDraggedRef.current = false;
            return;
          }
          if (!isMapDraggedRef.current) return;
          isMapDraggedRef.current = false;

          const center = map.getCenter();
          if (!center) return;
          const newLat = Number(center.lat().toFixed(6));
          const newLng = Number(center.lng().toFixed(6));
          marker.setPosition({ lat: newLat, lng: newLng });
          emitCoordinates(newLat, newLng);
        });

        marker.addListener("dragend", (event: any) => {
          const pos = event?.latLng;
          if (!pos) return;
          const newLat = Number(pos.lat().toFixed(6));
          const newLng = Number(pos.lng().toFixed(6));
          isProgrammaticMoveRef.current = true;
          map.panTo({ lat: newLat, lng: newLng });
          emitCoordinates(newLat, newLng);
        });

        map.addListener("click", (event: any) => {
          const pos = event?.latLng;
          if (!pos) return;
          const newLat = Number(pos.lat().toFixed(6));
          const newLng = Number(pos.lng().toFixed(6));
          marker.setPosition({ lat: newLat, lng: newLng });
          isProgrammaticMoveRef.current = true;
          map.panTo({ lat: newLat, lng: newLng });
          emitCoordinates(newLat, newLng);
        });

        setIsLoaded(true);
      })
      .catch((err) => {
        if (!isMounted) return;
        setMapError(err?.message || "Unable to load Google Maps Picker.");
      });

    return () => {
      isMounted = false;
      if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);
      if (markerRef.current) markerRef.current.setMap(null);
      if (mapInstanceRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(mapInstanceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoizedMapOptions]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !isLoaded) return;

    const deltaLat = Math.abs(lat - lastEmittedRef.current.lat);
    const deltaLng = Math.abs(lng - lastEmittedRef.current.lng);
    if (deltaLat < 0.00001 && deltaLng < 0.00001) {
      return;
    }

    lastEmittedRef.current = { lat, lng };
    setDisplayCoord({ lat, lng });
    isProgrammaticMoveRef.current = true;
    marker.setPosition({ lat, lng });
    map.panTo({ lat, lng });
    if (zoom && map.getZoom() !== zoom) {
      map.setZoom(zoom);
    }
  }, [lat, lng, zoom, isLoaded]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const curLat = Number(pos.coords.latitude.toFixed(6));
        const curLng = Number(pos.coords.longitude.toFixed(6));
        const map = mapInstanceRef.current;
        const marker = markerRef.current;
        if (map && marker) {
          isProgrammaticMoveRef.current = true;
          marker.setPosition({ lat: curLat, lng: curLng });
          map.panTo({ lat: curLat, lng: curLng });
          map.setZoom(17);
        }
        emitCoordinates(curLat, curLng);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  if (mapError) {
    return (
      <div className="h-[300px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <MapPin className="w-8 h-8 text-slate-400 mb-2" />
        <p className="font-bold text-slate-700 dark:text-slate-200">{mapError}</p>
        <p className="mt-1">Check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in environment configuration.</p>
      </div>
    );
  }

  return (
    <div className="relative h-[300px] sm:h-[340px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">
      <div ref={mapContainerRef} className="w-full h-full" />

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 dark:bg-slate-900/80 text-xs font-bold text-slate-500">
          Loading Interactive Map...
        </div>
      )}

      <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-[11px] font-mono text-slate-700 dark:text-slate-200 pointer-events-none">
        {displayCoord.lat.toFixed(5)}, {displayCoord.lng.toFixed(5)}
      </div>

      <button
        type="button"
        onClick={handleUseMyLocation}
        className="absolute bottom-3 right-3 min-w-[44px] min-h-[44px] px-3 py-2 bg-white/95 dark:bg-slate-900/95 hover:bg-slate-50 text-[#004D40] dark:text-emerald-300 border border-slate-200 dark:border-slate-700 rounded-xl shadow-md text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        title="Center on My Current GPS Location"
      >
        <LocateFixed className="w-4 h-4" />
        <span className="hidden sm:inline">Use My GPS</span>
      </button>
    </div>
  );
}
