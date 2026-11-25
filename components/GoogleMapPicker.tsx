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
    // Only capture initial camera options; external movements use panTo cleanly without recreating map
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const emitCoordinates = (newLat: number, newLng: number) => {
    lastEmittedRef.current = { lat: newLat, lng: newLng };
    setDisplayCoord({ lat: newLat, lng: newLng });

    if (geocoderRef.current) {
      geocoderRef.current.geocode(
        { location: { lat: newLat, lng: newLng } },
        (results: any, status: string) => {
          if (status === "OK" && results && results[0]?.formatted_address) {
            onPinChangeRef.current(newLat, newLng, results[0].formatted_address);
          } else {
            onPinChangeRef.current(newLat, newLng);
          }
        }
      );
    } else {
      onPinChangeRef.current(newLat, newLng);
    }
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

        // Track user map dragging cleanly without reacting during intermediate frames
        map.addListener("dragstart", () => {
          isMapDraggedRef.current = true;
        });

        // Fire coordinate + reverse geocode ONLY when map settles (idle) after user drag
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

        // Marker dragend fires once on release — zero React state work mid-drag
        marker.addListener("dragend", (event: any) => {
          const pos = event?.latLng;
          if (!pos) return;
          const newLat = Number(pos.lat().toFixed(6));
          const newLng = Number(pos.lng().toFixed(6));
          isProgrammaticMoveRef.current = true;
          map.panTo({ lat: newLat, lng: newLng });
          emitCoordinates(newLat, newLng);
        });

        // Tap / Click anywhere on map to place pin immediately
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
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
      if (mapInstanceRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(mapInstanceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoizedMapOptions]);

  // Move marker + pan ONLY when coordinates change externally (e.g., Search result or GPS button)
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
      () => {
        // Ignore denied geolocation gracefully
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  if (mapError) {
    return (
      <div className="h-[320px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <MapPin className="w-8 h-8 text-slate-400 mb-2" />
        <p className="font-bold text-slate-700 dark:text-slate-200">{mapError}</p>
        <p className="mt-1">Check NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in environment configuration.</p>
      </div>
    );
  }

  return (
    <div className="relative h-[320px] sm:h-[360px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">
      <div ref={mapContainerRef} className="w-full h-full" />

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 dark:bg-slate-900/80 text-xs font-bold text-slate-500">
          Loading Interactive Map...
        </div>
      )}

      {/* Coordinates overlay pill */}
      <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-[11px] font-mono text-slate-700 dark:text-slate-200 pointer-events-none">
        {displayCoord.lat.toFixed(5)}, {displayCoord.lng.toFixed(5)}
      </div>

      {/* GPS Center Button */}
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
