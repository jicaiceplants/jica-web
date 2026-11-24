"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Compass } from "lucide-react";

interface GoogleMapPickerProps {
  lat: number;
  lng: number;
  zoom?: number;
  onPinChange: (lat: number, lng: number, address?: string) => void;
  onGoogleReady?: () => void;
}

declare global {
  interface Window {
    google?: any;
  }
}

export default function GoogleMapPicker({ 
  lat, 
  lng, 
  zoom = 13,
  onPinChange,
  onGoogleReady
}: GoogleMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const [hasGoogleMaps, setHasGoogleMaps] = useState(false);
  const [currentCoord, setCurrentCoord] = useState({ lat, lng });

  // Update marker & pan map when coordinates change (e.g. from Autocomplete search selection)
  useEffect(() => {
    setCurrentCoord({ lat, lng });
    if (markerInstanceRef.current && mapInstanceRef.current) {
      const pos = { lat, lng };
      markerInstanceRef.current.setPosition(pos);
      mapInstanceRef.current.panTo(pos);
      if (zoom && zoom !== 13) {
        mapInstanceRef.current.setZoom(zoom);
      }
    }
  }, [lat, lng, zoom]);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (apiKey && apiKey !== "your_google_maps_api_key_here") {
      setHasGoogleMaps(true);

      if (typeof window !== "undefined") {
        if (window.google?.maps?.places) {
          initMap();
          if (onGoogleReady) onGoogleReady();
        } else {
          const existingScript = document.getElementById("google-maps-script") as HTMLScriptElement;
          if (!existingScript) {
            const script = document.createElement("script");
            script.id = "google-maps-script";
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
              initMap();
              if (onGoogleReady) onGoogleReady();
            };
            document.head.appendChild(script);
          } else {
            const handleLoad = () => {
              initMap();
              if (onGoogleReady) onGoogleReady();
            };
            existingScript.addEventListener("load", handleLoad);
            if (window.google?.maps) {
              handleLoad();
            }
          }
        }
      }
    }
  }, []);

  const initMap = () => {
    if (!containerRef.current || !window.google?.maps) return;

    try {
      const google = window.google;
      geocoderRef.current = new google.maps.Geocoder();

      // Initial center: Cagayan de Oro City (8.4772, 124.6459, zoom 13)
      const initialCenter = { 
        lat: currentCoord.lat || 8.4772, 
        lng: currentCoord.lng || 124.6459 
      };

      const map = new google.maps.Map(containerRef.current, {
        center: initialCenter,
        zoom: zoom || 13,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        clickableIcons: false,
      });

      mapInstanceRef.current = map;

      // Trigger resize after modal renders to ensure zero canvas collapse
      setTimeout(() => {
        if (mapInstanceRef.current && window.google?.maps?.event) {
          window.google.maps.event.trigger(mapInstanceRef.current, "resize");
          mapInstanceRef.current.setCenter(initialCenter);
        }
      }, 150);

      setTimeout(() => {
        if (mapInstanceRef.current && window.google?.maps?.event) {
          window.google.maps.event.trigger(mapInstanceRef.current, "resize");
          mapInstanceRef.current.setCenter(initialCenter);
        }
      }, 350);

      // Standard Draggable Marker
      const marker = new google.maps.Marker({
        position: initialCenter,
        map,
        draggable: true,
        title: "Selected Delivery Hub (Drag to fine-tune)",
        animation: google.maps.Animation.DROP,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 7,
          fillColor: "#00875A",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2.5,
        }
      });

      markerInstanceRef.current = marker;

      const handleLocationSelect = (newLat: number, newLng: number) => {
        setCurrentCoord({ lat: newLat, lng: newLng });
        marker.setPosition({ lat: newLat, lng: newLng });

        // Real-time reverse geocoding with graceful non-blocking fallback
        try {
          if (geocoderRef.current) {
            geocoderRef.current.geocode(
              { location: { lat: newLat, lng: newLng } },
              (results: any, status: any) => {
                if (status === "OK" && results?.[0]?.formatted_address) {
                  onPinChange(newLat, newLng, results[0].formatted_address);
                } else {
                  onPinChange(newLat, newLng);
                }
              }
            );
          } else {
            onPinChange(newLat, newLng);
          }
        } catch (e) {
          console.warn("Reverse geocode fallback:", e);
          onPinChange(newLat, newLng);
        }
      };

      // Click anywhere on map to reposition pin
      map.addListener("click", (e: any) => {
        if (e.latLng) {
          handleLocationSelect(e.latLng.lat(), e.latLng.lng());
        }
      });

      // Drag pin to pinpoint exact drop-off spot
      marker.addListener("dragend", (e: any) => {
        if (e.latLng) {
          handleLocationSelect(e.latLng.lat(), e.latLng.lng());
        }
      });

    } catch (err) {
      console.error("Error initializing Google Map picker:", err);
    }
  };

  // Offline interactive fallback when key not yet configured
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Map to Cagayan de Oro bounds
    const newLat = 8.51 - y * (8.51 - 8.44);
    const newLng = 124.62 + x * (124.72 - 124.62);

    setCurrentCoord({ lat: newLat, lng: newLng });
    onPinChange(newLat, newLng, `Drop-off pin near (${newLat.toFixed(4)}, ${newLng.toFixed(4)}), Cagayan de Oro City`);
  };

  return (
    <div 
      style={{ width: '100%', height: '360px', minHeight: '360px' }} 
      className="w-full relative bg-slate-900 overflow-hidden select-none rounded-2xl"
    >
      {hasGoogleMaps ? (
        <div 
          ref={containerRef} 
          style={{ width: '100%', height: '360px', minHeight: '360px' }} 
          className="w-full h-full" 
        />
      ) : (
        <div 
          onClick={handleCanvasClick}
          style={{ width: '100%', height: '360px', minHeight: '360px' }}
          className="w-full h-full relative cursor-crosshair bg-slate-950 flex flex-col justify-between p-3 overflow-hidden"
        >
          <div className="relative z-10 flex justify-between items-center pointer-events-none">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800">
              Cagayan de Oro Delivery Grid
            </span>
            <span className="text-[10px] font-bold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md">
              Lat: {currentCoord.lat.toFixed(4)}, Lng: {currentCoord.lng.toFixed(4)}
            </span>
          </div>

          <div className="relative z-10 flex justify-between items-center pointer-events-none">
            <span className="text-[10px] text-slate-400">
              Click anywhere on map to reposition pin
            </span>
            <span className="text-[9px] text-emerald-500 font-bold">
              Connecting Google Maps...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
